"use client";

import { Logo } from "@/components/layout/logo";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Menu,
} from "lucide-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { UploadIconButton } from "@/components/upload/upload-choice-modal";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { HEADER_NAV, isNavActive } from "@/lib/nav-config";
import { useI18n } from "@/components/providers/i18n-provider";
import { resolveAvatarUrl } from "@/lib/profile-media";
import {
  ensureSessionForNav,
  resolveAuthenticatedHref,
  routeNeedsSession,
  stashAuthReturn,
} from "@/lib/navigate-with-auth";

const NAV_I18N: Record<string, string> = {
  home: "nav_home",
  upload: "nav_upload",
  explore: "nav_explore",
  vaults: "nav_vaults",
  library: "nav_library",
  wallet: "nav_wallet",
  messages: "nav_messages",
  profile: "nav_profile",
};

export function SiteHeader({ showSearch = true }: { showSearch?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTab, setSearchTab] = useState("Projects");
  const [query, setQuery] = useState("");
  const { user, setUser, setWallet } = useAppStore();
  const { connected, account } = useWallet();
  const { t } = useI18n();
  const walletAddress = account?.address?.toString();
  const isAuthenticated = !!user || (connected && !!walletAddress);
  const avatarSrc = user ? resolveAvatarUrl(user) : null;

  const goTo = useCallback(
    async (href: string) => {
      setMobileOpen(false);

      if (pathname === href) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      let sessionUser = user;
      if (routeNeedsSession(href)) {
        sessionUser = await ensureSessionForNav({
          connected,
          walletAddress,
          currentUser: user,
          setUser,
          setWallet,
        });
        if (!sessionUser) {
          stashAuthReturn(href);
          return;
        }
      }

      router.push(href);
    },
    [user, connected, walletAddress, pathname, router, setUser, setWallet]
  );

  const navigate = useCallback(
    async (item: (typeof HEADER_NAV)[number]) => {
      const target = resolveAuthenticatedHref(
        item,
        user,
        connected,
        walletAddress
      );

      if (item.requiresAuth && !user && !connected) {
        stashAuthReturn(item.href);
        return;
      }

      await goTo(target);
    },
    [user, connected, walletAddress, goTo]
  );

  const runSearch = useCallback(() => {
    if (!query.trim()) return;
    const typeMap: Record<string, string> = {
      Projects: "assets",
      Creators: "creators",
      BurnLinks: "burnlinks",
      Assets: "assets",
      Skills: "skills",
    };
    router.push(
      `/hire?q=${encodeURIComponent(query)}&type=${typeMap[searchTab] || "all"}`
    );
  }, [query, searchTab, router]);

  return (
    <header className="shrink-0 border-b border-[var(--border-dim)] bg-[var(--bg-elevated)] shadow-sm">
      <div className="mx-auto flex h-[52px] max-w-[1760px] items-center gap-3 px-4 lg:gap-6 lg:px-8">
        <Logo />

        <nav
          className="relative z-20 hidden lg:flex flex-1 items-center gap-x-5"
          aria-label="Main"
        >
          {HEADER_NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item)}
              className={cn(
                "shrink-0 text-sm font-semibold hover:text-[var(--brand)] transition-colors",
                isNavActive(pathname, item)
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-primary)]"
              )}
            >
              {t(NAV_I18N[item.key] || item.label) || item.label}
            </button>
          ))}
        </nav>

        <div className="relative z-20 ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <ConnectWallet className="text-sm" />
          {(user || connected) && (
            <button
              type="button"
              onClick={() => goTo("/upload")}
              className="btn-accent-ghost hidden text-sm sm:inline-flex"
            >
              {t("share_work")}
            </button>
          )}
          <NotificationDropdown />
          <button
            type="button"
            onClick={() => goTo(isAuthenticated ? "/profile" : "/")}
            className="hidden h-8 w-8 overflow-hidden rounded-full bg-[var(--bg-subtle)] ring-1 ring-[var(--border-dim)] sm:block"
            aria-label="Profile"
          >
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                {(user?.displayName || user?.username || "?")[0]?.toUpperCase()}
              </span>
            )}
          </button>
          <button
            type="button"
            className="rounded-md p-2 lg:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="border-t border-[var(--border-dim)] px-4 py-3 lg:px-8">
          <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-3">
            <button type="button" className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </button>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                placeholder="Search Forge…"
                className="input pl-11"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
            <UploadIconButton />
          </div>
        </div>
      )}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden bg-black/50"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-0 right-0 h-full w-3/4 max-w-[280px] bg-[var(--bg-elevated)] shadow-xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <span className="font-semibold text-lg">{t("menu") || "Menu"}</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2">
                ✕
              </button>
            </div>

            <div className="space-y-1">
              {HEADER_NAV.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item)}
                  className={cn(
                    "block w-full text-left py-3 px-4 rounded-lg font-semibold text-base transition",
                    isNavActive(pathname, item)
                      ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  )}
                >
                  {t(NAV_I18N[item.key] || item.label) || item.label}
                </button>
              ))}
            </div>


          </div>
        </div>
      )}
    </header>
  );
}