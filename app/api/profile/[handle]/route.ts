import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getShelbyPublicUrl } from "@/lib/shelby";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const clean = handle.replace(/^@/, "");
  const session = await getSessionUser();

  const profile = await prisma.creatorProfile.findUnique({
    where: { handle: clean },
    include: { user: true },
  });

  const user = profile?.user ?? (await prisma.user.findUnique({ where: { username: clean } }));
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = session?.id === user.id;

  const [
    uploadCount,
    followerCount,
    followingCount,
    revenueAgg,
    burnLinks,
  ] = await Promise.all([
    prisma.burnLink.count({ where: { userId: user.id, isActive: true } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.transaction.aggregate({
      where: { userId: user.id, direction: "IN" },
      _sum: { amountApt: true },
    }),
    prisma.burnLink.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { file: true },
    }),
  ]);

  let isFollowing = false;
  if (session && !isOwner) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.id, followingId: user.id } },
    });
    isFollowing = !!follow;
  }

  const avatar =
    user.avatarUrl || (user.avatarCid ? getShelbyPublicUrl(user.avatarCid) : null);
  const banner =
    user.bannerUrl || (user.bannerCid ? getShelbyPublicUrl(user.bannerCid) : null);

  return NextResponse.json({
    handle: profile?.handle || user.username || clean,
    user: {
      id: user.id,
      displayName: user.displayName,
      bio: user.bio,
      username: user.username,
      walletAddress: user.walletAddress,
      verified: user.verified,
      websiteUrl: user.websiteUrl,
      skills: user.skills,
      twitterUrl: user.twitterUrl,
      instagramUrl: user.instagramUrl,
      behanceUrl: user.behanceUrl,
      dribbbleUrl: user.dribbbleUrl,
      artstationUrl: user.artstationUrl,
    },
    avatar,
    banner,
    isOwner,
    isFollowing,
    stats: {
      uploads: uploadCount,
      followers: followerCount,
      following: followingCount,
      revenue: revenueAgg._sum.amountApt || 0,
    },
    burnLinks: burnLinks.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title || b.file.fileName,
      mimeType: b.file.mimeType,
      thumbnailUrl: b.file.mimeType.startsWith("image/")
        ? getShelbyPublicUrl(b.file.blobId)
        : null,
      viewCount: b.viewCount,
      createdAt: b.createdAt.toISOString(),
      priceApt: b.priceApt,
    })),
    tiers: profile
      ? await prisma.subscriptionTier.findMany({
          where: { creatorProfileId: profile.id, isActive: true },
          orderBy: { tierIndex: "asc" },
        })
      : [],
  });
}
