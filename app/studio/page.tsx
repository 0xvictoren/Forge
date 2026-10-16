import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, BadgeCheck, Database, Download, Plus, ScrollText, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/require-page-user";
import { AppFrame, EmptyState, PageHeader } from "@/components/shell/app-frame";
import { coverFor } from "@/components/datasets/dataset-card";
import { Reveal } from "@/components/motion/reveal";
import { AgentEarnings } from "@/components/studio/agent-pricing";
import { formatBytes, modalityLabel } from "@/lib/datasets/modalities";

export const metadata: Metadata = { title: "Studio" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "badge-neutral" },
  PUBLISHED: { label: "Live", cls: "badge-free" },
  EXCLUSIVE_SOLD: { label: "Sold exclusively", cls: "badge-purple" },
  ARCHIVED: { label: "Archived", cls: "badge-neutral" },
};

export default async function StudioPage() {
  const user = await requirePageUser("/studio");
  const [datasets, licenses, downloads] = await Promise.all([
    prisma.dataset.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    }),
    prisma.datasetLicense.findMany({ where: { sellerId: user.id }, select: { amountApt: true, status: true } }),
    prisma.datasetAccessLog.count({ where: { dataset: { ownerId: user.id }, action: { in: ["DOWNLOAD", "PIPELINE"] } } }),
  ]);

  const revenue = licenses.reduce((s, l) => s + l.amountApt * 0.95, 0);
  const stats = [
    { icon: Database, label: "Datasets", value: datasets.length.toLocaleString() },
    { icon: ScrollText, label: "Licences issued", value: licenses.length.toLocaleString() },
    { icon: Wallet, label: "Net earnings", value: `${revenue.toLocaleString(undefined, { maximumFractionDigits: 4 })} APT` },
    { icon: Download, label: "Deliveries", value: downloads.toLocaleString() },
  ];

  return (
    <AppFrame wide>
      <PageHeader
        eyebrow="Studio"
        title="Your datasets"
        description="Seal, price and track every dataset you sell, or keep private for compliance."
        actions={
          <Link href="/studio/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New dataset
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.04} className="surface p-5">
            <s.icon className="h-5 w-5 text-[var(--accent-ink)]" />
            <p className="mt-4 text-[13px] text-[var(--text-secondary)]">{s.label}</p>
            <p className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em] tabular">{s.value}</p>
          </Reveal>
        ))}
      </div>

      <Reveal className="surface mt-6 p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="title">Agent earnings</h2>
          <p className="text-[13px] text-[var(--text-secondary)]">Pay-per-read income from AI agents, across all datasets</p>
        </div>
        <div className="mt-5">
          <AgentEarnings />
        </div>
      </Reveal>

      <div className="mt-10">
        {datasets.length === 0 ? (
          <EmptyState
            icon={<Database className="h-6 w-6" />}
            title="Seal your first dataset"
            description="Upload, describe and seal it in a few minutes. You decide whether it's listed or private."
            action={
              <Link href="/studio/new" className="btn-primary">
                Get started
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {datasets.map((d, i) => {
              const latest = d.versions.find((v) => v.id === d.latestVersionId);
              const draft = d.versions.find((v) => v.status === "DRAFT");
              const status = STATUS[d.status] ?? STATUS.DRAFT;
              return (
                <Reveal key={d.id} delay={Math.min(i, 6) * 0.04} y={12}>
                  <Link href={`/studio/${d.id}`} className="surface surface-interactive flex items-center gap-4 p-3 pr-5">
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-inset)] sm:h-20 sm:w-28">
                      <Image src={coverFor(d, 300)} alt="" fill sizes="112px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[16px] font-semibold">{d.title}</p>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                        {d.visibility === "private" && <span className="badge badge-neutral">Private</span>}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--text-secondary)]">
                        <span>{modalityLabel(d.modality)}</span>
                        {latest ? (
                          <span className="flex items-center gap-1">
                            <BadgeCheck className={`h-3.5 w-3.5 ${latest.anchorTxHash ? "text-[var(--green)]" : "text-[var(--text-muted)]"}`} /> v{latest.versionNumber} · {formatBytes(latest.totalBytes)}
                          </span>
                        ) : (
                          <span className="text-[var(--orange)]">Not sealed</span>
                        )}
                        {draft && latest && <span className="text-[var(--orange)]">v{draft.versionNumber} draft</span>}
                        <span>{d.licenseCount} licences</span>
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </AppFrame>
  );
}
