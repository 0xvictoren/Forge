import { prisma } from "@/lib/db";
import { reputationLevelFromScore } from "./constants";

/** Recompute creator reputation from sales, subscribers, and reviews proxy. */
export async function updateCreatorReputation(userId: string) {
  const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const [sales, purchases, subs] = await Promise.all([
    prisma.purchase.aggregate({
      where: { sellerId: userId },
      _sum: { amountApt: true },
      _count: true,
    }),
    prisma.purchase.count({ where: { sellerId: userId } }),
    prisma.subscriberGrant.count({
      where: {
        tier: { creatorProfileId: profile.id },
        status: "active",
      },
    }),
  ]);

  const revenue = sales._sum.amountApt || 0;
  const score =
    purchases * 10 +
    revenue * 5 +
    subs * 25 +
    (profile.totalViews || 0) * 0.1;

  const reputationLevel = reputationLevelFromScore(score);

  return prisma.creatorProfile.update({
    where: { id: profile.id },
    data: {
      reputationScore: score,
      reputationLevel,
      totalEarnings: revenue,
    },
  });
}
