"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Mail, Wallet, X } from "lucide-react";
import { create } from "zustand";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useForgeAuth } from "@/components/providers/forge-auth";
import { FORGE_ACCOUNT_WALLET } from "@/lib/privy/forge-account-wallet";
import { ForgeMark } from "@/components/shell/forge-mark";
import { cn } from "@/lib/utils";

export const useSignInSheet = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
    </svg>
  );
}

/**
 * The one sign-in surface. Email first: most people have never used a
 * wallet. Wallets stay one tap away for people who have one.
 */
export function SignInSheet() {
  const { open, hide } = useSignInSheet();
  const auth = useForgeAuth();
  const { wallets, connect } = useWallet();
  const [showWallets, setShowWallets] = useState(!auth.emailEnabled);
  const external = wallets.filter((w) => w.name !== FORGE_ACCOUNT_WALLET);

  const pick = async (name: string) => {
    hide();
    try {
      await connect(name);
    } catch {
      /* dismissed in the wallet */
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? undefined : hide())}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-[420px] rounded-t-[32px] bg-[var(--bg-elevated)] px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-xl,0_24px_80px_rgba(0,0,0,0.25))] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[32px] sm:pb-7"
                initial={{ y: 40, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 40, opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[var(--bg-pressed)] sm:hidden" />
                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full bg-[var(--bg-hover)] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-pressed)]">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>

                <div className="flex flex-col items-center pt-4 text-center">
                  <ForgeMark size={34} />
                  <DialogPrimitive.Title className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">Sign in to Forge</DialogPrimitive.Title>
                  <p className="mt-1.5 max-w-[300px] text-[15px] leading-snug text-[var(--text-secondary)]">Sell and license data in minutes. No wallet or crypto needed.</p>
                </div>

                <div className="mt-7 space-y-2.5">
                  {auth.emailEnabled && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          hide();
                          auth.signInWithEmail();
                        }}
                        className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--accent)] text-[16px] font-semibold text-white transition-transform active:scale-[0.98]"
                      >
                        <Mail className="h-[18px] w-[18px]" /> Continue with email
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          hide();
                          auth.signInWithGoogle();
                        }}
                        className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--bg-hover)] text-[16px] font-semibold transition-transform hover:bg-[var(--bg-pressed)] active:scale-[0.98]"
                      >
                        <GoogleGlyph /> Continue with Google
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-5">
                  {auth.emailEnabled && (
                    <button
                      type="button"
                      onClick={() => setShowWallets((s) => !s)}
                      className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <Wallet className="h-4 w-4" /> I have an Aptos wallet
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showWallets && "rotate-180")} />
                    </button>
                  )}
                  <AnimatePresence initial={false}>
                    {showWallets && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--bg-surface)]">
                          {external.length ? (
                            external.map((w) => (
                              <button
                                key={w.name}
                                type="button"
                                onClick={() => pick(w.name)}
                                className="flex w-full items-center gap-3 border-b border-[var(--border-dim)] px-4 py-3 text-left text-[15px] font-medium last:border-0 hover:bg-[var(--bg-hover)]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={w.icon} alt="" className="h-7 w-7 rounded-lg" />
                                {w.name}
                              </button>
                            ))
                          ) : (
                            <a href="https://petra.app" target="_blank" rel="noreferrer" className="block px-4 py-3 text-[14px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                              No wallet found in this browser. Get Petra
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {auth.emailEnabled && (
                  <p className="mt-6 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
                    Email accounts get a secure Aptos account automatically. Forge pays the network fees.
                  </p>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
