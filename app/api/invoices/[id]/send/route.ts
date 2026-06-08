import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPusherServer, conversationChannel } from "@/lib/pusher";
import { createNotification } from "@/lib/notifications";

async function findOrCreateConversation(userId: string, recipientId: string) {
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: recipientId } } },
      ],
    },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId }, { userId: recipientId }],
      },
    },
  });
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
  const { recipientUserId } = await request.json();

  if (!recipientUserId) {
    return NextResponse.json({ error: "Recipient required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id, issuerId: user.id },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const conversation = await findOrCreateConversation(user.id, recipientUserId);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user.id,
      type: "INVOICE",
      content: JSON.stringify({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amountApt: invoice.amountApt,
        currency: invoice.currency,
        description: invoice.description,
        status: invoice.status,
      }),
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  const pusher = getPusherServer();
  if (pusher) {
    await pusher.trigger(conversationChannel(conversation.id), "new-message", message);
  }

  await createNotification({
    userId: recipientUserId,
    type: "INVOICE",
    title: "Invoice received",
    body: `${user.displayName || user.username || "Someone"} sent invoice ${invoice.invoiceNumber}`,
    href: `/chat/${conversation.id}`,
  });

  return NextResponse.json({ message, conversationId: conversation.id });
}
