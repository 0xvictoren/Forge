import type { SessionUser } from "@/lib/auth";
import type { MainNavItem } from "@/lib/nav-config";
import { AUTH_RETURN_KEY, resolveNavHref } from "@/lib/nav-config";
import { syncWalletSession } from "@/lib/sync-session";

const PROTECTED_PREFIXES = [
  "/home",
  "/wallet",
  "/chat",
  "/upload",
  "/profile",
  "/onboarding",
  "/dashboard",
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
}): Promise<SessionUser | null> {
  if (opts.currentUser) return opts.currentUser;
  if (!opts.connected || !opts.walletAddress) return null;

  const synced = await syncWalletSession(opts.walletAddress);
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
