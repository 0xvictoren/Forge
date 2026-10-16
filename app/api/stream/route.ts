import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redactSensitiveResponse } from "@/lib/security-response";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "feed";

  let where: any = { assetType: "VIDEO", isStream: true };

  if (tab === "your") {
    where.userId = user.id;
  } else {
    // Feed: public videos visible to everyone + own videos.
    // For "subscribers" and "private": only include if owner (simple; full sub check can be added via joins).
    where.OR = [
      { streamVisibility: "everyone" },
      { userId: user.id },
      // owner always sees their subscribers/private in feed tab too when authenticated
    ];
  }

  const videos = await prisma.asset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      owner: {
        select: { id: true, displayName: true, username: true, walletAddress: true, address: true },
      },
    },
  });

  // Add like count, comment count, isLiked, isPaid for demo
  const enhanced = await Promise.all(videos.map(async (v: any) => {
    const likeCount = await prisma.streamLike.count({ where: { assetId: v.id } });
    const commentCount = await prisma.streamComment.count({ where: { assetId: v.id } });
    const isLiked = await prisma.streamLike.findFirst({ where: { assetId: v.id, userId: user.id } });
    const isPaid = v.streamPriceApt > 0 ? await prisma.purchase.findFirst({ where: { buyerId: user.id, assetId: v.id } }) : true;
    return {
      ...redactSensitiveResponse(v, { redactStorageReferences: !isPaid && v.userId !== user.id }),
      likeCount,
      commentCount,
      isLiked: !!isLiked,
      isPaid: !!isPaid || v.userId === user.id,
    };
  }));

  return NextResponse.json({ videos: enhanced });
}
