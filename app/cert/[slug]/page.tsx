import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { BadgeCheck } from "lucide-react";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const certificate = await prisma.certificate.findUnique({
    where: { verificationSlug: slug },
    include: {
      buyer: { select: { displayName: true, username: true } },
      seller: { select: { displayName: true, username: true } },
      asset: true,
      product: true,
    },
  });

  if (!certificate) notFound();

  return (
    <PageShell showSearch={false}>
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="card p-8 text-center">
          <BadgeCheck className="mx-auto h-16 w-16 text-[var(--accent)]" />
          <h1 className="mt-4 font-serif text-2xl font-semibold">Certificate of Ownership</h1>
          <p className="mt-2 text-sm text-green-600 font-medium">Verified on ShelbyNet</p>

          <dl className="mt-8 space-y-4 text-left text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Certificate ID</dt>
              <dd className="font-mono font-semibold">{certificate.certificateId}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Asset</dt>
              <dd className="font-semibold">{certificate.title}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Buyer</dt>
              <dd>
                {certificate.buyer.displayName || certificate.buyer.username || "None"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Seller</dt>
              <dd>
                {certificate.seller.displayName || certificate.seller.username || "None"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Transaction</dt>
              <dd className="break-all font-mono text-xs">{certificate.txHash}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Issued</dt>
              <dd>{certificate.issuedAt.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Network</dt>
              <dd>{certificate.network}</dd>
            </div>
          </dl>

          <div className="mt-8">
            <a
              href={`/api/certificates/${slug}/pdf`}
              className="btn-accent-ghost w-full inline-block text-center"
              target="_blank"
              rel="noreferrer"
            >
              Download PDF certificate
            </a>
            <p className="mt-2 text-[10px] text-[var(--text-muted)]">Stored permanently on Shelby. Share the verification link above.</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
