"use client";

import { useState } from "react";
import { ConversationList } from "@/components/chat/conversation-list";
import { NewDmModal } from "@/components/chat/new-dm-modal";
import { ChatLayout } from "@/components/chat/chat-layout";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  const [dmOpen, setDmOpen] = useState(false);

  return (
    <>
      {/* Mobile layout */}
      <div className="flex h-full min-h-0 flex-col lg:hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-dim)] p-4">
          <h1 className="font-display text-lg font-bold uppercase tracking-wide">Messages</h1>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--brand)]"
            onClick={() => setDmOpen(true)}
          >
            New DM
          </button>
        </div>
        <ConversationList />
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:block">
        <ChatLayout>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <MessageSquare className="h-12 w-12 text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)]">Select a conversation to start chatting</p>
            <button type="button" className="btn-brand" onClick={() => setDmOpen(true)}>
              Start a new DM
            </button>
          </div>
        </ChatLayout>
      </div>

      <NewDmModal open={dmOpen} onOpenChange={setDmOpen} />
    </>
  );
}