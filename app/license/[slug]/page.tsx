import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, BadgeCheck, Fingerprint } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getExplorerUrl } from "@/lib/aptos";
import { AppFrame } from "@/components/shell/app-frame";
import { Reveal } from "@/components/motion/reveal";
import { ForgeWordmark } from "@/components/shell/forge-mark";
import { LICENSE_INFO, isLicenseKind } from "@/lib/datasets/licenses";
import { shortHash } from "@/lib/datasets/modalities";
import { truncateAddress } from "@/lib/utils";
import { PrintButton } from "@/components/datasets/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Licence certificate" };

export default async function LicenseCertificatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[0-9a-f]{20}$/.test(slug)) notFound();
  const license = await prisma.datasetLicense.findUnique({
    where: { certificateSlug: slug },
    include: { dataset: true, version: true, buyer: true, seller: true },
  });
  if (!license) notFound();
  const viewer = await getSessionUser();
  const isParty = viewer && (viewer.id === license.buyerId || viewer.id === license.sellerId);
  const info = isLicenseKind(license.template) ? LICENSE_INFO[license.template] : null;
  const paid = license.txHash.startsWith("0x");
  const revoked = license.status !== "ACTIVE";

  const rows: [string, React.ReactNode][] = [
    ["Licensee", license.orgName || license.buyer.displayName || license.buyer.username || truncateAddress(license.buyer.walletAddress || "")],
    ["Licensee wallet", <span key="w" className="mono text-[13px]">{truncateAddress(license.buyer.walletAddress || license.buyer.address || "None", 8, 6)}</span>],
    ["Licensor", license.seller.displayName || license.seller.username || truncateAddress(license.seller.walletAddress || "")],
    ["Dataset", <Link key="d" href={`/datasets/${license.dataset.slug}`} className="text-[var(--accent-ink)] hover:underline">{license.dataset.title}</Link>],
    ["Version", <Link key="v" href={`/proof/${license.versionId}`} className="text-[var(--accent-ink)] hover:underline">v{license.version.versionNumber} · seal {shortHash(license.version.sealHash, 8)}</Link>],
    ["Issued", license.createdAt.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })],
    ["Consideration", paid ? `${license.amountApt.toLocaleString(undefined, { maximumFractionDigits: 8 })} APT` : "Free research licence"],
    ["Terms hash", <span key="t" className="mono text-[13px]">{shortHash(license.termsHash, 10)}</span>],
    ["Fingerprint", <span key="f" className="mono text-[13px]">{license.fingerprintId}</span>],
  ];

  return (
    <AppFrame>
      <Reveal className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-[36px] border border-[var(--border-dim)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)] print:shadow-none">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,var(--accent-dim),transparent_70%)]" />
          <div className="relative p-8 sm:p-12">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <ForgeWordmark height={28} />
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text-secondary)]">Forge data licence</p>
                  <p className="mono text-[12px] text-[var(--text-muted)]">#{license.certificateSlug}</p>
                </div>
              </div>
              {revoked ? (
                <span className="badge badge-danger">Revoked</span>
              ) : (
                <span className="badge badge-free">
                  <BadgeCheck className="h-3 w-3" /> Active
                </span>
              )}
            </div>

            <h1 className="display-lg mt-10">{`${info?.name ?? license.template} licence`}</h1>
            <p className="lede mt-2">{info?.tagline}</p>

            <dl className="mt-10 divide-y divide-[var(--border-dim)]">
              {rows.map(([k, v]) => (
                <div key={k} className="grid gap-1 py-3.5 sm:grid-cols-[180px_1fr]">
                  <dt className="text-[14px] text-[var(--text-secondary)]">{k}</dt>
                  <dd className="text-[15px]">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-2 print:hidden">
              {paid && (
                <a href={getExplorerUrl(license.txHash)} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                  Settlement on Aptos <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
              <PrintButton />
            </div>

            <div className="mt-8 flex items-start gap-3 rounded-[20px] bg-[var(--bg-surface)] p-4 text-[13px] text-[var(--text-secondary)]">
              <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-[var(--purple)]" />
              <p>Copies delivered under this licence carry fingerprint {license.fingerprintId}. A copy found elsewhere is attributable to it.</p>
            </div>

            {isParty && (
              <details className="mt-8 group">
                <summary className="cursor-pointer text-[14px] font-medium text-[var(--accent-ink)]">Full licence text</summary>
                <pre className="mono mt-4 whitespace-pre-wrap rounded-[20px] bg-[var(--bg-surface)] p-5 text-[12px] leading-relaxed">{license.licenseText}</pre>
                <p className="mono mt-2 break-all text-[11px] text-[var(--text-muted)]">text hash {license.licenseTextHash}</p>
              </details>
            )}
          </div>
        </div>
      </Reveal>
    </AppFrame>
  );
}
