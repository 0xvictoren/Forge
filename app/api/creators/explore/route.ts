import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const sort = searchParams.get("sort") || "subscribers";
  const take = 20;
  const skip = (page - 1) * take;

  const orderBy =
    sort === "recent"
      ? { createdAt: "desc" as const }
      : { subscriberCount: "desc" as const };

  try {
    const creators = await prisma.creatorProfile.findMany({
      skip,
      take,
      orderBy,
      include: {
        user: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            avatarCid: true,
            bannerUrl: true,
            verified: true,
          },
        },
        _count: { select: { content: true } },
      },
    });

    return NextResponse.json({ creators, page });
  } catch {
    return NextResponse.json({ creators: [], page });
  }
}
