import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ProfileSidebar } from "@/components/layout/profile-sidebar";
import { AuthRedirectNotice } from "@/components/auth/auth-redirect-notice";

export type ShellLayoutProps = {
  children: React.ReactNode;
  showSearch?: boolean;
  showSidebar?: boolean;
  showFooter?: boolean;
  showBottomNav?: boolean;
  /** When false, main uses overflow-hidden (e.g. chat split pane). */
  contentScrollable?: boolean;
  mainClassName?: string;
};

export function ShellLayout({
  children,
  showSearch = true,
  showSidebar = false,
  showFooter = true,
  showBottomNav = true,
  contentScrollable = true,
  mainClassName,
}: ShellLayoutProps) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]">
      <div className="z-50 shrink-0">
        <SiteHeader showSearch={showSearch} />
        <Suspense fallback={null}>
          <AuthRedirectNotice />
        </Suspense>
      </div>

      <div className="flex min-h-0 flex-1">
        <main
          className={cn(
            "min-h-0 flex-1",
            contentScrollable
              ? "overflow-y-auto overscroll-y-contain"
              : "flex flex-col overflow-hidden",
            mainClassName
          )}
        >
          {children}
        </main>
        {showSidebar && <ProfileSidebar />}
      </div>

      {showFooter && (
        <div className="z-40 shrink-0">
          <SiteFooter />
        </div>
      )}

      {showBottomNav && <BottomNav />}
    </div>
  );
}