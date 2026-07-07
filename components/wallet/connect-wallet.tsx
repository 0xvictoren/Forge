"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Copy, Check, LogOut, ChevronDown } from "lucide-react";
import { truncateAddress, formatApt } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { navigateToReturnPath } from "@/lib/auth-return-nav";
import { getAccountBalance } from "@/lib/aptos";
import { toast } from "sonner";

export function ConnectWallet({ className = "" }: { className?: string }) {
  const { connect, disconnect, account, connected, wallets } = useWallet();
  const { setUser, setWallet } = useAppStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const address = account?.address?.toString() ?? "";

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
        if (navigateToReturnPath(router)) return;
      }
    },
    [setUser, setWallet, router]
  );

  const handleConnect = useCallback(async () => {
    const wallet = wallets[0];
    if (!wallet) return;

    setLoading(true);
    try {
      await connect(wallet.name);
    } finally {
      setLoading(false);
    }
  }, [connect, wallets]);

  const handleDisconnect = useCallback(async () => {
    setMenuOpen(false);
    await disconnect();
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setWallet(null);
    toast.success("Wallet disconnected");
  }, [disconnect, setUser, setWallet]);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy address");
    }
  }, [address]);

  useEffect(() => {
    if (!connected || !address) return;
    syncSession(address);
  }, [connected, address, syncSession]);

  useEffect(() => {
    if (!menuOpen || !address) return;

    setBalanceLoading(true);
    getAccountBalance(address)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [menuOpen, address]);

  useEffect(() => {
    if (!menuOpen) return;

    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  if (connected && address) {
    return (
      <div className={`relative ${className}`} ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-ghost inline-flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          {truncateAddress(address)}
          <ChevronDown className={`h-3.5 w-3.5 transition ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--border-dim)] bg-[var(--bg-elevated)] p-3 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Wallet
            </p>
            <p className="mt-1 font-mono text-xs break-all text-[var(--text-secondary)]">
              {address}
            </p>

            <div className="mt-3 rounded-lg bg-[var(--bg-subtle)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">Balance</p>
              <p className="text-lg font-semibold">
                {balanceLoading
                  ? "…"
                  : balance != null
                    ? `${formatApt(balance, 4)} APT`
                    : "—"}
              </p>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={copyAddress}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
              >
                {copied ? <Check className="h-4 w-4 text-[var(--green)]" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy address"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--red)] hover:bg-[var(--bg-hover)]"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
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