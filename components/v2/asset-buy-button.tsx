"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { useState } from "react";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { toast } from "sonner";
import { TransactionFeedback, type TxStatus } from "./transaction-feedback";

export function AssetBuyButton({
  assetId,
  priceApt,
  creatorWallet,
  title,
  compact = false,
}: {
  assetId: string;
  priceApt: number;
  creatorWallet: string;
  title: string;
  compact?: boolean;
}) {
  const { connected, account } = useWallet();
  const { transfer } = useAptTransfer();
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState<string>();

  const buy = async () => {
    if (!connected || !account || !creatorWallet) return;
    setTxStatus("pending");
    setTxMessage(undefined);
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const txHash = await transfer(creatorWallet, priceApt, {
        expireTimestamp: nowSec + 120,
        gasUnitPrice: 100,
        maxGasAmount: 300_000,
      });

      setTxStatus("verifying");
      const res = await fetch(`/api/assets/${assetId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash,
          walletAddress: account.address.toString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");

      setTxStatus("success");
      toast.success(`You own "${title}"!`);
      if (data.verificationUrl) {
        setTimeout(() => {
          window.location.href = data.verificationUrl;
        }, 1500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed";
      setTxStatus("error");
      setTxMessage(msg);
      toast.error(msg);
    }
  };

  if (priceApt <= 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">This asset is free.</p>
    );
  }

  if (!connected) {
    return <ConnectWallet className={compact ? "w-full justify-center text-sm py-2" : "w-full justify-center"} />;
  }

  const loading = txStatus === "pending" || txStatus === "verifying";

  return (
    <div>
      <button
        type="button"
        className={compact ? "btn-primary w-full py-2 text-sm" : "btn-primary w-full"}
        onClick={buy}
        disabled={loading}
      >
        {loading ? "Processing…" : compact ? `Buy · ${priceApt} APT` : `Buy for ${priceApt} APT`}
      </button>
      {!compact && <TransactionFeedback status={txStatus} message={txMessage} />}
    </div>
  );
}