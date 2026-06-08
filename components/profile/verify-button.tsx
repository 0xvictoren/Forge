"use client";

import { useEffect, useState } from "react";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { useAppStore } from "@/lib/store";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function VerifyButton({ onVerified }: { onVerified?: () => void }) {
  const [cost, setCost] = useState(10);
  const [treasury, setTreasury] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const { transfer, connected, account } = useAptTransfer();
  const { setUser } = useAppStore();

  useEffect(() => {
    fetch("/api/verify")
      .then((r) => r.json())
      .then((d) => {
        setCost(d.costApt || 10);
        setTreasury(d.treasury || null);
        setConfigured(d.configured !== false && !!d.treasury);
      })
      .catch(() => {});
  }, []);

  const verify = async () => {
    if (!connected || !account) {
      setError("Connect your wallet first");
      setStatus("error");
      return;
    }
    if (!treasury || !configured) {
      setError("Platform treasury not configured");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const walletAddress = account.address.toString();
      const nowSec = Math.floor(Date.now() / 1000);
      const txHash = await transfer(treasury, cost, {
        expireTimestamp: nowSec + 120,
        gasUnitPrice: 100,
        maxGasAmount: 300_000,
      });

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (meData.user) setUser(meData.user);

      setStatus("done");
      toast.success("Profile verified!");
      onVerified?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  if (status === "done") {
    return (
      <div className="card mt-4 p-4 text-center">
        <BadgeCheck className="mx-auto h-8 w-8 text-[var(--brand)]" />
        <p className="mt-2 text-sm font-semibold">Verified!</p>
      </div>
    );
  }

  return (
    <div className="card mt-4 p-4">
      <div className="flex items-start gap-2">
        <BadgeCheck className="h-5 w-5 shrink-0 text-[var(--brand)]" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Verify your profile</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            One-time {cost} APT on-chain verification. Builds trust across Forge.
          </p>
          {error && <p className="mt-2 text-xs text-[var(--red)]">{error}</p>}
          <button
            type="button"
            className="btn-primary mt-3 w-full text-sm"
            disabled={status === "loading" || !connected || !configured}
            onClick={verify}
          >
            {status === "loading" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
              </span>
            ) : (
              `Verify Now · ${cost} APT`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
