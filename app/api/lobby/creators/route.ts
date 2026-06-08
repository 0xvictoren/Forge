import { NextResponse } from "next/server";
import { getLobbyCreators } from "@/lib/feed";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || undefined;
  const skill = searchParams.get("skill") || undefined;
  const page = Number(searchParams.get("page") || 1);
  const user = await getSessionUser();

  const { creators, hasMore } = await getLobbyCreators({ q, skill, page });

  let followingSet = new Set<string>();
  if (user) {
    const follows = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    followingSet = new Set(follows.map((f) => f.followingId));
  }

  return NextResponse.json({
    creators: creators.map((c) => ({
      ...c,
      isFollowing: followingSet.has(c.id),
    })),
    hasMore,
  });
}
