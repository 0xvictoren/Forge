import { prisma } from "./db";
import { getShelbyPublicUrl } from "./shelby";
import type { ProjectCardData } from "@/components/explore/project-card";
import { purgeExpiredBurnLinks } from "./shelby-expiry";

export async function getFeedBurnLinks(options: {
  tab: "recommended" | "following";
  page?: number;
  take?: number;
  userId?: string;
}): Promise<{ items: ProjectCardData[]; hasMore: boolean }> {
  await purgeExpiredBurnLinks(10);

  const take = options.take || 24;
  const skip = ((options.page || 1) - 1) * take;

  let followingIds: string[] = [];
  if (options.tab === "following") {
    if (!options.userId) return { items: [], hasMore: false };
    const follows = await prisma.follow.findMany({
      where: { followerId: options.userId },
      select: { followingId: true },
    });
    followingIds = follows.map((f) => f.followingId);
    if (followingIds.length === 0) return { items: [], hasMore: false };
  }

  const links = await prisma.burnLink.findMany({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(options.tab === "following" ? { userId: { in: followingIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: take + 1,
    include: {
      file: true,
      owner: { include: { creatorProfile: true } },
    },
  });

  const hasMore = links.length > take;
  const items: ProjectCardData[] = links.slice(0, take).map((link) => ({
    id: link.id,
    title: link.title || link.file.fileName,
    thumbnailUrl: getShelbyPublicUrl(link.file.blobId),
    creatorName: link.owner.displayName || link.owner.username || "Creator",
    creatorHandle:
      link.owner.creatorProfile?.handle || link.owner.username || "",
    creatorAvatar: link.owner.avatarUrl || undefined,
    likes: 0,
    views: link.viewCount,
    priceApt: link.priceApt,
    verified: link.owner.verified,
    slug: link.slug,
    href: `/b/${link.slug}`,
  }));

  return { items, hasMore };
}

export async function getLobbyCreators(options: {
  q?: string;
  skill?: string;
  page?: number;
  take?: number;
}) {
  const take = options.take || 20;
  const skip = ((options.page || 1) - 1) * take;

  const users = await prisma.user.findMany({
    where: {
      username: { not: null },
      displayName: { not: null },
      walletAddress: { not: null },
      ...(options.q
        ? {
            OR: [
              { username: { contains: options.q } },
              { displayName: { contains: options.q } },
              { bio: { contains: options.q } },
            ],
          }
        : {}),
      ...(options.skill ? { skills: { has: options.skill } } : {}),
    },
    skip,
    take: take + 1,
    include: {
      creatorProfile: true,
      _count: { select: { followers: true, following: true, burnLinks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const hasMore = users.length > take;
  return {
    creators: users.slice(0, take).map((u) => {
      const avatarRef = u.avatarCid || u.avatarUrl || null;
      const avatarUrl = avatarRef
        ? avatarRef.startsWith("http")
          ? avatarRef
          : getShelbyPublicUrl(avatarRef)
        : null;
      return {
        id: u.id,
        username: u.username,
        handle: u.creatorProfile?.handle || u.username,
        displayName: u.displayName,
        bio: u.bio,
        avatarUrl,
        avatarRef: avatarRef && !avatarRef.startsWith("http") ? avatarRef : null,
        twitterUrl: u.twitterUrl,
        instagramUrl: u.instagramUrl,
        youtubeUrl: u.youtubeUrl,
        websiteUrl: u.websiteUrl,
        skills: u.skills,
        verified: u.verified,
        followerCount: u._count.followers,
        followingCount: u._count.following,
        uploadCount: u._count.burnLinks,
      };
    }),
    hasMore,
  };
}

/** @deprecated use getFeedBurnLinks */
export async function getFeedPosts(options: {
  tab: "recommended" | "following";
  category?: string;
  userId?: string;
  page?: number;
  take?: number;
}) {
  return getFeedBurnLinks(options);
}
