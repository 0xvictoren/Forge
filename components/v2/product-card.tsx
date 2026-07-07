import Link from "next/link";
import { formatApt } from "@/lib/utils";
import { resolveThumbnailUrl } from "@/lib/default-thumbnail";

export type ProductCardData = {
  id: string;
  title: string;
  description?: string | null;
  priceApt: number;
  productType?: string;
  thumbnailRef?: string | null;
  items?: any[];
  owner?: { displayName?: string | null; username?: string | null } | null;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const thumb = resolveThumbnailUrl(product.thumbnailRef);
  const count = product.items?.length || 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--border-dim)] bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg-subtle)]">
        <img src={thumb} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
        <div className="absolute right-3 top-3">
          <span className="rounded-full bg-white/90 px-3 py-0.5 text-xs font-semibold shadow-sm backdrop-blur">
            {formatApt(product.priceApt, 2)}
          </span>
        </div>
      </div>
      <div className="p-5">
        <p className="line-clamp-1 text-[15px] font-semibold tracking-tight">{product.title}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{count} assets included</p>
        {product.description && (
          <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">{product.description}</p>
        )}
      </div>
    </Link>
  );
}
