"use client";

import { usePathname } from "next/navigation";
import { ShellLayout } from "@/components/layout/shell-layout";

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const isChat = pathname.startsWith("/chat");
  const isFullBleed = isChat || pathname === "/onboarding";

  return (
    <ShellLayout
      showSearch={false}
      showSidebar
      contentScrollable={!isChat}
    >
      <div
        className={
          isFullBleed
            ? "flex h-full min-h-0 w-full flex-col"
            : "mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8"
        }
      >
        {title && (
          <h1 className="mb-6 font-serif text-2xl font-semibold">{title}</h1>
        )}
        {children}
      </div>
    </ShellLayout>
  );
}