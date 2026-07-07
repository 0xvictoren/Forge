"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  otherUser?: {
    id: string;
    username: string | null;
    displayName: string | null;
  };
  lastMessage?: string | null;
  updatedAt: string;
}

export function ConversationList() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setItems(d.conversations || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-4 text-[var(--text-muted)]">Loading…</p>;
  }

  if (!items.length) {
    return (
      <p className="p-4 text-center text-[var(--text-muted)]">
        No conversations yet
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border-dim)]">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/chat/${c.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--bg-hover)]"
          >
            <div className="flex justify-between">
              <span className="font-medium">
                {c.otherUser?.displayName ||
                  c.otherUser?.username ||
                  "User"}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
              </span>
            </div>
            <p className="line-clamp-1 text-sm text-[var(--text-secondary)]">
              {c.lastMessage || "No messages"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
