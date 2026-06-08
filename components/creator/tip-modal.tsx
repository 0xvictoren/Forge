"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { formatApt } from "@/lib/utils";
import { Check } from "lucide-react";

const PRESETS = [0.1, 0.5, 1, 5];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorHandle: string;
  creatorAddress: string;
}

export function TipModal({
  open,
  onOpenChange,
  creatorHandle,
  creatorAddress,
}: Props) {
  const [amount, setAmount] = useState(0.5);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const { transfer } = useAptTransfer();

  const sendTip = async () => {
    if (amount <= 0) return;
    setStatus("loading");
    setError("");
    try {
      const txHash = await transfer(creatorAddress, amount);
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorHandle,
          amountApt: amount,
          message: message.slice(0, 140),
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tip failed");
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Tip @${creatorHandle}`}>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`rounded-lg border px-4 py-2 text-sm ${
                amount === p
                  ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "border-[var(--border-dim)]"
              }`}
            >
              {formatApt(p, 1)}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm">
          Custom amount (APT)
          <input
            type="number"
            min={0.01}
            step={0.01}
            className="input mt-1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label className="mt-4 block text-sm">
          Message (optional)
          <textarea
            className="input mt-1 min-h-[80px]"
            maxLength={140}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Great work!"
          />
        </label>

        {status === "success" ? (
          <div className="mt-6 text-center">
            <Check className="mx-auto h-10 w-10 text-[var(--green)]" />
            <p className="mt-2">
              You tipped @{creatorHandle} {formatApt(amount, 2)}
            </p>
          </div>
        ) : (
          <>
            {error && <p className="mt-4 text-sm text-[var(--red)]">{error}</p>}
            <button
              type="button"
              className="btn-primary mt-6 w-full"
              disabled={status === "loading"}
              onClick={sendTip}
            >
              {status === "loading" ? "Sending…" : `Send ${formatApt(amount, 2)}`}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
