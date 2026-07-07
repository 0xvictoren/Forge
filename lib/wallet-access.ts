import { AccountAddress } from "@aptos-labs/ts-sdk";

/** Normalize Aptos address for consistent comparison. */
export function normalizeAptosAddress(address: string): string {
  try {
    return AccountAddress.fromString(address.trim()).toString().toLowerCase();
  } catch {
    return address.trim().toLowerCase();
  }
}

/** Parse comma/newline-separated wallet list into normalized unique addresses. */
export function parseWalletList(input: string): string[] {
  const parts = input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    try {
      const norm = normalizeAptosAddress(part);
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push(norm);
      }
    } catch {
      // skip invalid entries
    }
  }
  return out;
}

/** Check if wallet may access a gated BurnLink. Owner always allowed. */
export function isWalletAllowed(
  wallet: string,
  allowedWallets: string[],
  opts?: { walletGated?: boolean; ownerWallet?: string | null }
): boolean {
  const norm = normalizeAptosAddress(wallet);

  if (opts?.ownerWallet) {
    try {
      if (normalizeAptosAddress(opts.ownerWallet) === norm) return true;
    } catch {
      // ignore
    }
  }

  if (!opts?.walletGated || allowedWallets.length === 0) return true;

  const allowed = allowedWallets.map((w) => normalizeAptosAddress(w));
  return allowed.includes(norm);
}

export const ACCESS_DENIED_MESSAGE = "You don't have access to this file";
