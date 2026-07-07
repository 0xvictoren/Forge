import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNotifications } from "@/lib/notifications";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    recentPurchases,
    recentUploads,
    recommended,
    subscriptions,
    workspaces,
    revenue,
    unreadNotifications,
    storageFiles,
  ] = await Promise.all([
    prisma.purchase.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        asset: true,
        product: true,
        certificate: true,
      },
    }),
    prisma.asset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.asset.findMany({
      where: { status: "published", visibility: "public", userId: { not: user.id } },
      orderBy: { purchaseCount: "desc" },
      take: 6,
      include: {
        owner: { select: { displayName: true, username: true } },
      },
    }),
    prisma.subscriberGrant.findMany({
      where: { subscriberId: user.id, status: "active" },
      include: {
        tier: {
          include: {
            creator: {
              include: { user: { select: { displayName: true, username: true } } },
            },
          },
        },
      },
      take: 5,
    }),
    prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, direction: "IN" },
      _sum: { amountApt: true },
    }),
    getNotifications(user.id).then((n) => n.filter((x) => !x.read).length),
    prisma.file.aggregate({
      where: { userId: user.id },
      _sum: { fileSize: true },
      _count: true,
    }),
  ]);

  const burnLinks = await prisma.burnLink.findMany({
    where: { userId: user.id },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { file: true },
  });

  return NextResponse.json({
    recentPurchases,
    recentUploads,
    recommended,
    subscriptions,
    workspaces,
    revenueApt: revenue._sum.amountApt || 0,
    unreadNotifications,
    storage: {
      bytes: storageFiles._sum.fileSize || 0,
      files: storageFiles._count || 0,
    },
    burnLinks,
  });
}
