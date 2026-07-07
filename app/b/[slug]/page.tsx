import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatApt } from "@/lib/utils";
import { PageShell } from "@/components/layout/page-shell";
import { UnlockActions } from "@/components/burnlink/unlock-actions";
import { ExpiryCountdown } from "@/components/burnlink/expiry-countdown";
import { ShareBurnLink } from "@/components/burnlink/share-burnlink";
import { ensureBurnLinkActive } from "@/lib/shelby-expiry";
import { Lock, Clock, Flame, Download } from "lucide-react";

export default async function BurnLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const burnLink = await prisma.burnLink.findUnique({
    where: { slug },
    include: {
      file: true,
      owner: {
        include: { creatorProfile: true },
      },
    },
  });

  if (!burnLink) notFound();

  const active = await ensureBurnLinkActive(burnLink.id);
  const expired = !active.ok && active.expired;

  const handle =
    burnLink.owner.creatorProfile?.handle || burnLink.owner.username;

  return (
    <PageShell showSearch={false}>
      <div className="mx-auto w-full max-w-2xl px-4 py-10 lg:py-16">
        {/* Creator header - cleaner */}
        {handle && (
          <Link
            href={`/${handle}`}
            className="mb-8 inline-flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <div className="h-9 w-9 rounded-full bg-[var(--bg-elevated)] ring-1 ring-[var(--border-dim)]" />
            <div>
              <span className="font-medium text-[var(--text-primary)]">{burnLink.owner.displayName || handle}</span>
              <span className="text-[var(--text-muted)]"> · @{handle}</span>
            </div>
          </Link>
        )}

        <div className="card overflow-hidden rounded-3xl lg:rounded-[20px]">
          {/* Hero visual area for the gated content */}
          <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-[var(--bg-subtle)]">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 text-4xl shadow-sm">
                <Lock className="h-8 w-8 text-[var(--accent)]" />
              </div>
              <p className="text-xs uppercase tracking-[2px] text-[var(--text-muted)]">GATED CONTENT</p>
            </div>

            {burnLink.expiresAt && !expired && (
              <div className="absolute top-4 right-4">
                <ExpiryCountdown expiresAt={burnLink.expiresAt} />
              </div>
            )}
          </div>

          <div className="p-7 lg:p-9">
            <h1 className="font-serif text-2xl font-semibold tracking-tight lg:text-3xl">
              {burnLink.title || burnLink.file.fileName}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              {(burnLink.file.fileSize / 1024 / 1024).toFixed(2)} MB · {burnLink.file.mimeType}
            </p>

            {expired ? (
              <div className="mt-8 rounded-2xl bg-[var(--red-dim)] p-5 text-center text-[var(--red)]">
                This BurnLink has expired and is no longer available.
              </div>
            ) : (
              <>
                {/* Pricing & rules - prominent like product pages */}
                <div className="mt-8">
                  {burnLink.priceApt > 0 ? (
                    <div>
                      <span className="font-display text-4xl font-semibold tracking-tighter text-[var(--accent)]">
                        {formatApt(burnLink.priceApt)}
                      </span>
                      <span className="ml-2 text-sm text-[var(--text-muted)]">to unlock</span>
                    </div>
                  ) : (
                    <span className="inline-block rounded-full bg-[var(--green-dim)] px-4 py-1 text-sm font-semibold text-[var(--green)]">Free to unlock</span>
                  )}
                </div>

                <ul className="mt-6 grid gap-x-8 gap-y-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                  {burnLink.maxViews && (
                    <li className="flex items-center gap-2.5">
                      <Download className="h-4 w-4 text-[var(--accent)]" /> 
                      Up to {burnLink.maxViews} views
                    </li>
                  )}
                  {burnLink.expiresAt && (
                    <li className="flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-[var(--accent)]" /> 
                      Expires {burnLink.expiresAt.toLocaleDateString()}
                    </li>
                  )}
                  {burnLink.burnAfterRead && (
                    <li className="flex items-center gap-2.5">
                      <Flame className="h-4 w-4 text-[var(--accent)]" /> Burns after first view
                    </li>
                  )}
                  {burnLink.walletGated && (
                    <li className="flex items-center gap-2.5">Wallet restricted access</li>
                  )}
                </ul>

                <div className="mt-8">
                  <UnlockActions
                    slug={slug}
                    priceApt={burnLink.priceApt}
                    creatorWallet={
                      burnLink.owner.walletAddress || burnLink.owner.address || ""
                    }
                    walletGated={burnLink.walletGated}
                    allowedWallets={burnLink.allowedWallets}
                  />
                </div>
              </>
            )}

            {!expired && (
              <div className="mt-8 border-t border-[var(--border-dim)] pt-6">
                <ShareBurnLink slug={slug} />
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Secured with Shelby storage • Verified Aptos payment
        </p>
      </div>
    </PageShell>
  );
}
