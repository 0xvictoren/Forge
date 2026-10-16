"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { getStoredReturnPath, navigateToReturnPath } from "@/lib/auth-return-nav";
import { syncWalletSession } from "@/lib/sync-session";

/** Keeps JWT session in sync when the wallet auto-connects. */
export function WalletSessionSync() {
  const router = useRouter();
  const { connected, account, signMessage } = useWallet();
  const { user, setUser, setWallet } = useAppStore();
  const syncing = useRef(false);
  const syncedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !account?.address || !account.publicKey || !signMessage) {
      syncedAddress.current = null;
      return;
    }

    const walletAddress = account.address.toString();
    if (
      user?.walletAddress?.toLowerCase() === walletAddress.toLowerCase() ||
      syncing.current ||
      syncedAddress.current === walletAddress
    ) return;

    syncing.current = true;

    const authenticate = async () => {
      if (user) {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setWallet(null);
      }
      return syncWalletSession(walletAddress, signMessage, account.publicKey);
    };

    authenticate()
      .then((sessionUser) => {
        if (sessionUser) {
          syncedAddress.current = walletAddress;
          setUser(sessionUser);
          setWallet(walletAddress);
          if (getStoredReturnPath()) {
            navigateToReturnPath(router);
          }
        }
      })
      .catch((err) => console.error("Session sync error:", err))
      .finally(() => {
        syncing.current = false;
      });
  }, [connected, account, signMessage, user, setUser, setWallet, router]);

  return null;
}
