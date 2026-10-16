import type { SessionUser } from "@/lib/auth";
import type { MainNavItem } from "@/lib/nav-config";
import { AUTH_RETURN_KEY, resolveNavHref } from "@/lib/nav-config";
import { syncWalletSession } from "@/lib/sync-session";
import type { AptosSignMessageInput, AptosSignMessageOutput } from "@aptos-labs/wallet-adapter-core";

const PROTECTED_PREFIXES = [
  "/home",
  "/wallet",
  "/chat",
  "/upload",
  "/profile",
  "/vaults",
  "/library",
  "/workspaces",
  "/onboarding",
  "/dashboard",
  "/studio",
  "/licenses",
  "/compliance",
];

export function routeNeedsSession(href: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => href === p || href.startsWith(`${p}/`)
  );
}

/** Ensure JWT cookie exists before visiting middleware-protected routes. */
export async function ensureSessionForNav(opts: {
  connected: boolean;
  walletAddress?: string;
  currentUser: SessionUser | null;
  setUser: (u: SessionUser) => void;
  setWallet: (w: string) => void;
  signMessage?: (input: AptosSignMessageInput) => Promise<AptosSignMessageOutput>;
  publicKey?: { toString(): string };
}): Promise<SessionUser | null> {
  if (opts.currentUser) return opts.currentUser;
  if (!opts.connected || !opts.walletAddress || !opts.signMessage || !opts.publicKey) return null;

  const synced = await syncWalletSession(
    opts.walletAddress,
    opts.signMessage,
    opts.publicKey
  );
  if (synced) {
    opts.setUser(synced);
    opts.setWallet(opts.walletAddress);
    return synced;
  }
  return null;
}

export function resolveAuthenticatedHref(
  item: MainNavItem,
  user: SessionUser | null,
  connected: boolean,
  accountAddress?: string
): string {
  const isAuthenticated = !!user || (connected && !!accountAddress);
  return resolveNavHref(item, isAuthenticated);
}

export function stashAuthReturn(href: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(AUTH_RETURN_KEY, href);
  }
}
