import type { SessionUser } from "@/lib/auth";

/** Create backend JWT session from connected wallet address. */
export async function syncWalletSession(
  walletAddress: string
): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, address: walletAddress }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user ?? null;
}
