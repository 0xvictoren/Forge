import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [events, purchases, assets, vaults, referral] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { creatorId: user.id, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.groupBy({
      by: ["assetId"],
      where: { sellerId: user.id, createdAt: { gte: thirtyDaysAgo } },
      _sum: { amountApt: true },
      _count: true,
    }),
    prisma.asset.findMany({
      where: { userId: user.id },
      orderBy: { purchaseCount: "desc" },
      take: 5,
      select: { id: true, title: true, purchaseCount: true, viewCount: true, priceApt: true },
    }),
    prisma.vault.findMany({
      where: { userId: user.id },
      include: { _count: { select: { assets: true } } },
    }),
    prisma.referralCode.findUnique({ where: { userId: user.id } }),
  ]);

  const views = events.filter((e) => e.eventType === "VIEW").length;
  const unlocks = events.filter((e) => e.eventType === "UNLOCK").length;
  const revenue = events
    .filter((e) => e.eventType === "PURCHASE" || e.eventType === "UNLOCK")
    .reduce((s, e) => s + (e.amountApt || 0), 0);

  const conversionRate = views > 0 ? ((unlocks / views) * 100).toFixed(1) : "0";

  return NextResponse.json({
    summary: { views, unlocks, revenue, conversionRate },
    topAssets: assets,
    vaults: vaults.map((v) => ({
      id: v.id,
      name: v.name,
      assets: v._count.assets,
      views: v.viewCount,
    })),
    referral,
    recentEvents: events.slice(0, 20),
  });
}
