import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatApt } from "@/lib/utils";
import { SiteHeader } from "@/components/layout/site-header";
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
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader showSearch={false} />
      <main className="mx-auto flex-1 max-w-lg px-4 py-10">
        {handle && (
          <Link
            href={`/${handle}`}
            className="mb-6 flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <div className="h-10 w-10 rounded-full bg-[var(--bg-subtle)]" />
            <span>
              {burnLink.owner.displayName || handle} · @{handle}
            </span>
          </Link>
        )}

        <div className="card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--accent-dim)]">
              <Lock className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="font-display text-xl">
                {burnLink.title || burnLink.file.fileName}
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                {(burnLink.file.fileSize / 1024).toFixed(1)} KB ·{" "}
                {burnLink.file.mimeType}
              </p>
            </div>
          </div>

          {burnLink.expiresAt && (
            <div className="mt-4">
              <ExpiryCountdown expiresAt={burnLink.expiresAt} />
            </div>
          )}

          {expired ? (
            <p className="mt-6 text-center text-sm text-[var(--red)]">
              This file has expired and is no longer available.
            </p>
          ) : (
            <>
              <div className="mt-6">
                {burnLink.priceApt > 0 ? (
                  <p className="font-display text-2xl text-[var(--accent)]">
                    {formatApt(burnLink.priceApt)} to unlock
                  </p>
                ) : (
                  <span className="badge badge-free">Free</span>
                )}
              </div>

              <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                {burnLink.maxViews && (
                  <li className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> Max {burnLink.maxViews} views
                  </li>
                )}
                {burnLink.expiresAt && (
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Expires {burnLink.expiresAt.toLocaleString()}
                  </li>
                )}
                {burnLink.burnAfterRead && (
                  <li className="flex items-center gap-2">
                    <Flame className="h-4 w-4" /> Burns after read
                  </li>
                )}
              </ul>

              <UnlockActions
                slug={slug}
                priceApt={burnLink.priceApt}
                creatorWallet={
                  burnLink.owner.walletAddress || burnLink.owner.address || ""
                }
              />
            </>
          )}

          {!expired && (
            <div className="mt-6">
              <ShareBurnLink slug={slug} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
