import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const clean = handle.replace(/^@/, "");

  const profile = await prisma.creatorProfile.findUnique({
    where: { handle: clean },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          avatarCid: true,
          bannerUrl: true,
          bannerCid: true,
          walletAddress: true,
          verified: true,
          twitterUrl: true,
          instagramUrl: true,
          youtubeUrl: true,
          websiteUrl: true,
        },
      },
      tiers: { where: { isActive: true }, orderBy: { tierIndex: "asc" } },
      content: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
