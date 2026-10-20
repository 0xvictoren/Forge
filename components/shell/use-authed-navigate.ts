"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAppStore } from "@/lib/store";
import { ensureSessionForNav, routeNeedsSession, stashAuthReturn } from "@/lib/navigate-with-auth";
import { useSignInSheet } from "@/components/auth/sign-in-sheet";

/**
 * Make sure a wallet session exists (connecting + signing in if needed).
 * Resolves to true once the user is signed in.
 */
export function useEnsureSession() {
  const { user, setUser, setWallet } = useAppStore();
  const { connected, account, signMessage } = useWallet();
  const showSignIn = useSignInSheet((s) => s.show);

  return useCallback(async () => {
    if (user) return true;
    if (!connected) {
      showSignIn();
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
  }, [user, setUser, setWallet, connected, account, signMessage, showSignIn]);
}

/**
 * Navigate to a route, creating a wallet session first when the route is
 * protected. If no wallet is connected the destination is remembered and the
 * user is asked to connect - they land there right after.
 */
export function useAuthedNavigate() {
  const router = useRouter();
  const { user, setUser, setWallet } = useAppStore();
  const { connected, account, signMessage } = useWallet();
  const showSignIn = useSignInSheet((s) => s.show);

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
      if (!connected) showSignIn();
      return false;
    },
    [router, user, setUser, setWallet, connected, account, signMessage, showSignIn]
  );
}
