"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store";
import { useI18n } from "@/components/providers/i18n-provider";
import { parseJsonResponse } from "@/lib/fetch-json";

interface UserResult {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export function NewDmModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [following, setFollowing] = useState<UserResult[]>([]);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/follow")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.following || []) as UserResult[];
        setFollowing(list.filter((u) => u.id !== user?.id));
      });
  }, [open, user?.id]);

  useEffect(() => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await parseJsonResponse<{ users: UserResult[] }>(res);
        setSearchResults((data.users || []).filter((u) => u.id !== user?.id));
      } catch {
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, user?.id]);

  const startChat = async (userId: string) => {
    if (userId === user?.id) return;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    });
    const data = await parseJsonResponse<{ conversationId?: string; error?: string }>(res);
    if (data.conversationId) {
      onOpenChange(false);
      window.location.href = `/chat/${data.conversationId}`;
    }
  };

  const UserRow = ({ u }: { u: UserResult }) => (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-[var(--bg-hover)]"
      onClick={() => startChat(u.id)}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        {u.avatarUrl && <Image src={u.avatarUrl} alt="" fill className="object-cover" unoptimized />}
      </div>
      <div>
        <p className="font-semibold">{u.displayName || u.username}</p>
        <p className="text-xs text-[var(--text-muted)]">@{u.username}</p>
      </div>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("new_message")}>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-10"
            placeholder={t("search_username")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {q.trim() ? (
          <div className="mt-4 max-h-64 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-[var(--text-muted)]">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="p-4 text-sm text-[var(--text-muted)]">{t("no_users")}</p>
            ) : (
              searchResults.map((u) => <UserRow key={u.id} u={u} />)
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="label-caps mb-2">{t("following")}</p>
            <div className="max-h-64 overflow-y-auto">
              {following.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  You&apos;re not following anyone yet.{" "}
                  <Link href="/hire" className="text-[var(--brand)]">
                    Discover creators
                  </Link>
                </p>
              ) : (
                following.map((u) => <UserRow key={u.id} u={u} />)
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
