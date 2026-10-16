"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, Brain, Clock, Radio, ScrollText } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { formatBytes, shortHash } from "@/lib/datasets/modalities";

type Overview = {
  wallet: string | null;
  spend: { reads: number; bytes: number; total: string };
  licenses: { dataset: string; slug: string; certificate: string; status: string }[];
  vaults: { name: string; checkpoints: number; headHash: string; lastAt: string | null; lastAnchored: boolean }[];
  feeds: { id: string; dataset: string; slug: string | null; webhook: string; lastNotifiedVersion: number; lastDeliveryStatus: number | null }[];
};

/** The signed-in owner's view of their agent: spend, licences, memory, feeds. */
export function AgentActivity() {
  const user = useAppStore((s) => s.user);
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/agents/overview").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => undefined);
  }, [user]);

  if (!user || !data?.wallet) return null;
  const empty = !data.spend.reads && !data.vaults.length && !data.feeds.length && !data.licenses.length;

  return (
    <section className="surface mt-14 p-6 sm:p-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="title-lg">Your agent&apos;s activity</h2>
        <p className="mono text-[12px] text-[var(--text-muted)]">{shortHash(data.wallet, 8)}</p>
      </div>
      {empty ? (
        <p className="mt-4 text-[15px] text-[var(--text-secondary)]">Nothing yet. Once your agent reads data, remembers, or follows a dataset, it shows up here.</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)]">
              <ScrollText className="h-4 w-4" /> Paid reads
            </p>
            <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] tabular">{data.spend.total} APT</p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {data.spend.reads.toLocaleString()} reads · {formatBytes(data.spend.bytes)}
            </p>
            <ul className="mt-4 space-y-2">
              {data.licenses.map((l) => (
                <li key={l.certificate} className="flex items-center justify-between gap-2 text-[13px]">
                  <Link href={`/datasets/${l.slug}`} className="truncate hover:text-[var(--accent-ink)]">
                    {l.dataset}
                  </Link>
                  <Link href={l.certificate} className="shrink-0 text-[var(--accent-ink)]">
                    Licence
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)]">
              <Brain className="h-4 w-4" /> Memory vaults
            </p>
            {data.vaults.length === 0 ? (
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">No memory recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.vaults.map((v) => (
                  <li key={v.name} className="rounded-[18px] bg-[var(--bg-surface)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-medium">{v.name}</span>
                      <span className="text-[12px] tabular text-[var(--text-secondary)]">{v.checkpoints} checkpoints</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                      {v.lastAnchored ? <BadgeCheck className="h-3.5 w-3.5 text-[var(--green)]" /> : <Clock className="h-3.5 w-3.5" />}
                      {v.lastAnchored ? "Anchored onchain" : "Anchors within the hour"}
                      <span className="mono ml-auto">{shortHash(v.headHash, 6)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)]">
              <Radio className="h-4 w-4" /> Live feeds
            </p>
            {data.feeds.length === 0 ? (
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">Not following any datasets.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.feeds.map((f) => (
                  <li key={f.id} className="rounded-[18px] bg-[var(--bg-surface)] p-3 text-[13px]">
                    <p className="truncate font-medium">{f.dataset}</p>
                    <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">
                      v{f.lastNotifiedVersion} delivered · {f.lastDeliveryStatus ? `last response ${f.lastDeliveryStatus}` : "no deliveries yet"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
