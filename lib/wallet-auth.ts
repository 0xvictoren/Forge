import {
  AccountAddress,
  Ed25519PublicKey,
  Ed25519Signature,
} from "@aptos-labs/ts-sdk";
import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAptosClient } from "./aptos";

export const AUTH_CHALLENGE_COOKIE = "forge_auth_challenge";
const CHALLENGE_TTL_SECONDS = 5 * 60;

const signedLoginSchema = z.object({
  walletAddress: z.string().min(1).max(128),
  message: z.string().min(1).max(1024),
  nonce: z.string().regex(/^[a-f0-9]{64}$/i),
  fullMessage: z.string().min(1).max(2048),
  publicKey: z.string().regex(/^0x[a-f0-9]{64}$/i),
  signature: z.string().regex(/^0x[a-f0-9]{128}$/i),
});

type ChallengePayload = {
  purpose: "wallet-login";
  address: string;
  nonce: string;
  message: string;
};

function getChallengeSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function normalizeWalletAddress(address: string): string {
  return AccountAddress.fromString(address.trim()).toString().toLowerCase();
}

function buildLoginMessage(address: string, nonce: string, origin: string): string {
  return `Forge login | address=${address} | nonce=${nonce} | origin=${origin}`;
}

export async function issueWalletLoginChallenge(address: string, origin: string) {
  const normalized = normalizeWalletAddress(address);
  const nonce = randomBytes(32).toString("hex");
  const message = buildLoginMessage(normalized, nonce, origin);

  const token = await new SignJWT({
    purpose: "wallet-login",
    address: normalized,
    nonce,
    message,
  } satisfies ChallengePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(getChallengeSecret());

  const cookieStore = await cookies();
  cookieStore.set(AUTH_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: CHALLENGE_TTL_SECONDS,
    path: "/api/auth",
  });

  return { walletAddress: normalized, nonce, message };
}

export function parseAptosFullMessage(fullMessage: string): Map<string, string> | null {
  const lines = fullMessage.split("\n");
  if (lines[0] !== "APTOS") return null;

  const fields = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(": ");
    if (separator <= 0) return null;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 2);
    if (fields.has(key)) return null;
    fields.set(key, value);
  }
  return fields;
}

export function hasExpectedWalletBindings(
  fullMessage: string,
  expected: { address: string; message: string; nonce: string }
): boolean {
  const fields = parseAptosFullMessage(fullMessage);
  if (
    !fields ||
    fields.size !== 3 ||
    fields.get("message") !== expected.message ||
    fields.get("nonce") !== expected.nonce
  ) {
    return false;
  }

  try {
    return normalizeWalletAddress(fields.get("address") || "") === expected.address;
  } catch {
    return false;
  }
}

async function readChallenge(): Promise<ChallengePayload | null> {
  const token = (await cookies()).get(AUTH_CHALLENGE_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getChallengeSecret());
    if (
      payload.purpose !== "wallet-login" ||
      typeof payload.address !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.message !== "string"
    ) {
      return null;
    }
    return {
      purpose: "wallet-login",
      address: payload.address,
      nonce: payload.nonce,
      message: payload.message,
    };
  } catch {
    return null;
  }
}

export async function clearWalletLoginChallenge() {
  (await cookies()).delete(AUTH_CHALLENGE_COOKIE);
}

export async function verifySignedWalletLogin(input: unknown): Promise<
  | { ok: true; walletAddress: string }
  | { ok: false; error: string }
> {
  const parsed = signedLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid wallet authentication payload" };
  }

  const challenge = await readChallenge();
  if (!challenge) {
    return { ok: false, error: "Login challenge is missing or expired" };
  }

  let walletAddress: string;
  try {
    walletAddress = normalizeWalletAddress(parsed.data.walletAddress);
  } catch {
    return { ok: false, error: "Invalid wallet address" };
  }

  if (
    walletAddress !== challenge.address ||
    parsed.data.nonce !== challenge.nonce ||
    parsed.data.message !== challenge.message
  ) {
    return { ok: false, error: "Login challenge does not match" };
  }

  if (!hasExpectedWalletBindings(parsed.data.fullMessage, {
    address: walletAddress,
    message: challenge.message,
    nonce: challenge.nonce,
  })) {
    return { ok: false, error: "Signed message is missing required bindings" };
  }

  try {
    const publicKey = new Ed25519PublicKey(parsed.data.publicKey);
    const signature = new Ed25519Signature(parsed.data.signature);
    const messageBytes = new TextEncoder().encode(parsed.data.fullMessage);

    if (!publicKey.verifySignature({ message: messageBytes, signature })) {
      return { ok: false, error: "Wallet signature is invalid" };
    }

    const authenticationKey = publicKey.authKey().derivedAddress().toString().toLowerCase();
    let boundToAccount = authenticationKey === walletAddress;

    if (!boundToAccount) {
      try {
        const account = await getAptosClient().getAccountInfo({
          accountAddress: walletAddress,
        });
        boundToAccount =
          normalizeWalletAddress(account.authentication_key) === authenticationKey;
      } catch {
        boundToAccount = false;
      }
    }

    if (!boundToAccount) {
      return { ok: false, error: "Public key is not authorized for this account" };
    }

    return { ok: true, walletAddress };
  } catch {
    return {
      ok: false,
      error: "Unsupported wallet key or malformed signature",
    };
  }
}
