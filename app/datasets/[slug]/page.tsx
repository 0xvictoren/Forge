import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, Bot, CalendarDays, Files, HardDrive, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import { RateDataset } from "@/components/datasets/rate-dataset";
import { octasToAptString, quoteReadOctas } from "@/lib/agents/pricing";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { AppFrame } from "@/components/shell/app-frame";
import { BackLink } from "@/components/shell/site-nav";
import { DatasetTabs } from "@/components/datasets/dataset-tabs";
import { LicensePanel } from "@/components/datasets/license-panel";
import { coverFor } from "@/components/datasets/dataset-card";
import { formatBytes, modalityLabel } from "@/lib/datasets/modalities";
import { publicDataset } from "@/lib/datasets/server";
import type { LicenseTemplate } from "@/lib/datasets/licenses";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return prisma.dataset.findUnique({
    where: { slug },
    include: { owner: true, versions: { where: { status: "SEALED" }, orderBy: { versionNumber: "desc" }, include: { files: { where: { isSample: true } } } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug).catch(() => null);
  return d ? { title: d.title, description: d.tagline || undefined } : { title: "Dataset" };
}

export default async function DatasetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row, user] = await Promise.all([load(slug), getSessionUser()]);
  if (!row) notFound();
  const isOwner = user?.id === row.ownerId;
  const visible = isOwner || (row.status !== "DRAFT" && (row.visibility === "listed" || row.status === "EXCLUSIVE_SOLD"));
  if (!visible) notFound();

  const dataset = publicDataset(row);
  const v = dataset.latestVersion;
  const held = user
    ? await prisma.datasetLicense.findMany({ where: { buyerId: user.id, datasetId: row.id, status: "ACTIVE" }, select: { template: true } })
    : [];
  const myRating = user && held.length ? await prisma.datasetRating.findUnique({ where: { datasetId_userId: { datasetId: row.id, userId: user.id } }, select: { score: true } }) : null;

  if (!isOwner) {
    prisma.dataset.update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  }

  const stats = [
    dataset.rating != null && { icon: Star, label: "Rating", value: `${dataset.rating.toFixed(1)} / 10` },
    dataset.originalityScore != null && { icon: Sparkles, label: "Originality", value: `${dataset.originalityScore.toFixed(1)} / 10` },
    v && { icon: HardDrive, label: "Size", value: formatBytes(v.totalBytes) },
    v && { icon: Files, label: "Files", value: v.fileCount.toLocaleString() },
    { icon: Users, label: "Licences", value: dataset.licenseCount.toLocaleString() },
    v?.sealedAt && { icon: CalendarDays, label: "Sealed", value: new Date(v.sealedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) },
  ].filter(Boolean) as { icon: typeof HardDrive; label: string; value: string }[];

  return (
    <AppFrame wide>
      <BackLink href="/datasets">Datasets</BackLink>
      <section className="relative mt-5 overflow-hidden rounded-[36px] bg-[var(--bg-inset)]">
        <div className="relative h-[300px] sm:h-[380px]">
          <Image src={coverFor(dataset, 2000)} alt="" fill priority sizes="1280px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div className="glass glass-dark max-w-3xl rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
              <span className="rounded-full bg-white/15 px-2.5 py-1">{modalityLabel(dataset.modality)}</span>
              {v?.anchorTxHash ? (
                <span className="flex items-center gap-1 rounded-full bg-[#30d158]/20 px-2.5 py-1 text-[#30d158]">
                  <BadgeCheck className="h-3.5 w-3.5" /> Sealed on Aptos · v{v.versionNumber}
                </span>
              ) : v ? (
                <span className="rounded-full bg-white/15 px-2.5 py-1">Sealed offchain · v{v.versionNumber}</span>
              ) : (
                <span className="rounded-full bg-[#ff9f0a]/20 px-2.5 py-1 text-[#ffb340]">Not sealed yet</span>
              )}
              {dataset.status === "EXCLUSIVE_SOLD" && <span className="rounded-full bg-[#bf5af2]/25 px-2.5 py-1 text-[#da8fff]">Sold exclusively</span>}
            </div>
            <h1 className="mt-3 text-[clamp(26px,3.6vw,42px)] font-bold leading-[1.08] tracking-[-0.03em] text-white">{dataset.title}</h1>
            {dataset.tagline && <p className="mt-2 text-[16px] text-white/75">{dataset.tagline}</p>}
            <p className="mt-3 text-[13px] text-white/60">
              by <span className="font-medium text-white/85">{dataset.owner.name}</span>
              {dataset.owner.verified && <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-[#FF8C1A]" />}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="surface-muted flex items-center gap-3 px-4 py-4">
            <s.icon className="h-5 w-5 text-[var(--text-muted)]" />
            <div>
              <p className="text-[12px] text-[var(--text-secondary)]">{s.label}</p>
              <p className="text-[16px] font-semibold tabular">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <DatasetTabs description={dataset.description} version={v} />
          {!!dataset.tags.length && (
            <div className="mt-10 flex flex-wrap gap-2">
              {dataset.tags.map((t) => (
                <Link key={t} href={`/datasets?q=${encodeURIComponent(t)}`} className="chip">
                  #{t}
                </Link>
              ))}
            </div>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <LicensePanel
            datasetId={dataset.id}
            datasetSlug={dataset.slug}
            offers={dataset.offers}
            isOwner={isOwner}
            heldTemplates={held.map((h) => h.template as LicenseTemplate)}
            available={dataset.status === "PUBLISHED" && dataset.visibility === "listed" && !!v && dataset.offers.length > 0}
            agentOnly={dataset.offers.length === 0 && dataset.readPricing.enabled}
          />
          {held.length > 0 && !isOwner && <RateDataset datasetId={dataset.id} initial={myRating?.score} />}
          {dataset.readPricing.enabled && v && (
            <div className="surface mt-4 p-5">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[var(--accent-ink)]" />
                <p className="text-[15px] font-semibold">Agents can pay per read</p>
              </div>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {dataset.readPricing.pricePerGbApt} APT per GB · full dataset {octasToAptString(quoteReadOctas(v.totalBytes, dataset.readPricing), 4)} APT
              </p>
              <p className="mono mt-3 break-all rounded-xl bg-[var(--bg-surface)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">/api/agent/datasets/{dataset.id}</p>
              <Link href="/agents" className="btn-secondary btn-sm mt-3 w-full">
                Connect an agent
              </Link>
            </div>
          )}
          <div className="mt-4 flex items-start gap-3 rounded-[20px] bg-[var(--bg-surface)] p-4 text-[13px] text-[var(--text-secondary)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-ink)]" />
            <p>
              Files are encrypted on Shelby. Your delivery is fingerprinted to your licence, and every download is logged against
              it.
            </p>
          </div>
        </aside>
      </div>
    </AppFrame>
  );
}
