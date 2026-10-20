"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Check, LogOut, ChevronDown, KeyRound, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { truncateAddress, formatApt } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { getAccountBalance } from "@/lib/aptos";
import { useForgeAuth } from "@/components/providers/forge-auth";
import { useSignInSheet } from "@/components/auth/sign-in-sheet";
import { toast } from "sonner";

/**
 * The account button. Signed out it opens the sign-in sheet; signed in it
 * shows the person's email (or wallet address) and a small account menu.
 */
export function ConnectWallet({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { disconnect, account, connected } = useWallet();
  const { setUser, setWallet } = useAppStore();
  const auth = useForgeAuth();
  const showSignIn = useSignInSheet((s) => s.show);
  const [menuOpen, setMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const address = account?.address?.toString() ?? "";
  const label = auth.isForgeAccount && auth.email ? auth.email : truncateAddress(address, compact ? 4 : 6, 4);

  const signOut = useCallback(async () => {
    setMenuOpen(false);
    if (auth.isForgeAccount) await auth.signOut();
    else {
      await disconnect();
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setWallet(null);
    }
    toast.success("Signed out");
  }, [auth, disconnect, setUser, setWallet]);

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(auth.isForgeAccount ? "Address copied. Send APT here to add funds." : "Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy address");
    }
  }, [address, auth.isForgeAccount]);

  useEffect(() => {
    if (!menuOpen || !address) return;
    getAccountBalance(address).then(setBalance).catch(() => setBalance(null));
  }, [menuOpen, address]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  if (!connected || !address) {
    return (
      <button type="button" onClick={showSignIn} className={`btn-primary ${compact ? "btn-sm h-9" : ""} ${className}`}>
        Sign in
      </button>
    );
  }

  const initial = (auth.email || address.slice(2, 3)).slice(0, 1).toUpperCase();
  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] hover:bg-[var(--bg-hover)]";

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full bg-[var(--bg-hover)] pl-1 pr-3 text-[14px] font-medium transition-colors hover:bg-[var(--bg-pressed)]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-white">{initial}</span>
        <span className="truncate tabular">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass glass-strong absolute right-0 top-full z-50 mt-2 w-72 origin-top-right rounded-[24px] p-2 text-[var(--text-primary)]"
          >
            <div className="px-3 pb-2 pt-3">
              <p className="truncate text-[15px] font-semibold">{auth.isForgeAccount && auth.email ? auth.email : "Wallet"}</p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{truncateAddress(address, 8, 6)}</p>
              <p className="mt-3 text-[12px] text-[var(--text-secondary)]">Balance</p>
              <p className="text-[22px] font-semibold tabular tracking-tight">{balance != null ? `${formatApt(balance, 4)} APT` : "…"}</p>
            </div>
            <div className="border-t border-[var(--border-dim)] pt-1">
              <button type="button" onClick={copyAddress} className={row}>
                {copied ? <Check className="h-4 w-4 text-[var(--green)]" /> : auth.isForgeAccount ? <Plus className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {auth.isForgeAccount ? "Add funds (copy address)" : "Copy address"}
              </button>
              {auth.isForgeAccount && (
                <button type="button" onClick={() => void auth.exportKey()} className={row}>
                  <KeyRound className="h-4 w-4" /> Back up private key
                </button>
              )}
              <button type="button" onClick={signOut} className={`${row} text-[var(--red)]`}>
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
