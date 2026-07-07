"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { formatApt } from "@/lib/utils";
import { Check } from "lucide-react";

export interface Tier {
  id: string;
  tierIndex: number;
  name: string;
  description?: string | null;
  priceApt: number;
  perks: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorHandle: string;
  creatorAddress: string;
  tiers: Tier[];
}

export function SubscribeModal({
  open,
  onOpenChange,
  creatorHandle,
  creatorAddress,
  tiers,
}: Props) {
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const { transfer } = useAptTransfer();

  const tier = tiers[selected];
  if (!tier) return null;

  const subscribe = async () => {
    setStatus("loading");
    setError("");
    try {
      const txHash = await transfer(creatorAddress, tier.priceApt);
      const res = await fetch("/api/subscriptions/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorHandle,
          tierIndex: tier.tierIndex,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Subscribe failed");
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Subscribe to @${creatorHandle}`}>
        <div className="mt-4 space-y-3">
          {tiers.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(i)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                selected === i
                  ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                  : "border-[var(--border-dim)] hover:border-[var(--border-default)]"
              }`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{t.name}</span>
                <span className="text-[var(--accent)]">
                  {formatApt(t.priceApt, 2)}/mo
                </span>
              </div>
              {t.description && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {t.description}
                </p>
              )}
              <ul className="mt-2 flex flex-wrap gap-1">
                {t.perks.map((p) => (
                  <li key={p} className="badge badge-sub">
                    {p}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {status === "success" ? (
          <div className="mt-6 flex flex-col items-center py-4 text-center">
            <Check className="h-10 w-10 text-[var(--green)]" />
            <p className="mt-2 font-display text-lg">Subscribed!</p>
          </div>
        ) : (
          <>
            {error && (
              <p className="mt-4 text-sm text-[var(--red)]">{error}</p>
            )}
            <button
              type="button"
              className="btn-primary mt-6 w-full"
              disabled={status === "loading"}
              onClick={subscribe}
            >
              {status === "loading"
                ? "Processing…"
                : `Subscribe for ${formatApt(tier.priceApt, 2)}/month`}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
