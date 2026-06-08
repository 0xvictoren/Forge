import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getNotifications, markNotificationsRead } from "@/lib/notifications";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ notifications: [] });

  const stored = await getNotifications(user.id);

  if (stored.length > 0) {
    return NextResponse.json({ notifications: stored });
  }

  const [tips, txs, subs, follows] = await Promise.all([
    prisma.tip.findMany({
      where: { toUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { from: { select: { username: true, displayName: true } } },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, direction: "IN" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.creatorProfile.findUnique({ where: { userId: user.id } }).then((p) =>
      p
        ? prisma.subscriberGrant.findMany({
            where: { tier: { creatorProfileId: p.id } },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { subscriber: true, tier: true },
          })
        : []
    ),
    prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { follower: true },
    }),
  ]);

  const legacy = [
    ...follows.map((f) => ({
      id: `follow-${f.id}`,
      type: "FOLLOW",
      title: "New follower",
      body: `${f.follower.displayName || f.follower.username} followed you`,
      href: f.follower.username ? `/${f.follower.username}` : "#",
      read: false,
      createdAt: f.createdAt.toISOString(),
    })),
    ...tips.map((t) => ({
      id: `tip-${t.id}`,
      type: "TIP",
      title: "Tip received",
      body: `${t.amountApt} APT from ${t.from.displayName || t.from.username}`,
      href: "/wallet",
      read: false,
      createdAt: t.createdAt.toISOString(),
    })),
    ...txs.map((tx) => ({
      id: `tx-${tx.id}`,
      type: tx.type,
      title: "Payment",
      body: tx.description,
      href: "/wallet",
      read: false,
      createdAt: tx.createdAt.toISOString(),
    })),
    ...subs.map((s) => ({
      id: `sub-${s.id}`,
      type: "SUBSCRIBE",
      title: "New subscriber",
      body: `${s.subscriber.displayName || s.subscriber.username} — ${s.tier.name}`,
      href: "/dashboard",
      read: false,
      createdAt: s.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ notifications: legacy });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await request.json().catch(() => ({}));
  await markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true });
}
