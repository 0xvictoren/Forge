import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, BadgeCheck, CircleDashed, Download, KeyRound, Search, Fingerprint, Eye } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/require-page-user";
import { AppFrame } from "@/components/shell/app-frame";
import { BackLink } from "@/components/shell/site-nav";
import { LicenseesTable, OffersPanel, PublishControls, TraceTool } from "@/components/studio/manage-panels";
import { detectFingerprintFormat } from "@/lib/datasets/fingerprint";
import { parseOffers } from "@/lib/datasets/licenses";
import { parseReadPricing } from "@/lib/agents/pricing";
import { AgentPricingPanel } from "@/components/studio/agent-pricing";
import { formatBytes, modalityLabel, shortHash } from "@/lib/datasets/modalities";

export const metadata: Metadata = { title: "Manage dataset" };
export const dynamic = "force-dynamic";

const ACTION_ICON: Record<string, typeof Download> = {
  DOWNLOAD: Download,
  PIPELINE: KeyRound,
  CREDENTIAL: KeyRound,
  TRACE: Search,
  SAMPLE: Eye,
  KEY_RELEASE: KeyRound,
};

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="surface p-6">
      <h2 className="title">{title}</h2>
      {description && <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ManageDatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{24}$/i.test(id)) notFound();
  const user = await requirePageUser(`/studio/${id}`);
  const d = await prisma.dataset.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, include: { files: { where: { isSample: false }, select: { id: true, path: true, mimeType: true } } } },
      licenses: { orderBy: { createdAt: "desc" }, include: { buyer: true, version: { select: { versionNumber: true } } } },
    },
  });
  if (!d || d.ownerId !== user.id) notFound();

  const logs = await prisma.datasetAccessLog.findMany({
    where: { datasetId: id },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { license: { select: { orgName: true, buyer: { select: { displayName: true, username: true, walletAddress: true } } } } },
  });

  const latest = d.versions.find((v) => v.id === d.latestVersionId);
  const textFiles = d.versions
    .filter((v) => v.status === "SEALED")
    .flatMap((v) => v.files.map((f) => ({ ...f, label: `v${v.versionNumber} · ${f.path}` })))
    .filter((f) => detectFingerprintFormat(f.path, f.mimeType) !== "binary")
    .map((f) => ({ id: f.id, path: f.label }));

  return (
    <AppFrame wide>
      <BackLink href="/studio">Studio</BackLink>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{modalityLabel(d.modality)} · {d.visibility === "listed" ? "Marketplace" : "Private"}</p>
          <h1 className="display-lg mt-1">{d.title}</h1>
          <div className="mt-3 flex flex-wrap gap-3 text-[14px]">
            {d.visibility === "listed" && d.status !== "DRAFT" && (
              <Link href={`/datasets/${d.slug}`} className="inline-flex items-center gap-1 text-[var(--accent-ink)] hover:underline">
                View listing <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {latest && (
              <Link href={`/proof/${latest.id}`} className="inline-flex items-center gap-1 text-[var(--accent-ink)] hover:underline">
                Proof <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
        <PublishControls datasetId={d.id} status={d.status} visibility={d.visibility} canPublish={!!latest} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card title="Licensees" description="Every licence carries its own fingerprint. Revoke access if a copy turns up where it shouldn't.">
            <LicenseesTable
              datasetId={d.id}
              rows={d.licenses.map((l) => ({
                id: l.id,
                certificateSlug: l.certificateSlug,
                template: l.template,
                buyer: l.buyer.displayName || l.buyer.username || l.buyer.walletAddress || "Unknown",
                orgName: l.orgName,
                amountApt: l.amountApt,
                status: l.status,
                downloadCount: l.downloadCount,
                lastAccessAt: l.lastAccessAt?.toISOString() ?? null,
                createdAt: l.createdAt.toISOString(),
                fingerprintId: l.fingerprintId,
                versionNumber: l.version.versionNumber,
              }))}
            />
          </Card>

          <Card title="Trace a leak" description="Paste content you found in the wild. Forge checks invisible signatures and regenerates every licensee's canaries to find the source.">
            <TraceTool datasetId={d.id} textFiles={textFiles} />
          </Card>

          <Card title="Access log" description="Latest deliveries, pipeline pulls and credentials.">
            {logs.length === 0 ? (
              <p className="text-[14px] text-[var(--text-secondary)]">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-dim)]">
                {logs.map((log) => {
                  const Icon = ACTION_ICON[log.action] ?? Fingerprint;
                  const who = log.license ? log.license.orgName || log.license.buyer.displayName || log.license.buyer.username || log.license.buyer.walletAddress : "You";
                  return (
                    <li key={log.id} className="flex items-center gap-3 py-3 text-[14px]">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-hover)]">
                        <Icon className="h-4 w-4 text-[var(--text-secondary)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          <span className="font-medium">{who}</span> <span className="text-[var(--text-secondary)]">· {log.action.toLowerCase().replace("_", " ")}</span>
                        </p>
                        {log.deliveredSha256 && <p className="mono truncate text-[11px] text-[var(--text-muted)]">{log.deliveredSha256}</p>}
                      </div>
                      <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{log.createdAt.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Versions">
            <ol className="relative space-y-4 border-l border-[var(--border-default)] pl-5">
              {d.versions.map((v) => (
                <li key={v.id} className="relative">
                  <span className="absolute -left-[27px] top-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[var(--bg-elevated)]">
                    {v.status === "SEALED" ? <BadgeCheck className={`h-[14px] w-[14px] ${v.anchorTxHash ? "text-[var(--green)]" : "text-[var(--text-muted)]"}`} /> : <CircleDashed className="h-[14px] w-[14px] text-[var(--orange)]" />}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold">
                      v{v.versionNumber} {v.id === d.latestVersionId && <span className="badge badge-paid ml-1">Current</span>}
                    </p>
                    {v.status === "SEALED" ? (
                      <Link href={`/proof/${v.id}`} className="text-[13px] text-[var(--accent-ink)]">
                        Proof
                      </Link>
                    ) : (
                      <Link href={`/studio/new?dataset=${d.id}`} className="text-[13px] text-[var(--accent-ink)]">
                        Continue
                      </Link>
                    )}
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {v.fileCount.toLocaleString()} files · {formatBytes(v.totalBytes)}
                    {v.status === "SEALED" ? ` · ${v.anchorTxHash ? "anchored" : "offchain"}` : " · draft"}
                  </p>
                  {v.sealHash && <p className="mono mt-0.5 text-[11px] text-[var(--text-muted)]">{shortHash(v.sealHash, 10)}</p>}
                </li>
              ))}
            </ol>
          </Card>

          {d.visibility === "listed" && d.status !== "EXCLUSIVE_SOLD" && (
            <Card title="Agent access" description="Let AI agents pay per byte they read.">
              <AgentPricingPanel datasetId={d.id} initial={parseReadPricing(d.readPricing)} />
            </Card>
          )}

          {d.visibility === "listed" && d.status !== "EXCLUSIVE_SOLD" && (
            <Card title="Pricing" description="Changes apply to new licences only.">
              <OffersPanel datasetId={d.id} initial={parseOffers(d.offers)} />
            </Card>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
