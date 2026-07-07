import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await prisma.vault.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { assets: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const memberOf = await prisma.vaultMember.findMany({
    where: { userId: user.id, vault: { userId: { not: user.id } } },
    include: {
      vault: {
        include: { _count: { select: { assets: true } } },
      },
    },
  });

  const published = await prisma.vault.findMany({
    where: { isPublished: true, visibility: "public" },
    take: 12,
    include: {
      owner: { select: { displayName: true, username: true } },
      _count: { select: { assets: true } },
    },
  });

  return NextResponse.json({
    owned,
    shared: memberOf.map((m) => ({ ...m.vault, role: m.role })),
    published,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const vault = await prisma.vault.create({
    data: {
      userId: user.id,
      name: body.name,
      description: body.description,
      vaultType: body.vaultType || "PRIVATE",
      visibility: body.visibility || "private",
      priceApt: body.priceApt != null ? Number(body.priceApt) : null,
      isPublished: !!body.isPublished,
    },
  });

  await prisma.vaultMember.create({
    data: { vaultId: vault.id, userId: user.id, role: "OWNER" },
  });

  return NextResponse.json({ vault });
}
