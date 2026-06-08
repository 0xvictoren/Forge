"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, MessageSquare, Wallet, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "./site-header";
import { ProfileSidebar } from "./profile-sidebar";
import { SIDEBAR_NAV, isNavActive } from "@/lib/nav-config";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import {
  ensureSessionForNav,
  routeNeedsSession,
  stashAuthReturn,
} from "@/lib/navigate-with-auth";

const ICONS = {
  home: Home,
  wallet: Wallet,
  messages: MessageSquare,
} as const;

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, setWallet } = useAppStore();
  const { connected, account } = useWallet();
  const walletAddress = account?.address?.toString();

  const goTo = async (href: string) => {
    if (routeNeedsSession(href)) {
      const sessionUser = await ensureSessionForNav({
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
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader showSearch={false} />
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden w-52 shrink-0 border-r border-[var(--border-dim)] py-6 pl-4 lg:block">
          <nav className="space-y-1">
            {SIDEBAR_NAV.map((item) => {
              const Icon = ICONS[item.key as keyof typeof ICONS] ?? Home;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goTo(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold",
                    isNavActive(pathname, item)
                      ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => goTo("/upload")}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold",
                pathname === "/upload"
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          {title && (
            <h1 className="mb-6 font-serif text-2xl font-semibold">{title}</h1>
          )}
          {children}
        </main>
        <ProfileSidebar />
      </div>
    </div>
  );
}
