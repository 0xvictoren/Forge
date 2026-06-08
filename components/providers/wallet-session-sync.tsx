"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { parseJsonResponse } from "@/lib/fetch-json";
import type { SessionUser } from "@/lib/auth";

/** Keeps JWT session in sync when the wallet auto-connects. */
export function WalletSessionSync() {
  const { connected, account } = useWallet();
  const { setUser, setWallet } = useAppStore();
  const syncing = useRef(false);
  const lastAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !account?.address) {
      lastAddress.current = null;
      return;
    }

    const walletAddress = account.address.toString();
    if (syncing.current || lastAddress.current === walletAddress) return;

    syncing.current = true;
    lastAddress.current = walletAddress;

    fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, address: walletAddress }),
    })
      .then(async (res) => {
        const data = await parseJsonResponse<{ user?: SessionUser; error?: string }>(res);
        if (data.user) {
          setUser(data.user);
          setWallet(walletAddress);
        } else if (!res.ok) {
          console.error("Session sync failed:", data.error);
        }
      })
      .catch((err) => console.error("Session sync error:", err))
      .finally(() => {
        syncing.current = false;
      });
  }, [connected, account?.address, setUser, setWallet]);

  return null;
}
