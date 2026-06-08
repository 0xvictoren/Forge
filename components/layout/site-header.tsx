"use client";

import { Logo } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  Search,
  SlidersHorizontal,
  Menu,
} from "lucide-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { UploadIconButton } from "@/components/upload/upload-choice-modal";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { MAIN_NAV, isNavActive } from "@/lib/nav-config";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ensureSessionForNav,
  resolveAuthenticatedHref,
  routeNeedsSession,
  stashAuthReturn,
} from "@/lib/navigate-with-auth";

const NAV_I18N: Record<string, string> = {
  home: "nav_home",
  wallet: "nav_wallet",
  messages: "nav_messages",
  creators: "nav_creators",
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
    async (item: (typeof MAIN_NAV)[number]) => {
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
    <header className="sticky top-0 z-50 bg-[var(--bg-elevated)] shadow-sm">
      <div className="mx-auto flex h-[52px] max-w-[1760px] items-center gap-3 px-4 lg:gap-6 lg:px-8">
        <Logo />

        <nav
          className="relative z-20 flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-5"
          aria-label="Main"
        >
          {MAIN_NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item)}
              className={cn(
                "shrink-0 text-sm font-semibold hover:text-[var(--brand)]",
                isNavActive(pathname, item)
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-primary)]"
              )}
            >
              {t(NAV_I18N[item.key] || item.label)}
            </button>
          ))}
        </nav>

        <div className="relative z-20 ml-auto flex shrink-0 items-center gap-1">
          <LanguageSwitcher className="hidden sm:block" />
          <ConnectWallet className="text-sm" />
          {(user || connected) && (
            <>
              <button
                type="button"
                onClick={() => goTo("/upload")}
                className="btn-accent-ghost hidden text-sm sm:inline-flex"
              >
                {t("share_work")}
              </button>
              <button
                type="button"
                onClick={() => goTo("/chat")}
                className="hidden rounded-full p-2 hover:bg-[var(--bg-hover)] sm:block"
                aria-label="Messages"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </>
          )}
          <NotificationDropdown />
          <button
            type="button"
            onClick={() => goTo(isAuthenticated ? "/home" : "/")}
            className="hidden h-8 w-8 overflow-hidden rounded-full bg-[var(--bg-subtle)] ring-1 ring-[var(--border-dim)] sm:block"
            aria-label="Home"
          >
            {user?.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            )}
          </button>
          <button
            type="button"
            className="rounded-md p-2 sm:hidden"
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
        <nav className="border-t border-[var(--border-dim)] p-4 sm:hidden" aria-label="Mobile">
          <LanguageSwitcher className="mb-3 w-full" />
          {MAIN_NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item)}
              className={cn(
                "block w-full py-2 text-left font-semibold",
                isNavActive(pathname, item)
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-primary)]"
              )}
            >
              {t(NAV_I18N[item.key] || item.label)}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
