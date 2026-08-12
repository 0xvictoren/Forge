import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { AssetBuyButton } from "@/components/v2/asset-buy-button";
import { AssetListToggle } from "@/components/v2/asset-list-toggle";
import { formatApt } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { canUserAccessAsset } from "@/lib/asset-access";
import { getShelbyPublicUrl } from "@/lib/shelby-public";
import { t } from "@/lib/i18n/translations";
import { EncryptedDownloadButton } from "@/components/media/encrypted-download-button";
import { EncryptedBadge } from "@/components/ui/encrypted-badge";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          displayName: true,
          username: true,
          walletAddress: true,
          address: true,
          creatorProfile: { select: { handle: true, reputationLevel: true } },
        },
      },
      metadata: true,
    },
  });

  if (!asset) notFound();

  const isOwner = session?.id === asset.userId;
  const creatorWallet = asset.owner.walletAddress || asset.owner.address || "";

  const access = await canUserAccessAsset(session?.id ?? null, {
    id: asset.id,
    userId: asset.userId,
    priceApt: asset.priceApt,
    visibility: asset.visibility,
    blobRef: asset.blobRef,
  });

  const canDownload = access.canAccess;
  // Never use encrypted blob as a public image preview (ciphertext is not viewable)
  const previewUrl = asset.thumbnailRef
    ? getShelbyPublicUrl(asset.thumbnailRef)
    : !asset.isEncrypted &&
        asset.blobRef &&
        (asset.assetType === "IMAGE" || asset.mimeType?.startsWith("image"))
      ? getShelbyPublicUrl(asset.blobRef)
      : null;

  const downloadUrl = canDownload
    ? `/api/media/shelby?ref=${encodeURIComponent(asset.blobRef)}&download=1&filename=${encodeURIComponent(asset.fileName || asset.title)}`
    : null;

  // Responsive product page inspired by modern marketplaces (Lemon Squeezy / Gumroad style)
  // Two column on desktop, stacked on mobile. Strong visuals + clear actions.
  const fallbackImage = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80"; // generic digital asset fallback

  return (
    <PageShell showSearch={false}>
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
          {/* Preview - takes more space on desktop */}
          <div className="lg:col-span-3">
            <div className="card overflow-hidden rounded-3xl">
              <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[var(--bg-subtle)] lg:aspect-[16/9]">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={asset.title}
                    className="h-full w-full object-contain p-4"
                  />
                ) : (
                  <div className="text-center p-8">
                    <div className="text-8xl mb-4 opacity-70">
                      {asset.assetType === "VIDEO" ? "🎬" : asset.assetType === "IMAGE" ? "🖼️" : asset.assetType === "PDF" ? "📄" : "📦"}
                    </div>
                    <p className="text-sm uppercase tracking-[2px] text-[var(--text-muted)]">{asset.assetType}</p>
                  </div>
                )}

                {asset.priceApt > 0 && !canDownload && (
                  <div className="absolute top-4 right-4 rounded-full bg-black/75 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                    PAID ASSET
                  </div>
                )}
                {asset.isEncrypted && (
                  <div className="absolute top-4 left-4">
                    <EncryptedBadge size="sm" />
                  </div>
                )}
              </div>
            </div>

            {/* Mobile stats */}
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)] lg:hidden">
              <span>{asset.purchaseCount} bought</span>
              <span>{asset.viewCount} views</span>
            </div>
          </div>

          {/* Details + Actions */}
          <div className="lg:col-span-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[1.5px] text-[var(--accent)]">
                  {asset.assetType} · {asset.category || asset.metadata?.suggestedCategory || (t("en", "asset") || "Digital Asset")}
                </span>
              </div>

              <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight lg:text-4xl">{asset.title}</h1>

              <div className="mt-3 flex items-center gap-3 text-sm">
                <Link 
                  href={`/${asset.owner.creatorProfile?.handle || asset.owner.username}`} 
                  className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {t("en", "by") || "by"} {asset.owner.displayName || asset.owner.username || (t("en", "creator") || "Creator")}
                </Link>
                {asset.owner.creatorProfile?.reputationLevel && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-elevated)]">{asset.owner.creatorProfile.reputationLevel}</span>
                )}
              </div>

              {/* Pricing - very prominent like modern product pages */}
              <div className="mt-6 flex items-baseline gap-2">
                {asset.priceApt > 0 ? (
                  <>
                    <span className="font-display text-5xl font-semibold tracking-tighter text-[var(--accent)]">
                      {formatApt(asset.priceApt)}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">one-time</span>
                  </>
                ) : (
                  <span className="text-3xl font-semibold text-[var(--green)]">Free</span>
                )}
              </div>

              <div className="mt-1 text-xs text-[var(--text-muted)] hidden lg:block">
                {asset.purchaseCount} bought · {asset.viewCount} views
              </div>
            </div>

            {/* Description */}
            {(asset.description || asset.metadata?.summary) && (
              <div className="mt-6 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                {asset.description || asset.metadata?.summary}
              </div>
            )}

            {/* Tags */}
            {(asset.tags?.length || asset.metadata?.keywords?.length) ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {(asset.tags || []).concat(asset.metadata?.keywords || []).slice(0, 8).map((k, i) => (
                  <span key={i} className="badge badge-free text-xs">{k}</span>
                ))}
              </div>
            ) : null}

            {/* Actions - sticky friendly on mobile */}
            <div className="mt-8 space-y-3 lg:mt-10">
              {isOwner && (
                <div className="space-y-3 rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-dim)] p-4 text-sm">
                  <p>
                    You created this.{" "}
                    <Link href="/dashboard" className="font-medium underline">Creator Dashboard</Link>
                    {" · "}
                    <Link href="/vaults" className="underline">Vaults</Link>
                  </p>
                  <AssetListToggle assetId={asset.id} initialListed={asset.isListed} />
                </div>
              )}

              {!canDownload && asset.priceApt > 0 && !isOwner && (
                <div className="pt-2">
                  <AssetBuyButton
                    assetId={asset.id}
                    priceApt={asset.priceApt}
                    creatorWallet={creatorWallet}
                    title={asset.title}
                  />
                  <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
                    Creator receives 98%. 2% platform fee.
                  </p>
                </div>
              )}

              {canDownload && (
                <EncryptedDownloadButton
                  downloadUrl={downloadUrl}
                  fileName={asset.fileName || asset.title}
                  isEncrypted={!!asset.isEncrypted}
                  keyPackageUrl={`/api/assets/${asset.id}/decrypt-package`}
                  asOwner={isOwner}
                >
                  {asset.isEncrypted
                    ? "Decrypt & download"
                    : t("en", "download_file") || "Download file"}
                </EncryptedDownloadButton>
              )}

              {canDownload && asset.priceApt === 0 && !isOwner && (
                <p className="text-center text-sm font-medium text-[var(--green)]">This asset is free to download.</p>
              )}

              {asset.burnLinkId && (
                <p className="text-center text-xs text-[var(--text-muted)] pt-1">
                  Also available as a quick BurnLink.
                </p>
              )}
            </div>

            <div className="mt-8 border-t border-[var(--border-dim)] pt-4">
              <Link href="/explore" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]">
                ← {t("en", "back_to_explore") || "Back to marketplace"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
