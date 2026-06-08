"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { AUTH_RETURN_KEY } from "@/lib/nav-config";

export function ConnectWallet({ className = "" }: { className?: string }) {
  const { connect, disconnect, account, connected, wallets } = useWallet();
  const { setUser, setWallet } = useAppStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const syncSession = useCallback(
    async (walletAddress: string) => {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setWallet(walletAddress);

        const returnPath = sessionStorage.getItem(AUTH_RETURN_KEY);
        if (returnPath && returnPath !== window.location.pathname) {
          sessionStorage.removeItem(AUTH_RETURN_KEY);
          router.push(returnPath);
        }
      }
    },
    [setUser, setWallet, router]
  );

  const handleConnect = useCallback(async () => {
    if (connected && account?.address) {
      await disconnect();
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setWallet(null);
      return;
    }

    const wallet = wallets[0];
    if (!wallet) return;

    setLoading(true);
    try {
      await connect(wallet.name);
    } finally {
      setLoading(false);
    }
  }, [connected, account, connect, disconnect, wallets, setUser, setWallet]);

  useEffect(() => {
    if (!connected || !account?.address) return;
    syncSession(account.address.toString());
  }, [connected, account?.address, syncSession]);

  if (connected && account?.address) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        className={`btn-ghost ${className}`}
      >
        <Wallet className="h-4 w-4" />
        {truncateAddress(account.address.toString())}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={loading}
      className={`btn-primary ${className}`}
    >
      <Wallet className="h-4 w-4" />
      {loading ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
