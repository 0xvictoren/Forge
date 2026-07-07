"use client";

import { useState } from "react";
import { ConversationList } from "@/components/chat/conversation-list";
import { NewDmModal } from "@/components/chat/new-dm-modal";

export function ChatLayout({ children }: { children: React.ReactNode }) {
  const [dmOpen, setDmOpen] = useState(false);

  return (
    <div className="flex h-full min-h-[480px]">
      <aside className="hidden w-80 shrink-0 flex-col border-r border-[var(--border-dim)] lg:flex">
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
        <div className="flex-1 overflow-y-auto">
          <ConversationList />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>

      <NewDmModal open={dmOpen} onOpenChange={setDmOpen} />
    </div>
  );
}