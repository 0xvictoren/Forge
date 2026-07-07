import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.assetType !== "VIDEO") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.streamLike.findUnique({
    where: { assetId_userId: { assetId: id, userId: user.id } },
  });

  if (existing) {
    await prisma.streamLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.streamLike.create({
      data: { assetId: id, userId: user.id },
    });
  }

  return NextResponse.json({ success: true });
}
