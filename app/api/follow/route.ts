import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await request.json();
  if (!userId || userId === user.id) {
    return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: userId } },
  });
  if (existing) return NextResponse.json({ ok: true, following: true });

  await prisma.follow.create({
    data: { followerId: user.id, followingId: userId },
  });

  const follower = await prisma.user.findUnique({ where: { id: user.id } });
  await createNotification({
    userId,
    type: "FOLLOW",
    title: "New follower",
    body: `${follower?.displayName || follower?.username || "Someone"} started following you`,
    href: follower?.username ? `/${follower.username}` : "/profile",
  });

  return NextResponse.json({ ok: true, following: true });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await request.json();
  await prisma.follow.deleteMany({
    where: { followerId: user.id, followingId: userId },
  });
  return NextResponse.json({ ok: true, following: false });
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetId = new URL(request.url).searchParams.get("userId");
  if (!targetId) {
    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
    });
    return NextResponse.json({
      following: following.map((f) => f.following),
    });
  }

  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: targetId } },
  });
  return NextResponse.json({ following: !!follow });
}
