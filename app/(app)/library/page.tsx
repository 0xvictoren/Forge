import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LibraryTabs } from "@/components/v2/library-tabs";
import { BookOpen } from "lucide-react";
import { t } from "@/lib/i18n/translations";

export default async function LibraryPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const [purchases, certificates, subscriptions, grants, sales, invoices, txs, ownedBundles, ownedAssets, activities] = await Promise.all([
    prisma.purchase.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        asset: true,
        product: true,
        certificate: true,
      },
    }),
    prisma.certificate.findMany({
      where: { buyerId: user.id },
      orderBy: { issuedAt: "desc" },
      include: {
        seller: { select: { displayName: true, username: true } },
      },
    }),
    prisma.subscriberGrant.findMany({
      where: { subscriberId: user.id },
      include: {
        tier: {
          include: {
            creator: {
              include: { user: { select: { displayName: true, username: true } } },
            },
          },
        },
      },
    }),
    prisma.accessGrant.findMany({
      where: { userId: user.id },
      include: {
        burnLink: {
          include: {
            file: true,
            owner: { select: { displayName: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({ where: { sellerId: user.id }, orderBy: { createdAt: "desc" }, take: 15, include: { asset: true, product: true, buyer: { select: { displayName: true, username: true } } } }),
    prisma.invoice.findMany({ where: { OR: [{ issuerId: user.id }, { payerId: user.id }] }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.product.findMany({
      where: { userId: user.id, productType: "BUNDLE", isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { asset: { select: { id: true, title: true, blobRef: true, fileName: true } } } },
      },
    }),
    prisma.asset.findMany({
      where: { userId: user.id, status: "published" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        priceApt: true,
        blobRef: true,
        fileName: true,
        isListed: true,
        createdAt: true,
      },
    }),
    prisma.libraryActivity.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const purchasedAssetIds = new Set(
    purchases.filter((p) => p.asset).map((p) => p.asset!.id)
  );

  const isEmpty =
    purchases.length === 0 &&
    certificates.length === 0 &&
    grants.length === 0 &&
    ownedBundles.length === 0 &&
    ownedAssets.length === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 px-4 lg:px-0">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{t("en", "your_library") || "Library"}</h1>
        <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
          {t("en", "digital_ownership_center") || "Your purchases, bundles, subscriptions, and certificates. Everything in one place."}
        </p>
      </div>

      {isEmpty ? (
        <div className="mx-4 card flex flex-col items-center justify-center p-14 text-center lg:mx-0">
          <BookOpen className="mb-5 h-14 w-14 text-[var(--text-muted)]" />
          <h2 className="text-xl font-semibold">{t("en", "nothing_here_yet") || "Your library is empty"}</h2>
          <p className="mt-2 max-w-xs text-[var(--text-secondary)]">
            {t("en", "explore_to_start") || "Discover and buy assets, courses, and creator packs on the marketplace."}
          </p>
          <Link href="/explore" className="btn-primary mt-7">{t("en", "browse_marketplace") || "Explore the marketplace"}</Link>
        </div>
      ) : (
        <div className="px-4 lg:px-0">
          <LibraryTabs
            data={{
              purchases: purchases.map((p) => ({
                id: p.id,
                amountApt: p.amountApt,
                createdAt: p.createdAt.toISOString(),
                asset: p.asset ? {
                  id: p.asset.id,
                  title: p.asset.title,
                  priceApt: p.asset.priceApt,
                  blobRef: p.asset.blobRef,
                  fileName: p.asset.fileName,
                } : null,
                product: p.product,
                certificate: p.certificate,
              })),
              ownedAssets: ownedAssets.map((a) => ({
                id: a.id,
                title: a.title,
                priceApt: a.priceApt,
                blobRef: a.blobRef,
                fileName: a.fileName,
                isListed: a.isListed,
                createdAt: a.createdAt.toISOString(),
                isPurchased: purchasedAssetIds.has(a.id),
              })),
              certificates: certificates.map((c) => ({
                id: c.id,
                certificateId: c.certificateId,
                title: c.title,
                verificationSlug: c.verificationSlug,
                issuedAt: c.issuedAt.toISOString(),
                txHash: c.txHash,
                seller: c.seller,
              })),
              subscriptions: subscriptions.map((s) => ({
                id: s.id,
                status: s.status,
                renewsAt: s.renewsAt.toISOString(),
                tier: s.tier
                  ? {
                      name: s.tier.name,
                      priceApt: s.tier.priceApt,
                      creator: s.tier.creator,
                    }
                  : undefined,
              })),
              grants: grants.map((g) => ({
                id: g.id,
                viewToken: g.viewToken,
                burnLink: g.burnLink,
              })),
              sales: sales.map((s) => ({ id: s.id, title: s.asset?.title || s.product?.title || "Sale", amount: s.amountApt, buyer: s.buyer, createdAt: s.createdAt.toISOString() })),
              invoices: invoices.map((i) => ({ id: i.id, description: i.description, amountApt: i.amountApt, status: i.status, createdAt: i.createdAt.toISOString() })),
              transactions: txs.map((t) => ({ id: t.id, type: t.type, description: t.description, direction: t.direction, amount: t.amountApt, createdAt: t.createdAt.toISOString() })),
              ownedBundles: ownedBundles.map((b) => ({
                id: b.id,
                title: b.title,
                priceApt: b.priceApt,
                isListed: b.isListed,
                createdAt: b.createdAt.toISOString(),
                items: b.items.map((it) => ({
                  asset: it.asset
                    ? {
                        id: it.asset.id,
                        title: it.asset.title,
                        blobRef: it.asset.blobRef,
                        fileName: it.asset.fileName,
                      }
                    : null,
                })),
              })),
              activities: activities.map((a) => ({
                id: a.id,
                type: a.type,
                title: a.title,
                amountApt: a.amountApt,
                assetId: a.assetId,
                productId: a.productId,
                createdAt: a.createdAt.toISOString(),
              })),
            }}
          />
        </div>
      )}
    </div>
  );
}