"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { PrivyProvider, usePrivy, type User as PrivyUser } from "@privy-io/react-auth";
import { useCreateWallet, useExportWallet, useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { FORGE_ACCOUNT_WALLET, forgeAccountWallet } from "@/lib/privy/forge-account-wallet";
import { useAppStore } from "@/lib/store";
import { getStoredReturnPath, navigateToReturnPath } from "@/lib/auth-return-nav";
import { useRouter } from "next/navigation";
import { WalletProvider } from "./wallet-provider";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

type ForgeAuth = {
  /** Email sign-in is available (Privy is configured). */
  emailEnabled: boolean;
  ready: boolean;
  /** Signed in with email (or Google) through a Forge account. */
  isForgeAccount: boolean;
  email: string | null;
  signInWithEmail: () => void;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  exportKey: () => Promise<void>;
};

const noop = async () => undefined;
const Ctx = createContext<ForgeAuth>({
  emailEnabled: false,
  ready: true,
  isForgeAccount: false,
  email: null,
  signInWithEmail: () => undefined,
  signInWithGoogle: () => undefined,
  signOut: noop,
  exportKey: noop,
});

export const useForgeAuth = () => useContext(Ctx);

/** Privy's Aptos key, normalised to 32 bytes of hex. */
function aptosWalletOf(user: PrivyUser | null) {
  const w = user?.linkedAccounts.find((a) => a.type === "wallet" && "chainType" in a && a.chainType === "aptos") as
    | { address: string; publicKey?: string }
    | undefined;
  if (!w?.publicKey) return null;
  const hex = w.publicKey.replace(/^0x/, "");
  return { address: w.address, publicKey: `0x${hex.slice(-64)}` };
}

function Bridge({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();
  const { exportWallet } = useExportWallet();
  const { connect, disconnect, connected, wallet } = useWallet();
  const { user: sessionUser, setUser, setWallet } = useAppStore();
  const busy = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const adapterWallet = forgeAccountWallet();
    if (!authenticated) {
      adapterWallet.setSigner(null);
      if (connected && wallet?.name === FORGE_ACCOUNT_WALLET) void disconnect();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    (async () => {
      let aptos = aptosWalletOf(user);
      if (!aptos) {
        const created = await createWallet({ chainType: "aptos" });
        aptos = aptosWalletOf(created.user);
      }
      if (!aptos) throw new Error("Could not create your Forge account");
      const { address, publicKey } = aptos;
      adapterWallet.setSigner({
        address,
        publicKey,
        signRawHash: async (hash) => (await signRawHash({ address, chainType: "aptos", hash })).signature,
      });

      if (sessionUser?.walletAddress?.toLowerCase() !== address.toLowerCase()) {
        const res = await fetch("/api/auth/privy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: await getAccessToken() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Sign-in failed");
        setUser(data.user);
        setWallet(address);
        if (getStoredReturnPath()) navigateToReturnPath(router);
      }
      if (!connected || wallet?.name !== FORGE_ACCOUNT_WALLET) await connect(FORGE_ACCOUNT_WALLET);
    })()
      .catch((e) => console.error("[forge-auth]", e))
      .finally(() => {
        busy.current = false;
      });
  }, [ready, authenticated, user, connected, wallet, sessionUser, createWallet, signRawHash, connect, disconnect, getAccessToken, setUser, setWallet, router]);

  const value = useMemo<ForgeAuth>(() => {
    const aptos = aptosWalletOf(user);
    const email = user?.email?.address ?? user?.google?.email ?? null;
    return {
      emailEnabled: true,
      ready,
      isForgeAccount: authenticated && connected && wallet?.name === FORGE_ACCOUNT_WALLET,
      email,
      signInWithEmail: () => login({ loginMethods: ["email"] }),
      signInWithGoogle: () => login({ loginMethods: ["google"] }),
      signOut: async () => {
        forgeAccountWallet().setSigner(null);
        try {
          if (connected) await disconnect();
        } catch {
          /* already disconnected */
        }
        await logout();
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setWallet(null);
      },
      exportKey: async () => {
        if (aptos) await exportWallet({ address: aptos.address });
      },
    };
  }, [user, ready, authenticated, connected, wallet, login, logout, disconnect, exportWallet, setUser, setWallet]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Email sign-in. Wraps the wallet adapter so a Privy login becomes a normal
 * connected wallet ("Forge account") everywhere in the app. Renders children
 * untouched when NEXT_PUBLIC_PRIVY_APP_ID is not set.
 */
export function ForgeAuthProvider({ children }: { children: React.ReactNode }) {
  if (!APP_ID) return <WalletProvider>{children}</WalletProvider>;
  forgeAccountWallet();
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          accentColor: "#F4770A",
          logo: "/logo.webp",
          landingHeader: "Sign in to Forge",
          loginMessage: "No wallet needed. We'll email you a code.",
        },
        embeddedWallets: { ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "off" }, showWalletUIs: false },
      }}
    >
      <WalletProvider>
        <Bridge>{children}</Bridge>
      </WalletProvider>
    </PrivyProvider>
  );
}
