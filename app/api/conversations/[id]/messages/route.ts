import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPusherServer, conversationChannel } from "@/lib/pusher";
import { createNotification } from "@/lib/notifications";

async function assertParticipant(conversationId: string, userId: string) {
  const p = await prisma.participant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return !!p;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await assertParticipant(id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await assertParticipant(id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content, burnLinkId } = await request.json();

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      senderId: user.id,
      content: content || null,
      burnLinkId: burnLinkId || null,
      type: burnLinkId ? "BURNLINK" : "TEXT",
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const participants = await prisma.participant.findMany({
    where: { conversationId: id, userId: { not: user.id } },
    select: { userId: true },
  });

  for (const p of participants) {
    await createNotification({
      userId: p.userId,
      type: "MESSAGE",
      title: "New message",
      body: content?.slice(0, 120) || "You received a new message",
      href: `/chat/${id}`,
    });
  }

  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  const pusher = getPusherServer();
  if (pusher) {
    await pusher.trigger(conversationChannel(id), "new-message", message);
  }

  return NextResponse.json({ message });
}
