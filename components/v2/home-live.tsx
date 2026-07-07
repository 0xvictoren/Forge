"use client";

import { useEffect } from "react";
import { getPusherClient, userChannel } from "@/lib/pusher";
import { toast } from "sonner";

export function HomeLive({ userId }: { userId: string }) {
  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher || !userId) return;

    const channel = pusher.subscribe(userChannel(userId));

    const handler = (data: any) => {
      if (data?.type === "PURCHASE" || data?.type === "CERTIFICATE") {
        toast.success(data.title || "New activity", { description: data.body });
      } else if (data?.type) {
        toast.info(data.title || "Update", { description: data.body });
      }
      // Could trigger a soft refresh of specific cards here if desired
    };

    channel.bind("notification", handler);

    return () => {
      channel.unbind("notification", handler);
      pusher.unsubscribe(userChannel(userId));
    };
  }, [userId]);

  return null; // invisible live connector
}
