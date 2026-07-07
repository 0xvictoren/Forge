import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const comments = await prisma.streamComment.findMany({
    where: { assetId: id },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, displayName: true, username: true } },
    },
    take: 100,
  });
  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const comment = await prisma.streamComment.create({
    data: {
      assetId: id,
      userId: user.id,
      content: content.trim(),
    },
    include: {
      user: { select: { id: true, displayName: true, username: true } },
    },
  });

  return NextResponse.json({ comment });
}
