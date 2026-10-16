"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { Bot, Check, Copy, Download, KeyRound, Loader2, Plus, Timer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { GlassSegmented } from "@/components/glass/glass-segmented";
import { getAptosBrowserClient } from "@/lib/aptos-browser";
import { channelPayloads } from "@/lib/agent-client";
import { aptToOctasBig, octasToAptString } from "@/lib/agents/pricing";

type Config = { payment: { receiver: string; asset: string; symbol: string; micropaymentsModule: string } };
type ChannelState = { channelId: string; acceptedAmount: string; available: string; capacity: string; expiresAt: string } | null;

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--bg-terminal)] px-4 py-3 text-[#e5e5ea]">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
        <p className={`mono mt-0.5 truncate text-[12px] ${secret ? "text-[#FFB366]" : ""}`}>{value}</p>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function FundAgent() {
  const { connected, account, signAndSubmitTransaction, connect, wallets } = useWallet();
  const [config, setConfig] = useState<Config | null>(null);
  const [channel, setChannel] = useState<ChannelState | undefined>(undefined);
  const [budget, setBudget] = useState("1");
  const [hours, setHours] = useState<"24" | "72" | "168">("72");
  const [busy, setBusy] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ sender: string; key: string } | null>(null);
  const [topUp, setTopUp] = useState("0.5");
  const sender = account?.address?.toString();

  const refresh = useCallback(async () => {
    if (!sender) return setChannel(undefined);
    const res = await fetch(`/api/agent/channel?sender=${sender}`);
    const body = await res.json().catch(() => ({}));
    setChannel(res.ok ? (body.channel as ChannelState) : null);
  }, [sender]);

  useEffect(() => {
    fetch("/api/agent").then((r) => r.json()).then(setConfig).catch(() => undefined);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function send(data: Parameters<NonNullable<typeof signAndSubmitTransaction>>[0]["data"]) {
    if (!signAndSubmitTransaction) throw new Error("Wallet cannot sign transactions");
    const res = await signAndSubmitTransaction({ data });
    const hash = typeof res === "object" && res && "hash" in res ? String(res.hash) : "";
    await getAptosBrowserClient().waitForTransaction({ transactionHash: hash, options: { checkSuccess: true } });
    return hash;
  }

  async function fund() {
    if (!config || !sender) return;
    const amount = Number(budget);
    if (!(amount > 0)) return toast.error("Enter a budget");
    setBusy("fund");
    try {
      const m = config.payment.micropaymentsModule;
      const aptos = getAptosBrowserClient();
      // Initialise payment channels once per wallet.
      const initialised = await aptos
        .view({ payload: { function: `${m}::micropayments::get_next_channel_id`, functionArguments: [sender] } })
        .then(() => true)
        .catch(() => false);
      if (!initialised) await send(channelPayloads.initialize(m));
      const session = Account.generate();
      await send(
        channelPayloads.open(m, {
          receiver: config.payment.receiver,
          asset: config.payment.asset,
          depositOctas: aptToOctasBig(amount),
          expiresAtMs: Date.now() + Number(hours) * 3600_000,
          sessionPublicKey: session.publicKey.toUint8Array(),
        })
      );
      setCredentials({ sender, key: (session.privateKey as Ed25519PrivateKey).toString() });
      toast.success("Agent funded");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Funding failed";
      toast.error(/reject|cancel/i.test(msg) ? "Cancelled" : msg);
    } finally {
      setBusy(null);
    }
  }

  async function act(kind: "topup" | "extend" | "close") {
    if (!config || !channel) return;
    setBusy(kind);
    try {
      const m = config.payment.micropaymentsModule;
      const base = { receiver: config.payment.receiver, asset: config.payment.asset };
      if (kind === "topup") await send(channelPayloads.topUp(m, { ...base, amountOctas: aptToOctasBig(Number(topUp) || 0) }));
      if (kind === "extend") await send(channelPayloads.extend(m, { ...base, expiresAtMs: Math.max(Date.now(), new Date(channel.expiresAt).getTime()) + 72 * 3600_000 }));
      if (kind === "close") await send(channelPayloads.close(m, base));
      toast.success(kind === "topup" ? "Budget topped up" : kind === "extend" ? "Extended by 3 days" : "Channel closed, unspent funds returned");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      toast.error(/reject|cancel/i.test(msg) ? "Cancelled" : msg);
    } finally {
      setBusy(null);
    }
  }

  const envFile = credentials && config ? `FORGE_URL=${location.origin}\nFORGE_AGENT_SENDER=${credentials.sender}\nFORGE_AGENT_SESSION_KEY=${credentials.key}\n` : "";
  const expired = channel ? new Date(channel.expiresAt).getTime() < Date.now() : false;

  return (
    <div className="surface p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent-ink)]">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <h2 className="title">Fund an agent</h2>
          <p className="text-[14px] text-[var(--text-secondary)]">Give your agent a spending budget. It never sees your wallet.</p>
        </div>
      </div>

      {!connected ? (
        <button type="button" onClick={() => wallets[0] && connect(wallets[0].name)} className="btn-primary mt-6 w-full">
          <Wallet className="h-4 w-4" /> Connect wallet
        </button>
      ) : channel === undefined ? (
        <div className="skeleton-shimmer mt-6 h-32 rounded-[20px]" />
      ) : credentials ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-3">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--green)]">
            <Check className="h-4 w-4" /> Channel open. Give these to your agent:
          </p>
          <CopyRow label="FORGE_AGENT_SENDER" value={credentials.sender} />
          <CopyRow label="FORGE_AGENT_SESSION_KEY" value={credentials.key} secret />
          <p className="rounded-2xl bg-[var(--orange-dim)] px-4 py-3 text-[13px] text-[var(--orange)]">
            Shown once. The session key can only spend this channel&apos;s balance, but store it like a password.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([envFile], { type: "text/plain" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "forge-agent.env";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download .env
            </button>
            <button type="button" className="btn-plain btn-sm" onClick={() => setCredentials(null)}>
              Done
            </button>
          </div>
        </motion.div>
      ) : channel ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Available", `${octasToAptString(channel.available, 4)} ${config?.payment.symbol ?? ""}`],
              ["Spent", `${octasToAptString(channel.acceptedAmount, 4)} ${config?.payment.symbol ?? ""}`],
              ["Expires", expired ? "Expired" : new Date(channel.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[18px] bg-[var(--bg-surface)] p-3">
                <p className="text-[12px] text-[var(--text-secondary)]">{k}</p>
                <p className="mt-0.5 text-[15px] font-semibold tabular">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-32">
              <input className="field pr-12 tabular" type="number" min={0} step="0.1" value={topUp} onChange={(e) => setTopUp(e.target.value)} aria-label="Top-up amount" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)]">{config?.payment.symbol}</span>
            </div>
            <button type="button" disabled={!!busy || expired} onClick={() => act("topup")} className="btn-primary btn-sm">
              {busy === "topup" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Top up
            </button>
            <button type="button" disabled={!!busy} onClick={() => act("extend")} className="btn-secondary btn-sm">
              {busy === "extend" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Timer className="h-3.5 w-3.5" />} Extend 3 days
            </button>
            {expired && (
              <button type="button" disabled={!!busy} onClick={() => act("close")} className="btn-ghost btn-sm">
                Close and refund
              </button>
            )}
          </div>
          <p className="caption">
            One channel per wallet. The session key was shown when you opened it; to rotate it, let the channel expire, close it, and fund a new one.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="budget">Budget</label>
              <div className="relative">
                <input id="budget" className="field pr-14 tabular" type="number" min={0} step="0.1" value={budget} onChange={(e) => setBudget(e.target.value)} />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[var(--text-muted)]">{config?.payment.symbol ?? "APT"}</span>
              </div>
            </div>
            <div>
              <p className="field-label">Stays open for</p>
              <GlassSegmented
                size="sm"
                ariaLabel="Channel lifetime"
                value={hours}
                onChange={setHours}
                className="w-full"
                options={[
                  { value: "24", label: "1 day" },
                  { value: "72", label: "3 days" },
                  { value: "168", label: "1 week" },
                ]}
              />
            </div>
          </div>
          <button type="button" onClick={fund} disabled={!!busy || !config} className="btn-primary w-full">
            {busy === "fund" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Generate session key and fund
          </button>
          <p className="caption">Your wallet signs one or two transactions. Unspent funds return to you when the channel closes.</p>
        </div>
      )}
    </div>
  );
}
