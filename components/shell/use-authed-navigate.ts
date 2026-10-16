"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { ensureSessionForNav, routeNeedsSession, stashAuthReturn } from "@/lib/navigate-with-auth";

/**
 * Make sure a wallet session exists (connecting + signing in if needed).
 * Resolves to true once the user is signed in.
 */
export function useEnsureSession() {
  const { user, setUser, setWallet } = useAppStore();
  const { connected, account, signMessage, connect, wallets } = useWallet();

  return useCallback(async () => {
    if (user) return true;
    if (!connected) {
      if (!wallets[0]) {
        toast.error("Install an Aptos wallet (e.g. Petra) to continue");
        return false;
      }
      try {
        await connect(wallets[0].name);
      } catch {
        return false;
      }
      toast.message("Wallet connected, continue to sign in");
      return false;
    }
    const session = await ensureSessionForNav({
      connected,
      walletAddress: account?.address?.toString(),
      currentUser: user,
      setUser,
      setWallet,
      signMessage,
      publicKey: account?.publicKey,
    });
    return !!session;
  }, [user, setUser, setWallet, connected, account, signMessage, connect, wallets]);
}

/**
 * Navigate to a route, creating a wallet session first when the route is
 * protected. If no wallet is connected the destination is remembered and the
 * user is asked to connect - they land there right after.
 */
export function useAuthedNavigate() {
  const router = useRouter();
  const { user, setUser, setWallet } = useAppStore();
  const { connected, account, signMessage, connect, wallets } = useWallet();

  return useCallback(
    async (href: string) => {
      if (!routeNeedsSession(href)) {
        router.push(href);
        return true;
      }
      const session = await ensureSessionForNav({
        connected,
        walletAddress: account?.address?.toString(),
        currentUser: user,
        setUser,
        setWallet,
        signMessage,
        publicKey: account?.publicKey,
      });
      if (session) {
        router.push(href);
        return true;
      }
      stashAuthReturn(href);
      if (!connected && wallets[0]) {
        toast.message("Connect your wallet to continue");
        try {
          await connect(wallets[0].name);
        } catch {
          /* user dismissed */
        }
      } else if (!connected) {
        toast.error("Install an Aptos wallet (e.g. Petra) to continue");
      }
      return false;
    },
    [router, user, setUser, setWallet, connected, account, signMessage, connect, wallets]
  );
}
