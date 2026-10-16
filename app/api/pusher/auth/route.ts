import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPusherServer } from "@/lib/pusher";

const authSchema = z.object({
  socketId: z.string().regex(/^\d+\.\d+$/),
  channelName: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const parsed = authSchema.safeParse({
    socketId: form.get("socket_id"),
    channelName: form.get("channel_name"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid channel authorization request" }, { status: 400 });
  }

  const { socketId, channelName } = parsed.data;
  let authorized = channelName === `private-user-${user.id}`;

  if (!authorized && channelName.startsWith("private-conversation-")) {
    const conversationId = channelName.slice("private-conversation-".length);
    if (conversationId) {
      authorized = !!(await prisma.participant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId: user.id },
        },
        select: { id: true },
      }));
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: "Realtime service unavailable" }, { status: 503 });
  }

  return NextResponse.json(pusher.authorizeChannel(socketId, channelName), {
    headers: { "Cache-Control": "no-store" },
  });
}
