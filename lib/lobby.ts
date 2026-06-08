import { prisma } from "@/lib/db";
import { getShelbyPublicUrl } from "@/lib/shelby";
import type { ProjectCardData } from "@/components/explore/project-card";

export async function getLobbyProjects(): Promise<ProjectCardData[]> {
  const content = await prisma.creatorContent.findMany({
    where: { isActive: true },
    take: 24,
    orderBy: { viewCount: "desc" },
    include: {
      creator: { include: { user: true } },
    },
  });

  return content.map((item) => ({
    id: item.id,
    title: item.title,
    thumbnailUrl: item.thumbnailCid
      ? getShelbyPublicUrl(item.thumbnailCid)
      : getShelbyPublicUrl(item.shelbyCid),
    thumbnailCid: item.thumbnailCid || undefined,
    creatorName: item.creator.user.displayName || item.creator.handle,
    creatorHandle: item.creator.handle,
    creatorAvatar: item.creator.user.avatarUrl || undefined,
    likes: item.purchaseCount,
    views: item.viewCount,
    priceApt: item.priceApt,
    accessLevel: item.accessLevel,
    verified: item.creator.user.verified,
    href: `/${item.creator.handle}`,
  }));
}
