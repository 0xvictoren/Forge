"use client";

import Link from "next/link";
import { formatApt } from "@/lib/utils";
import { resolveThumbnailUrl } from "@/lib/default-thumbnail";
import { AssetBuyButton } from "./asset-buy-button";

export type AssetCardData = {
  id: string;
  title: string;
  priceApt: number;
  assetType?: string;
  category?: string | null;
  description?: string | null;
  viewCount?: number;
  purchaseCount?: number;
  thumbnailRef?: string | null;
  blobRef?: string;
  owner?: {
    id?: string;
    displayName?: string | null;
    username?: string | null;
    walletAddress?: string | null;
    address?: string | null;
    creatorProfile?: { handle?: string | null; reputationLevel?: string | null } | null;
  } | null;
  metadata?: { summary?: string | null } | null;
};

const TYPE_ICONS: Record<string, string> = {
  VIDEO: "🎬",
  IMAGE: "🖼️",
  PDF: "📄",
  AUDIO: "🎵",
  CODE: "💻",
  ZIP: "📦",
  BUNDLE: "🎁",
};

export function AssetCard({
  asset,
  showBuyButton = true,
}: {
  asset: AssetCardData;
  showBuyButton?: boolean;
}) {
  const creator =
    asset.owner?.displayName ||
    asset.owner?.creatorProfile?.handle ||
    asset.owner?.username ||
    "Creator";

  const thumb = resolveThumbnailUrl(asset.thumbnailRef);
  const summary = asset.metadata?.summary || asset.description;
  const creatorWallet = asset.owner?.walletAddress || asset.owner?.address || "";
  const typeLabel = asset.assetType || asset.category || "Asset";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-dim)] bg-[var(--bg-elevated)] transition-all hover:-translate-y-1 hover:shadow-md hover:border-[var(--border-accent)]">
      <Link href={`/assets/${asset.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-subtle)]">
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
          <div className="absolute left-3 top-3">
            <span className="rounded-full bg-black/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              {typeLabel}
            </span>
          </div>
          <div className="absolute bottom-3 right-3">
            {asset.priceApt > 0 ? (
              <span className="rounded-full bg-white/95 px-3 py-px text-xs font-semibold shadow-sm">
                {formatApt(asset.priceApt, 2)} APT
              </span>
            ) : (
              <span className="rounded-full bg-white/95 px-3 py-px text-xs font-semibold text-[var(--green)] shadow-sm">
                Free
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <Link href={`/assets/${asset.id}`}>
          <p className="line-clamp-2 font-semibold tracking-tight hover:text-[var(--brand)]">
            {asset.title}
          </p>
        </Link>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{creator}</p>
        {summary && (
          <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">{summary}</p>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{asset.purchaseCount || 0} sold</span>
          {asset.category && (
            <span className="font-medium uppercase tracking-widest text-[var(--brand)]">
              {asset.category}
            </span>
          )}
        </div>

        {showBuyButton && asset.priceApt > 0 && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <AssetBuyButton
              assetId={asset.id}
              priceApt={asset.priceApt}
              creatorWallet={creatorWallet}
              title={asset.title}
              compact
            />
          </div>
        )}
      </div>
    </article>
  );
}