export type MainNavItem = {
  key: string;
  label: string;
  href: string;
  /** Route shown when wallet is not connected (Home only). */
  publicHref?: string;
  requiresAuth: boolean;
};

/** Primary navbar — matches README routes. */
export const MAIN_NAV: MainNavItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/home",
    publicHref: "/",
    requiresAuth: false,
  },
  {
    key: "wallet",
    label: "Wallet",
    href: "/wallet",
    requiresAuth: true,
  },
  {
    key: "messages",
    label: "Messages",
    href: "/chat",
    requiresAuth: true,
  },
  {
    key: "creators",
    label: "Creators",
    href: "/hire",
    requiresAuth: false,
  },
];

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

/** Left sidebar — Creators only in top navbar. */
export const SIDEBAR_NAV = MAIN_NAV.filter((item) => item.key !== "creators");
