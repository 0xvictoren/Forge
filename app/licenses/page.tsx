import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/require-page-user";
import { AppFrame, EmptyState, PageHeader } from "@/components/shell/app-frame";
import { coverFor } from "@/components/datasets/dataset-card";
import { LicenseAccess } from "@/components/datasets/license-access";
import { Reveal } from "@/components/motion/reveal";
import { LICENSE_INFO, isLicenseKind } from "@/lib/datasets/licenses";

export const metadata: Metadata = { title: "Licences" };
export const dynamic = "force-dynamic";

export default async function LicensesPage({ searchParams }: { searchParams: Promise<{ dataset?: string }> }) {
  const { dataset: focus } = await searchParams;
  const user = await requirePageUser("/licenses");
  const licenses = await prisma.datasetLicense.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { dataset: true, version: { select: { versionNumber: true } } },
  });

  return (
    <AppFrame>
      <PageHeader
        eyebrow="Licences"
        title="Data you've licensed"
        description="Download fingerprinted copies, connect training pipelines, and keep your certificates in one place."
        actions={
          <Link href="/compliance" className="btn-secondary">
            Build a compliance record
          </Link>
        }
      />
      {licenses.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title="No licences yet"
          description="Licences you buy or claim appear here with their files and certificates."
          action={
            <Link href="/datasets" className="btn-primary">
              Browse datasets
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {licenses.map((l, i) => {
            const info = isLicenseKind(l.template) ? LICENSE_INFO[l.template] : null;
            return (
              <Reveal key={l.id} delay={Math.min(i, 6) * 0.04} y={12}>
                <article className="surface p-4 sm:p-5">
                  <div className="flex gap-4">
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-inset)] sm:w-32">
                      <Image src={coverFor(l.dataset, 300)} alt="" fill sizes="128px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/datasets/${l.dataset.slug}`} className="truncate text-[17px] font-semibold hover:text-[var(--accent-ink)]">
                          {l.dataset.title}
                        </Link>
                        {l.status === "ACTIVE" ? <span className="badge badge-free">Active</span> : <span className="badge badge-danger">Revoked</span>}
                      </div>
                      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                        {info?.name ?? l.template} · v{l.version.versionNumber}
                        {l.template !== "RESEARCH" ? " + updates" : ""} · {l.createdAt.toLocaleDateString()}
                      </p>
                      {l.status !== "ACTIVE" && l.revokedReason && <p className="mt-1 text-[13px] text-[var(--red)]">{l.revokedReason}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/license/${l.certificateSlug}`} className="btn-secondary btn-sm">
                          Certificate
                        </Link>
                      </div>
                    </div>
                  </div>
                  {l.status === "ACTIVE" && l.template === "METERED" && (
                    <p className="mt-4 border-t border-[var(--border-dim)] pt-4 text-[13px] text-[var(--text-secondary)]">
                      Your agent reads this dataset pay-per-read through its Shelby channel. <Link href="/agents" className="text-[var(--accent-ink)]">Manage agent budget</Link>
                    </p>
                  )}
                  {l.status === "ACTIVE" && l.template !== "METERED" && (
                    <div className="mt-4 border-t border-[var(--border-dim)] pt-4">
                      <LicenseAccess datasetId={l.datasetId} defaultOpen={focus === l.datasetId} />
                    </div>
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </AppFrame>
  );
}
