import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    events,
    transactions,
    content,
    posts,
    tips,
  ] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { creatorId: user.id, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, direction: "IN", createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "asc" },
    }),
    profile
      ? prisma.creatorContent.findMany({
          where: { creatorProfileId: profile.id },
          select: { id: true, title: true, viewCount: true, purchaseCount: true, priceApt: true },
        })
      : [],
    prisma.post.findMany({
      where: { userId: user.id },
      select: { id: true, viewCount: true, likeCount: true },
    }),
    prisma.tip.aggregate({
      where: { toUserId: user.id },
      _sum: { netApt: true },
    }),
  ]);

  const views = events.filter((e) => e.eventType === "VIEW").length
    + content.reduce((s, c) => s + c.viewCount, 0)
    + posts.reduce((s, p) => s + p.viewCount, 0);

  const unlocks = events.filter((e) => e.eventType === "UNLOCK" || e.eventType === "PURCHASE").length
    + content.reduce((s, c) => s + c.purchaseCount, 0);

  const revenue = transactions.reduce((s, t) => s + t.netApt, 0);

  const dailyMap = new Map<string, { views: number; revenue: number }>();
  for (const e of events) {
    const day = e.createdAt.toISOString().slice(0, 10);
    const cur = dailyMap.get(day) || { views: 0, revenue: 0 };
    if (e.eventType === "VIEW") cur.views++;
    dailyMap.set(day, cur);
  }
  for (const t of transactions) {
    const day = t.createdAt.toISOString().slice(0, 10);
    const cur = dailyMap.get(day) || { views: 0, revenue: 0 };
    cur.revenue += t.netApt;
    dailyMap.set(day, cur);
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return NextResponse.json({
    totals: {
      views,
      unlocks,
      revenue,
      tips: tips._sum.netApt || 0,
      engagement: posts.reduce((s, p) => s + p.likeCount, 0),
      downloads: unlocks,
    },
    contentPerformance: content.map((c) => ({
      id: c.id,
      title: c.title,
      views: c.viewCount,
      purchases: c.purchaseCount,
      revenue: c.purchaseCount * c.priceApt,
    })),
    daily,
  });
}
