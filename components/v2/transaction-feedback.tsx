"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export type TxStatus = "idle" | "pending" | "verifying" | "success" | "error";

export function TransactionFeedback({
  status,
  message,
}: {
  status: TxStatus;
  message?: string;
}) {
  if (status === "idle") return null;

  const config = {
    pending: {
      icon: Loader2,
      spin: true,
      color: "text-[var(--accent)]",
      label: "Sending transaction…",
      defaultMsg: "Confirm the payment in your wallet.",
    },
    verifying: {
      icon: Loader2,
      spin: true,
      color: "text-[var(--accent)]",
      label: "Verifying payment…",
      defaultMsg: "Checking onchain transaction on ShelbyNet.",
    },
    success: {
      icon: CheckCircle2,
      spin: false,
      color: "text-[var(--green)]",
      label: "Purchase complete!",
      defaultMsg: "Asset added to your Library. Certificate issued.",
    },
    error: {
      icon: XCircle,
      spin: false,
      color: "text-[var(--red)]",
      label: "Transaction failed",
      defaultMsg: "Something went wrong. Please try again.",
    },
  }[status];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[var(--border-dim)] bg-[var(--bg-subtle)] p-4 text-sm">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.color} ${config.spin ? "animate-spin" : ""}`} />
      <div>
        <p className="font-medium">{config.label}</p>
        <p className="mt-0.5 text-[var(--text-secondary)]">{message || config.defaultMsg}</p>
      </div>
    </div>
  );
}