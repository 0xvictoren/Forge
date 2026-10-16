"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { useState } from "react";
import { useForgePurchase } from "@/lib/use-forge-purchase";
import { toast } from "sonner";
import { TransactionFeedback, type TxStatus } from "./transaction-feedback";
import { requestPaymentIntent } from "@/lib/client-payment-intent";

export function ProductBuyButton({
  productId,
  priceApt,
  creatorWallet,
  title,
}: {
  productId: string;
  priceApt: number;
  creatorWallet: string;
  title: string;
}) {
  const { connected, account } = useWallet();
  const { settlePurchase } = useForgePurchase();
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState<string>();

  const buy = async () => {
    if (!connected || !account || !creatorWallet) return;
    setTxStatus("pending");
    setTxMessage(undefined);
    try {
      const intent = await requestPaymentIntent("PRODUCT", productId);
      const txHash = await settlePurchase(intent);

      setTxStatus("verifying");
      const res = await fetch(`/api/products/${productId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash,
          intentId: intent.id,
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
    return <p className="text-sm text-[var(--text-secondary)]">This bundle is free.</p>;
  }

  if (!connected) return <ConnectWallet className="w-full justify-center" />;

  const loading = txStatus === "pending" || txStatus === "verifying";

  return (
    <div>
      <button
        type="button"
        className="btn-primary w-full"
        onClick={buy}
        disabled={loading}
      >
        {loading ? "Processing…" : `Buy bundle for ${priceApt} APT`}
      </button>
      <TransactionFeedback status={txStatus} message={txMessage} />
    </div>
  );
}
