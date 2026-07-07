import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordAnalyticsEvent } from "@/lib/analytics";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.post.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });

  await recordAnalyticsEvent({
    creatorId: post.userId,
    contentId: post.id,
    eventType: "VIEW",
  });

  return NextResponse.json({ ok: true });
}
