"use client";

import { useState } from "react";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";

export function ProfileFollowButton({
  userId,
  initialFollowing,
  isOwner = false,
}: {
  userId: string;
  initialFollowing: boolean;
  isOwner?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  if (isOwner) return null;

  const toggle = async () => {
    setLoading(true);
    const res = await fetch("/api/follow", {
      method: following ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) setFollowing(!following);
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${
        following
          ? "border border-[var(--border-default)] bg-[var(--bg-elevated)]"
          : "bg-[var(--text-primary)] text-[var(--text-inverse)]"
      }`}
    >
      {loading ? (
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
      ) : following ? (
        <>
          <UserMinus className="mr-1 inline h-4 w-4" /> Following
        </>
      ) : (
        <>
          <UserPlus className="mr-1 inline h-4 w-4" /> Follow
        </>
      )}
    </button>
  );
}
