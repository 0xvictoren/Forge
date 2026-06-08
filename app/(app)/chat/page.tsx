"use client";

import Link from "next/link";
import { useState } from "react";
import { ConversationList } from "@/components/chat/conversation-list";
import { NewDmModal } from "@/components/chat/new-dm-modal";

export default function ChatPage() {
  const [dmOpen, setDmOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-120px)]">
      <aside className="w-full border-r border-[var(--border-dim)] lg:w-80">
        <div className="flex items-center justify-between border-b border-[var(--border-dim)] p-4">
          <h1 className="text-lg font-bold">Messages</h1>
          <button type="button" className="text-sm font-semibold text-[var(--brand)]" onClick={() => setDmOpen(true)}>
            New DM
          </button>
        </div>
        <ConversationList />
      </aside>
      <div className="hidden flex-1 items-center justify-center text-[var(--text-muted)] lg:flex">
        Select a conversation
      </div>
      <NewDmModal open={dmOpen} onOpenChange={setDmOpen} />
    </div>
  );
}
