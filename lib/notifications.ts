import { prisma } from "./db";
import { getPusherServer, userChannel } from "./pusher";

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
}) {
  const notification = await prisma.notification.create({ data: input });

  const pusher = getPusherServer();
  if (pusher) {
    await pusher.trigger(userChannel(input.userId), "notification", notification);
  }

  return notification;
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  return prisma.notification.updateMany({
    where: ids?.length
      ? { userId, id: { in: ids } }
      : { userId, read: false },
    data: { read: true },
  });
}
