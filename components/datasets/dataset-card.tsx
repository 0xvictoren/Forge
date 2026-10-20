import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Files, HardDrive, Star } from "lucide-react";
import { formatBytes, modalityLabel } from "@/lib/datasets/modalities";
import { MODALITY_COVERS, PHOTOS, photoUrl } from "@/lib/photos";
import type { PublicDataset } from "@/lib/datasets/server";

export function coverFor(d: { coverUrl: string | null; modality: string }, width = 900) {
  if (d.coverUrl) return d.coverUrl;
  const key = MODALITY_COVERS[d.modality] ?? "abstract";
  return photoUrl(PHOTOS[key], width, 75);
}

export function priceLabel(d: Pick<PublicDataset, "offers">) {
  if (!d.offers.length) return "Not for sale";
  const min = Math.min(...d.offers.map((o) => o.priceApt));
  if (min === 0) return d.offers.length > 1 ? "Free research · paid commercial" : "Free for research";
  return `From ${min.toLocaleString(undefined, { maximumFractionDigits: 4 })} APT`;
}

export function DatasetCard({ dataset, priority }: { dataset: PublicDataset; priority?: boolean }) {
  const v = dataset.latestVersion;
  return (
    <Link
      href={`/datasets/${dataset.slug}`}
      className="group surface surface-interactive flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-inset)]">
        <Image
          src={coverFor(dataset)}
          alt=""
          fill
          sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="glass glass-dark rounded-full px-2.5 py-1 text-[12px] font-medium">{modalityLabel(dataset.modality)}</span>
          {v?.anchorTxHash ? (
            <span className="glass glass-dark flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium">
              <BadgeCheck className="h-3.5 w-3.5 text-[#30d158]" /> Sealed
            </span>
          ) : v ? (
            <span className="glass glass-dark rounded-full px-2.5 py-1 text-[12px] font-medium">Sealed offchain</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="title line-clamp-2">{dataset.title}</h3>
        {dataset.tagline && <p className="mt-1.5 line-clamp-2 text-[14px] text-[var(--text-secondary)]">{dataset.tagline}</p>}
        <div className="mt-auto flex items-center gap-4 pt-5 text-[13px] text-[var(--text-secondary)]">
          {dataset.rating != null && (
            <span className="flex items-center gap-1.5 font-medium tabular text-[var(--text-primary)]" title="Rating out of 10">
              <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" /> {dataset.rating.toFixed(1)}
            </span>
          )}
          {v && (
            <>
              <span className="flex items-center gap-1.5 tabular">
                <HardDrive className="h-3.5 w-3.5" /> {formatBytes(v.totalBytes)}
              </span>
              <span className="flex items-center gap-1.5 tabular">
                <Files className="h-3.5 w-3.5" /> {v.fileCount.toLocaleString()}
              </span>
            </>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-dim)] pt-4">
          <span className="truncate text-[13px] text-[var(--text-muted)]">{dataset.owner.name}</span>
          <span className="shrink-0 text-[14px] font-semibold">{priceLabel(dataset)}</span>
        </div>
      </div>
    </Link>
  );
}
