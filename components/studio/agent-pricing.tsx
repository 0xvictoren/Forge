"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpRight, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassSwitch } from "@/components/glass/glass-switch";
import type { ReadPricing } from "@/lib/agents/pricing";
import { getExplorerUrl } from "@/lib/aptos";

export function AgentPricingEditor({ value, onChange }: { value: ReadPricing; onChange: (next: ReadPricing) => void }) {
  return (
    <div className="rounded-[22px] border border-[var(--border-default)] p-5 transition-colors" style={value.enabled ? { borderColor: "var(--accent-border)" } : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent-ink)]">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[16px] font-semibold">Pay-per-read for agents</p>
            <p className="text-[14px] text-[var(--text-secondary)]">AI agents read any byte range on demand and pay through a Shelby micropayment channel.</p>
          </div>
        </div>
        <GlassSwitch checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} label="Enable pay-per-read" />
      </div>
      <AnimatePresence initial={false}>
        {value.enabled && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-3 pt-5 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="ppr-gb">Price per GB</label>
                <div className="relative">
                  <input id="ppr-gb" type="number" min={0} step="0.01" className="field pr-14 tabular" value={value.pricePerGbApt} onChange={(e) => onChange({ ...value, pricePerGbApt: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[var(--text-muted)]">APT</span>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="ppr-min">Minimum per read</label>
                <div className="relative">
                  <input id="ppr-min" type="number" min={0} step="0.0001" className="field pr-14 tabular" value={value.minChargeApt} onChange={(e) => onChange({ ...value, minChargeApt: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[var(--text-muted)]">APT</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-[var(--text-muted)]">
              Every read is licensed (Metered), fingerprinted and logged. Earnings settle to your wallet automatically, minus the 5% platform fee.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AgentPricingPanel({ datasetId, initial }: { datasetId: string; initial: ReadPricing }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  return (
    <div>
      <AgentPricingEditor value={value} onChange={setValue} />
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setValue(initial)} className="btn-secondary btn-sm">
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              className="btn-primary btn-sm"
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await fetch(`/api/datasets/${datasetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readPricing: value }) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Save failed");
                  toast.success(value.enabled ? "Pay-per-read is live" : "Pay-per-read turned off");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Save failed");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Earnings = {
  reads: number;
  accrued: string;
  awaitingSettlement: string;
  readyToPay: string;
  payouts: { id: string; status: string; net: string; reads: number; txHash: string | null; error: string | null; createdAt: string }[];
};

/** Seller-wide agent earnings with an on-demand payout. */
export function AgentEarnings() {
  const [data, setData] = useState<Earnings | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/studio/agent-payouts").then((r) => r.json()).then(setData).catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);

  if (!data) return <div className="skeleton-shimmer h-28 rounded-[22px]" />;
  const pending = Number(data.awaitingSettlement) + Number(data.readyToPay);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Paid reads", data.reads.toLocaleString()],
          ["Earned (gross)", `${data.accrued} APT`],
          ["Unpaid", `${(pending || 0).toLocaleString(undefined, { maximumFractionDigits: 8 })} APT`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[18px] bg-[var(--bg-surface)] p-3">
            <p className="text-[12px] text-[var(--text-secondary)]">{k}</p>
            <p className="mt-0.5 text-[16px] font-semibold tabular">{v}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={busy || pending <= 0}
        className="btn-primary btn-sm mt-4 w-full"
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/studio/agent-payouts", { method: "POST" });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Payout failed");
            const paid = (body.payouts as { txHash?: string; error?: string }[]).filter((p) => p.txHash);
            const failed = [...body.withdrawals, ...body.payouts].filter((x: { error?: string }) => x.error);
            if (paid.length) toast.success("Paid to your wallet");
            else if (failed.length) toast.error(failed[0].error);
            else toast.message("Nothing ready to pay yet");
            await load();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Payout failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Settle and pay me now
      </button>
      {data.payouts.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--border-dim)] text-[13px]">
          {data.payouts.slice(0, 5).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
              <span>
                <span className="font-medium tabular">{p.net} APT</span> <span className="text-[var(--text-muted)]">· {p.reads} reads</span>
              </span>
              {p.txHash ? (
                <a href={getExplorerUrl(p.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent-ink)]">
                  Paid <ArrowUpRight className="h-3 w-3" />
                </a>
              ) : (
                <span className={p.status === "FAILED" ? "text-[var(--red)]" : "text-[var(--text-muted)]"}>{p.status.toLowerCase()}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="caption mt-3">
        Settlement also runs every hour. <Link href="/agents" className="text-[var(--accent-ink)]">How agent payments work</Link>
      </p>
    </div>
  );
}
