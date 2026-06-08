"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { AUTH_RETURN_KEY } from "@/lib/nav-config";

/** After wallet login, send the user to the page they originally requested. */
export function AuthReturnHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppStore();
  const { connected } = useWallet();

  useEffect(() => {
    const queryReturn = searchParams.get("return");
    if (queryReturn) {
      sessionStorage.setItem(AUTH_RETURN_KEY, queryReturn);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
    const queryReturn = searchParams.get("return");
    const target = stored || queryReturn;

    if (!target || target === "/") return;

    sessionStorage.removeItem(AUTH_RETURN_KEY);

    if (window.location.pathname !== target) {
      router.replace(target);
    } else if (queryReturn) {
      const url = new URL(window.location.href);
      url.searchParams.delete("return");
      router.replace(url.pathname + url.search);
    }
  }, [user, router, searchParams]);

  return null;
}
