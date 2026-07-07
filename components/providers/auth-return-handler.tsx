"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { AUTH_RETURN_KEY } from "@/lib/nav-config";
import { normalizeReturnPath } from "@/lib/auth-redirect";
import {
  clearReturnFromUrl,
  getStoredReturnPath,
  navigateToReturnPath,
} from "@/lib/auth-return-nav";

/** After wallet login, send the user to the page they originally requested. */
export function AuthReturnHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppStore();
  const { connected } = useWallet();
  const redirected = useRef(false);

  useEffect(() => {
    const queryReturn = normalizeReturnPath(searchParams.get("return"));
    if (queryReturn) {
      sessionStorage.setItem(AUTH_RETURN_KEY, queryReturn);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user || !connected || redirected.current) return;

    const target = getStoredReturnPath();
    if (!target) return;

    redirected.current = true;
    const didNavigate = navigateToReturnPath(router);
    if (!didNavigate) {
      clearReturnFromUrl(router);
    }
  }, [user, connected, router]);

  return null;
}