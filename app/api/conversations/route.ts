import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const participants = await prisma.participant.findMany({
    where: { userId: user.id },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const conversations = participants
    .map((p) => {
    const others = p.conversation.participants.filter(
      (x) => x.userId !== user.id
    );
    const other = others[0]?.user;
    const last = p.conversation.messages[0];
    return {
      id: p.conversation.id,
      otherUser: other,
      lastMessage: last?.content,
      updatedAt: p.conversation.updatedAt,
    };
  })
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetUserId } = await request.json();
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  const existing = await prisma.participant.findMany({
    where: { userId: user.id },
    include: { conversation: { include: { participants: true } } },
  });

  for (const p of existing) {
    const ids = p.conversation.participants.map((x) => x.userId);
    if (ids.includes(targetUserId) && ids.includes(user.id) && ids.length === 2) {
      return NextResponse.json({ conversationId: p.conversationId });
    }
  }

  const conv = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: user.id }, { userId: targetUserId }],
      },
    },
  });

  return NextResponse.json({ conversationId: conv.id });
}
