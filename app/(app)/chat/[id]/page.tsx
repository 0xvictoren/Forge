import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MessageThread } from "@/components/chat/message-thread";
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
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:h-screen">
      <div className="border-b border-[var(--border-dim)] p-4">
        <Link href="/chat" className="text-sm text-[var(--text-secondary)] lg:hidden">
          ← Back
        </Link>
      </div>
      <MessageThread conversationId={id} currentUserId={user.id} />
    </div>
  );
}
