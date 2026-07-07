"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { parseJsonResponse } from "@/lib/fetch-json";
import type { SessionUser } from "@/lib/auth";
import { getStoredReturnPath, navigateToReturnPath } from "@/lib/auth-return-nav";

/** Keeps JWT session in sync when the wallet auto-connects. */
export function WalletSessionSync() {
  const router = useRouter();
  const { connected, account } = useWallet();
  const { user, setUser, setWallet } = useAppStore();
  const syncing = useRef(false);
  const syncedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !account?.address) {
      syncedAddress.current = null;
      return;
    }

    const walletAddress = account.address.toString();
    if (user || syncing.current || syncedAddress.current === walletAddress) return;

    syncing.current = true;

    fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, address: walletAddress }),
    })
      .then(async (res) => {
        const data = await parseJsonResponse<{ user?: SessionUser; error?: string }>(res);
        if (data.user) {
          syncedAddress.current = walletAddress;
          setUser(data.user);
          setWallet(walletAddress);
          if (getStoredReturnPath()) {
            navigateToReturnPath(router);
          }
        } else if (!res.ok) {
          console.error("Session sync failed:", data.error);
        }
      })
      .catch((err) => console.error("Session sync error:", err))
      .finally(() => {
        syncing.current = false;
      });
  }, [connected, account?.address, user, setUser, setWallet, router]);

  return null;
}