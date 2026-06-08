"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { useState } from "react";
import { PLATFORM_FEE_BPS, PLATFORM_ADDRESS } from "@/lib/constants";
import { toast } from "sonner";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { parseJsonResponse } from "@/lib/fetch-json";
import { AccountAddress } from "@aptos-labs/ts-sdk";

interface Props {
  slug: string;
  priceApt: number;
  creatorWallet: string;
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

export function UnlockActions({ slug, priceApt, creatorWallet }: Props) {
  const { account, connected } = useWallet();
  const { transfer } = useAptTransfer();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

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
    setStatus("loading");
    setError("");

    const wallet = account.address.toString();
    const walletNorm = normalizeWallet(wallet);
    const creatorNorm = creatorWallet ? normalizeWallet(creatorWallet) : "";
    const isOwner = creatorNorm && walletNorm === creatorNorm;

    try {
      if (isOwner) {
        const redirect = await callUnlock({
          walletAddress: walletNorm,
          userAddress: walletNorm,
          ownerBypass: true,
        });
        toast.success("Owner access — opening file…");
        window.location.href = redirect;
        return;
      }

      let txHash: string | undefined;

      if (priceApt > 0) {
        if (!creatorWallet) {
          throw new Error("Creator wallet not configured");
        }
        const nowSec = Math.floor(Date.now() / 1000);
        txHash = await transfer(creatorWallet, priceApt, {
          expireTimestamp: nowSec + 120,
          gasUnitPrice: 100,
          maxGasAmount: 300_000,
        });
        toast.info("Transaction submitted — verifying on ShelbyNet…");
      }

      const redirect = await callUnlock({
        walletAddress: walletNorm,
        userAddress: walletNorm,
        txHash,
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
  const isOwner =
    connected &&
    account &&
    creatorWallet &&
    normalizeWallet(account.address.toString()) === normalizeWallet(creatorWallet);

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
          Full {priceApt} APT to creator · {feePct}% platform fee (
          {PLATFORM_ADDRESS
            ? `${PLATFORM_ADDRESS.slice(0, 6)}…${PLATFORM_ADDRESS.slice(-4)}`
            : "set NEXT_PUBLIC_PLATFORM_ADDRESS"}
          )
        </p>
      )}
    </div>
  );
}
