import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { ProductBuyButton } from "@/components/v2/product-buy-button";
import { formatApt } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { getShelbyPublicUrl } from "@/lib/shelby-public";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();

  const product = await prisma.product.findUnique({
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
      items: {
        include: {
          asset: {
            select: {
              id: true,
              title: true,
              assetType: true,
              priceApt: true,
              thumbnailRef: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product || !product.isActive) notFound();

  const isOwner = session?.id === product.userId;
  const creatorWallet = product.owner.walletAddress || product.owner.address || "";

  const existingPurchase = session
    ? await prisma.purchase.findFirst({
        where: { buyerId: session.id, productId: product.id },
      })
    : null;

  const thumb = product.thumbnailRef ? getShelbyPublicUrl(product.thumbnailRef) : null;

  return (
    <PageShell showSearch={false}>
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-3">
            <div className="card overflow-hidden rounded-3xl">
              <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[var(--bg-subtle)]">
                {thumb ? (
                  <img src={thumb} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="text-8xl opacity-60">📦</div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[1.5px] text-[var(--accent)]">
              {product.productType} · {product.items.length} assets
            </span>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight lg:text-4xl">
              {product.title}
            </h1>

            <div className="mt-3 text-sm">
              <Link
                href={`/${product.owner.creatorProfile?.handle || product.owner.username}`}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                by {product.owner.displayName || product.owner.username || "Creator"}
              </Link>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              {product.priceApt > 0 ? (
                <>
                  <span className="font-display text-5xl font-semibold tracking-tighter text-[var(--accent)]">
                    {formatApt(product.priceApt)}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">one-time bundle</span>
                </>
              ) : (
                <span className="text-3xl font-semibold text-[var(--green)]">Free</span>
              )}
            </div>

            {product.description && (
              <p className="mt-6 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                {product.description}
              </p>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-semibold">Included assets</h3>
              <ul className="mt-3 space-y-2">
                {product.items.map((item) => (
                  <li key={item.id} className="card flex items-center justify-between p-3 text-sm">
                    <span>{item.asset?.title || item.label || "Asset"}</span>
                    {item.asset && (
                      <Link href={`/assets/${item.asset.id}`} className="text-xs text-[var(--accent)]">
                        View
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 space-y-3">
              {isOwner && (
                <div className="rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-dim)] p-4 text-sm">
                  You created this bundle.{" "}
                  <Link href="/bundles" className="font-medium underline">Manage bundles</Link>
                </div>
              )}

              {existingPurchase ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--green)]">You own this bundle.</p>
                  <Link href="/library" className="btn-primary flex w-full items-center justify-center">
                    Open in Library
                  </Link>
                </div>
              ) : (
                !isOwner && (
                  <ProductBuyButton
                    productId={product.id}
                    priceApt={product.priceApt}
                    creatorWallet={creatorWallet}
                    title={product.title}
                  />
                )
              )}
            </div>

            <div className="mt-8 border-t border-[var(--border-dim)] pt-4">
              <Link href="/explore" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]">
                ← Back to marketplace
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}