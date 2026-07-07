"use client";

import { AppShell } from "./app-shell";

export function WalletAwareLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}