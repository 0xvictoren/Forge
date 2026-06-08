"use client";

import { Suspense, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { AuthReturnHandler } from "./auth-return-handler";

function AppProviderInner({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAppStore();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setUser, setLoading]);

  return (
    <>
      <Suspense fallback={null}>
        <AuthReturnHandler />
      </Suspense>
      {children}
    </>
  );
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <AppProviderInner>{children}</AppProviderInner>;
}
