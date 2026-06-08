"use client";

import { useEffect, useState, useRef } from "react";
import { getPusherClient, conversationChannel } from "@/lib/pusher";
import { format } from "date-fns";

interface Message {
  id: string;
  content: string | null;
  type: string;
  createdAt: string;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
  };
}

export function MessageThread({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []));
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;
    const channel = pusher.subscribe(conversationChannel(conversationId));
    channel.bind("new-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(conversationChannel(conversationId));
    };
  }, [conversationId]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      const { message } = await res.json();
      setMessages((prev) => [...prev, message]);
      setText("");
    }
    setSending(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const mine = m.sender.id === currentUserId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-[var(--accent-dim)] text-[var(--text-primary)]"
                    : "bg-[var(--bg-subtle)]"
                }`}
              >
                <p>{m.content}</p>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  {format(new Date(m.createdAt), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-[var(--border-dim)] p-3 flex gap-2">
        <input
          className="input flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
        />
        <button
          type="button"
          className="btn-primary"
          disabled={sending}
          onClick={send}
        >
          Send
        </button>
      </div>
    </div>
  );
}
