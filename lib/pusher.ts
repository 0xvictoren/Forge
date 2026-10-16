import Pusher from "pusher";
import PusherClient from "pusher-js";

export function getPusherServer() {
  if (!process.env.PUSHER_APP_ID) return null;
  return new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || "",
    secret: process.env.PUSHER_SECRET || "",
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us3",
    useTLS: true,
  });
}

export function getPusherClient() {
  if (typeof window === "undefined") return null;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  if (!key) return null;
  return new PusherClient(key, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us3",
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });
}

export const conversationChannel = (id: string) => `private-conversation-${id}`;
export const userChannel = (userId: string) => `private-user-${userId}`;
