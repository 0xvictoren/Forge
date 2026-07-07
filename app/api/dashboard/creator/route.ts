import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [assets, sales, revenueAgg] = await Promise.all([
    prisma.asset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        priceApt: true,
        isListed: true,
        purchaseCount: true,
        viewCount: true,
        assetType: true,
        createdAt: true,
      },
    }),
    prisma.purchase.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        asset: { select: { title: true } },
        product: { select: { title: true } },
        buyer: { select: { displayName: true, username: true } },
      },
    }),
    prisma.purchase.aggregate({
      where: { sellerId: user.id },
      _sum: { netApt: true },
      _count: true,
    }),
  ]);

  const listedCount = assets.filter((a) => a.isListed).length;

  return NextResponse.json({
    assets: assets.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    sales: sales.map((s) => ({
      id: s.id,
      amountApt: s.amountApt,
      createdAt: s.createdAt.toISOString(),
      asset: s.asset,
      product: s.product,
      buyer: s.buyer,
    })),
    stats: {
      totalRevenue: revenueAgg._sum.netApt || 0,
      totalSales: revenueAgg._count || 0,
      listedCount,
      totalAssets: assets.length,
    },
  });
}