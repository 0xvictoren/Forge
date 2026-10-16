import type { SessionUser } from "@/lib/auth";
import type { AptosSignMessageInput, AptosSignMessageOutput } from "@aptos-labs/wallet-adapter-core";

type SignMessage = (input: AptosSignMessageInput) => Promise<AptosSignMessageOutput>;

/** Create backend JWT session from connected wallet address. */
export async function syncWalletSession(
  walletAddress: string,
  signMessage: SignMessage,
  publicKey: { toString(): string }
): Promise<SessionUser | null> {
  const challengeRes = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  if (!challengeRes.ok) return null;
  const challenge = (await challengeRes.json()) as {
    walletAddress: string;
    message: string;
    nonce: string;
  };

  const signed = await signMessage({
    message: challenge.message,
    nonce: challenge.nonce,
    address: true,
  });

  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: challenge.walletAddress,
      message: signed.message,
      nonce: signed.nonce,
      fullMessage: signed.fullMessage,
      publicKey: publicKey.toString(),
      signature: signed.signature.toString(),
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user ?? null;
}
