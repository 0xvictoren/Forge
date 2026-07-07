import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.asset.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });
  return NextResponse.json({ success: true });
}
