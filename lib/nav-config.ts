export type MainNavItem = {
  key: string;
  label: string;
  href: string;
  /** Route shown when wallet is not connected (Home only). */
  publicHref?: string;
  requiresAuth: boolean;
};

/** Primary navbar — order: Home, Upload, Library, Vault, Chat, Explore */
export const MAIN_NAV: MainNavItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/home",
    publicHref: "/",
    requiresAuth: false,
  },
  {
    key: "upload",
    label: "Upload",
    href: "/upload",
    requiresAuth: true,
  },
  {
    key: "library",
    label: "Library",
    href: "/library",
    requiresAuth: true,
  },
  {
    key: "vaults",
    label: "Vault",
    href: "/vaults",
    requiresAuth: true,
  },
  {
    key: "messages",
    label: "Chat",
    href: "/chat",
    requiresAuth: true,
  },
  {
    key: "explore",
    label: "Explore",
    href: "/explore",
    requiresAuth: false,
  },
];

/** Desktop + mobile header nav (same order as MAIN_NAV) */
export const HEADER_NAV = MAIN_NAV;

export function resolveNavHref(item: MainNavItem, isAuthenticated: boolean): string {
  if (!isAuthenticated && item.publicHref) return item.publicHref;
  return item.href;
}

export function isNavActive(pathname: string, item: MainNavItem): boolean {
  const targets = [item.href, item.publicHref].filter(Boolean) as string[];
  return targets.some(
    (t) => pathname === t || (t !== "/" && pathname.startsWith(`${t}/`))
  );
}

export const AUTH_RETURN_KEY = "forge_return";

/** App sidebar — utility routes not in top nav */
export const SIDEBAR_NAV: MainNavItem[] = [
  { key: "wallet", label: "Wallet", href: "/wallet", requiresAuth: true },
  { key: "profile", label: "Profile", href: "/profile", requiresAuth: true },
];