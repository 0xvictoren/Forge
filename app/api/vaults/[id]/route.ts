import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function canAccessVault(userId: string, vaultId: string) {
  const vault = await prisma.vault.findUnique({
    where: { id: vaultId },
    include: {
      members: true,
      assets: {
        include: {
          asset: {
            include: { metadata: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      owner: {
        select: { displayName: true, username: true, avatarUrl: true },
      },
    },
  });
  if (!vault) return null;
  const isOwner = vault.userId === userId;
  const member = vault.members.find((m) => m.userId === userId);
  if (!isOwner && !member && !vault.isPublished) return null;
  return { vault, role: member?.role || (isOwner ? "OWNER" : "VIEWER") };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccessVault(user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(access);
}

export async function PATCH(
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

  const body = await request.json();
  const updated = await prisma.vault.update({
    where: { id },
    data: {
      name: body.name ?? vault.name,
      description: body.description ?? vault.description,
      vaultType: body.vaultType ?? vault.vaultType,
      visibility: body.visibility ?? vault.visibility,
      priceApt: body.priceApt != null ? Number(body.priceApt) : vault.priceApt,
      isPublished: body.isPublished ?? vault.isPublished,
    },
  });

  return NextResponse.json({ vault: updated });
}
