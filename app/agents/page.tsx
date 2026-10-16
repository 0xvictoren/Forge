import type { Metadata } from "next";
import { headers } from "next/headers";
import { BadgeCheck, Bot, Coins, Fingerprint, Network, ScrollText, Zap } from "lucide-react";
import { AppFrame } from "@/components/shell/app-frame";
import { Reveal } from "@/components/motion/reveal";
import { FundAgent } from "@/components/agents/fund-agent";
import { CodeTabs } from "@/components/agents/code-tabs";
import { AgentActivity } from "@/components/agents/agent-activity";

export const metadata: Metadata = { title: "Agents", description: "Let AI agents read licensed, provenance-sealed data and pay per byte through Shelby micropayment channels." };

const STEPS = [
  { icon: Coins, title: "Open one channel", body: "Fund a Shelby micropayment channel to Forge once. It registers a session key, so the agent never touches your wallet." },
  { icon: Zap, title: "Read anything, pay per byte", body: "Each read carries a signed offchain micropayment. No checkout, no per-read transaction, byte ranges supported." },
  { icon: ScrollText, title: "Licensed automatically", body: "The first paid read issues a Metered licence. Every byte is fingerprinted to it and shows up in compliance records." },
  { icon: BadgeCheck, title: "Sellers settle onchain", body: "Forge withdraws from channels in batches and pays each seller their share. Every payout is an Aptos transaction." },
];

export default async function AgentsPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <AppFrame wide>
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">For AI agents</p>
        <h1 className="display-xl mt-3">Data your agents can buy by the byte.</h1>
        <p className="lede mx-auto mt-4 max-w-2xl">
          Agents discover licensed datasets, check their onchain provenance, and read exactly what they need. Payment rides along with each request
          through Shelby micropayment channels.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.05} className="surface p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent-ink)]">
              <s.icon className="h-5 w-5" />
            </span>
            <h2 className="title mt-5">{s.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{s.body}</p>
          </Reveal>
        ))}
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_420px]">
        <Reveal className="min-w-0">
          <h2 className="title-lg">Quickstart</h2>
          <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
            Fund your agent on the right, then drop the credentials into any of these. The client handles quoting, signing and retries.
          </p>
          <div className="mt-5">
            <CodeTabs origin={origin} />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Network, k: "Discovery", v: `${origin}/api/agent` },
              { icon: Bot, k: "Catalog", v: `${origin}/api/agent/datasets` },
              { icon: Fingerprint, k: "Payment header", v: "X-Forge-Micropayment" },
            ].map((x) => (
              <div key={x.k} className="rounded-[20px] bg-[var(--bg-surface)] p-4">
                <x.icon className="h-4 w-4 text-[var(--accent-ink)]" />
                <p className="mt-3 text-[12px] text-[var(--text-secondary)]">{x.k}</p>
                <p className="mono mt-0.5 break-all text-[12px]">{x.v}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.08} className="lg:sticky lg:top-24 lg:self-start">
          <FundAgent />
        </Reveal>
      </div>

      <AgentActivity />

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {[
          { t: "Live feeds", b: "Subscribe to a dataset and get a signed webhook the moment a new version is sealed. Or poll /versions?since=N." },
          { t: "Provable memory", b: "Agents record memory checkpoints. Forge chains them by hash and anchors a Merkle root onchain every hour." },
          { t: "Storage you can check", b: "Proof pages and manifests show whether every sampled file is committed on Shelby, live." },
        ].map((x) => (
          <Reveal key={x.t} className="rounded-[24px] bg-[var(--bg-surface)] p-6">
            <h3 className="title">{x.t}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{x.b}</p>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-16 surface p-6 sm:p-8">
        <h2 className="title-lg">How a paid read works</h2>
        <ol className="mt-5 grid gap-5 text-[15px] sm:grid-cols-3">
          <li>
            <p className="font-semibold">1. Ask</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              <span className="mono text-[13px]">GET /api/agent/files/:id</span> without payment returns <span className="mono text-[13px]">402</span> with the price,
              the receiver, and the exact amount and sequence number to sign.
            </p>
          </li>
          <li>
            <p className="font-semibold">2. Sign</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              The agent signs a cumulative WithdrawApproval with its session key. Same format as Shelby&apos;s SDK, so one key works for both.
            </p>
          </li>
          <li>
            <p className="font-semibold">3. Read</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              Retry with <span className="mono text-[13px]">X-Forge-Micropayment</span>. Forge verifies it against the channel onchain, delivers the bytes, and only then
              records the charge.
            </p>
          </li>
        </ol>
      </Reveal>
    </AppFrame>
  );
}
