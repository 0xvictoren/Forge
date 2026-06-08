"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getPusherClient, userChannel } from "@/lib/pusher";
import { useAppStore } from "@/lib/store";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export function NotificationDropdown() {
  const { user } = useAppStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = () =>
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setItems(d.notifications || []))
      .catch(() => {});

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const channel = pusher.subscribe(userChannel(user.id));
    channel.bind("notification", (n: Notification) => {
      setItems((prev) => [n, ...prev].slice(0, 50));
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(userChannel(user.id));
    };
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 hover:bg-[var(--bg-hover)]"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--red)] ring-2 ring-[var(--bg-elevated)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-[var(--border-dim)] bg-[var(--bg-elevated)] shadow-lg">
          <div className="border-b border-[var(--border-dim)] px-4 py-3">
            <h3 className="font-semibold">Notifications</h3>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!items.length ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                No notifications yet
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href || "#"}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block border-b border-[var(--border-dim)] px-4 py-3 hover:bg-[var(--bg-hover)]",
                      !n.read && "bg-[var(--accent-dim)]"
                    )}
                  >
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
          <Link
            href="/wallet"
            className="block border-t border-[var(--border-dim)] px-4 py-2 text-center text-sm font-semibold text-[var(--accent)] hover:bg-[var(--bg-hover)]"
            onClick={() => setOpen(false)}
          >
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}
