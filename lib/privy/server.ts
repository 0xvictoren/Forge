import "server-only";
import { AccountAddress, AuthenticationKey, Ed25519PublicKey } from "@aptos-labs/ts-sdk";
import { PrivyClient } from "@privy-io/node";

let client: PrivyClient | null = null;

export function privyConfigured() {
  return !!process.env.NEXT_PUBLIC_PRIVY_APP_ID && !!process.env.PRIVY_APP_SECRET;
}

function privy() {
  if (!client) client = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });
  return client;
}

export type PrivyIdentity = { privyUserId: string; email: string | null; aptos: { address: string; publicKey: string } };

/**
 * Verify a Privy access token and return the user's email and embedded Aptos
 * wallet. The wallet address is checked against its public key, so a session
 * can only ever be opened for the key Privy actually holds.
 */
export async function verifyPrivyUser(accessToken: string): Promise<PrivyIdentity> {
  const claims = await privy().utils().auth().verifyAccessToken(accessToken);
  const user = await privy().users()._get(claims.user_id);
  const accounts = user.linked_accounts as unknown as Record<string, unknown>[];
  const email = accounts.find((a) => a.type === "email")?.address as string | undefined;
  const google = accounts.find((a) => a.type === "google_oauth")?.email as string | undefined;
  const wallet = accounts.find((a) => a.type === "wallet" && a.chain_type === "aptos") as { address?: string; public_key?: string } | undefined;
  if (!wallet?.address || !wallet.public_key) throw new Error("No Forge account wallet yet");

  const publicKey = new Ed25519PublicKey(`0x${wallet.public_key.replace(/^0x/, "").slice(-64)}`);
  const derived = AuthenticationKey.fromPublicKey({ publicKey }).derivedAddress().toString();
  const address = AccountAddress.from(wallet.address).toString();
  if (derived !== address) throw new Error("Wallet does not match its key");

  return { privyUserId: user.id, email: (email || google || null)?.toLowerCase() ?? null, aptos: { address, publicKey: publicKey.toString() } };
}
