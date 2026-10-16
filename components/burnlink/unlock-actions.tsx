"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { useState, useMemo } from "react";
import { PLATFORM_FEE_BPS, PLATFORM_ADDRESS } from "@/lib/constants";
import { toast } from "sonner";
import { useForgePurchase } from "@/lib/use-forge-purchase";
import { parseJsonResponse } from "@/lib/fetch-json";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import { ACCESS_DENIED_MESSAGE, isWalletAllowed } from "@/lib/wallet-access";
import { requestPaymentIntent } from "@/lib/client-payment-intent";

interface Props {
  slug: string;
  priceApt: number;
  creatorWallet: string;
  walletGated?: boolean;
  allowedWallets?: string[];
}

function normalizeWallet(addr: string) {
  try {
    return AccountAddress.fromString(addr).toString().toLowerCase();
  } catch {
    return addr.trim().toLowerCase();
  }
}

type UnlockResponse = {
  success?: boolean;
  viewToken?: string;
  token?: string;
  redirect?: string;
  error?: string;
};

export function UnlockActions({
  slug,
  priceApt,
  creatorWallet,
  walletGated = false,
  allowedWallets = [],
}: Props) {
  const { account, connected } = useWallet();
  const { settlePurchase } = useForgePurchase();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  const walletNorm = connected && account ? normalizeWallet(account.address.toString()) : "";
  const creatorNorm = creatorWallet ? normalizeWallet(creatorWallet) : "";
  const isOwner = !!(creatorNorm && walletNorm && walletNorm === creatorNorm);

  const hasAccess = useMemo(() => {
    if (!walletGated || allowedWallets.length === 0) return true;
    if (!connected || !walletNorm) return true;
    return isWalletAllowed(walletNorm, allowedWallets, {
      walletGated,
      ownerWallet: creatorWallet,
    });
  }, [walletGated, allowedWallets, connected, walletNorm, creatorWallet]);

  const callUnlock = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/burnlinks/${slug}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse<UnlockResponse>(res);
    if (!res.ok) {
      throw new Error(data.error || "Unlock failed");
    }

    const token = data.viewToken || data.token;
    const redirect = data.redirect || (token ? `/view/${slug}?token=${token}` : null);
    if (!redirect) {
      throw new Error("Unlock succeeded but no access token returned");
    }
    return redirect;
  };

  const handleUnlock = async () => {
    if (!connected || !account) return;
    if (!hasAccess) return;

    setStatus("loading");
    setError("");

    try {
      if (isOwner) {
        const redirect = await callUnlock({});
        toast.success("Owner access, opening file…");
        window.location.href = redirect;
        return;
      }

      let txHash: string | undefined;
      let intentId: string | undefined;

      if (priceApt > 0) {
        if (!creatorWallet) {
          throw new Error("Creator wallet not configured");
        }
        const intent = await requestPaymentIntent("BURNLINK", slug);
        intentId = intent.id;
        txHash = await settlePurchase(intent);
        toast.info("Transaction submitted, verifying on ShelbyNet…");
      }

      const redirect = await callUnlock({
        txHash,
        intentId,
      });

      toast.success("Payment successful! Unlocking file…");
      setStatus("done");
      window.location.href = redirect;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unlock failed";
      setError(message);
      toast.error(message);
      setStatus("idle");
    }
  };

  const feePct = PLATFORM_FEE_BPS / 100;

  if (connected && !hasAccess && !isOwner) {
    return (
      <div className="mt-8 rounded-2xl border border-[var(--red)]/30 bg-[var(--red)]/5 p-4 text-center">
        <p className="font-medium text-[var(--red)]">{ACCESS_DENIED_MESSAGE}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Your wallet is not on the creator&apos;s whitelist.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      {!connected ? (
        <ConnectWallet className="w-full justify-center" />
      ) : (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={handleUnlock}
          disabled={status === "loading"}
        >
          {status === "loading"
            ? "Processing…"
            : isOwner
              ? "Open your file (free)"
              : priceApt > 0
                ? `Pay ${priceApt} APT + Unlock`
                : status === "done"
                  ? "Unlocked ✓"
                  : "Unlock Now"}
        </button>
      )}
      {error && <p className="text-center text-sm text-[var(--red)]">{error}</p>}
      {priceApt > 0 && creatorWallet && !isOwner && (
        <p className="text-center text-xs text-[var(--text-muted)]">
          {priceApt} APT total · includes {feePct}% platform fee (
          {PLATFORM_ADDRESS
            ? `${PLATFORM_ADDRESS.slice(0, 6)}…${PLATFORM_ADDRESS.slice(-4)}`
            : "set NEXT_PUBLIC_PLATFORM_ADDRESS"}
          )
        </p>
      )}
    </div>
  );
}
