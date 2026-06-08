"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

export function WalletAwareLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/wallet")) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
