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
  const vault = await prisma.vault.findUnique({ where: { id } });
  if (!vault || vault.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { assetId } = await request.json();
  if (!assetId) {
    return NextResponse.json({ error: "assetId required" }, { status: 400 });
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, userId: user.id },
  });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const link = await prisma.vaultAsset.upsert({
    where: { vaultId_assetId: { vaultId: id, assetId } },
    create: { vaultId: id, assetId },
    update: {},
  });

  return NextResponse.json({ link });
}
