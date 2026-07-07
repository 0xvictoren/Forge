import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MessageThread } from "@/components/chat/message-thread";
import { ChatLayout } from "@/components/chat/chat-layout";
import Link from "next/link";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const { id } = await params;

  return (
    <>
      {/* Mobile */}
      <div className="flex h-[calc(100vh-120px)] flex-col lg:hidden">
        <div className="border-b border-[var(--border-dim)] p-4">
          <Link href="/chat" className="text-sm font-semibold text-[var(--brand)]">
            ← Back to messages
          </Link>
        </div>
        <MessageThread conversationId={id} currentUserId={user.id} />
      </div>

      {/* Desktop */}
      <div className="hidden lg:block">
        <ChatLayout>
          <MessageThread conversationId={id} currentUserId={user.id} />
        </ChatLayout>
      </div>
    </>
  );
}