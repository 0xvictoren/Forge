import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [purchases, certificates, subscriptions, grants, sales, invoices, txs] = await Promise.all([
    prisma.purchase.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        asset: true,
        product: { include: { items: true } },
        vault: true,
        certificate: true,
      },
    }),
    prisma.certificate.findMany({
      where: { buyerId: user.id },
      orderBy: { issuedAt: "desc" },
      include: {
        asset: true,
        product: true,
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
    // Creator sales
    prisma.purchase.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { asset: true, product: true, buyer: { select: { displayName: true, username: true } } },
    }),
    prisma.invoice.findMany({
      where: { OR: [{ issuerId: user.id }, { payerId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const assets = purchases
    .filter((p) => p.asset)
    .map((p) => p.asset);

  const bundles = purchases.filter((p) => p.product?.productType === "BUNDLE");

  return NextResponse.json({
    assets,
    purchases,
    bundles,
    certificates,
    subscriptions,
    grants,
    sales,
    invoices,
    transactions: txs,
    history: purchases, // legacy
  });
}
