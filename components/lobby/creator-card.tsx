"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  UserPlus,
  UserMinus,
  Loader2,
  MessageCircle,
  Globe,
  Link2,
} from "lucide-react";
import { VerifiedBadge } from "@/components/profile/verified-badge";
import { getShelbyPublicUrl } from "@/lib/shelby-public";

export interface CreatorCardData {
  id: string;
  username: string | null;
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarRef?: string | null;
  skills: string[];
  verified: boolean;
  followerCount: number;
  isFollowing?: boolean;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  websiteUrl?: string | null;
}

function avatarSrc(creator: CreatorCardData): string | null {
  if (creator.avatarRef) {
    return getShelbyPublicUrl(creator.avatarRef);
  }
  if (creator.avatarUrl) {
    if (creator.avatarUrl.startsWith("http")) return creator.avatarUrl;
    return getShelbyPublicUrl(creator.avatarUrl);
  }
  return null;
}

function dicebearSeed(handle: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(handle)}`;
}

export function CreatorCard({
  creator,
  onFollowChange,
}: {
  creator: CreatorCardData;
  onFollowChange?: () => void;
}) {
  const [following, setFollowing] = useState(creator.isFollowing ?? false);
  const [loading, setLoading] = useState(false);
  const handle = creator.handle || creator.username;
  const href = handle ? `/@${handle.replace(/^@/, "")}` : "#";
  const src = handle ? avatarSrc(creator) || dicebearSeed(handle) : null;
  const isDicebear = src?.includes("api.dicebear.com");

  const toggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!handle) return;
    setLoading(true);
    const res = await fetch("/api/follow", {
      method: following ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: creator.id }),
    });
    if (res.ok) {
      setFollowing(!following);
      onFollowChange?.();
    }
    setLoading(false);
  };

  const socials = [
    { url: creator.twitterUrl, label: "X" },
    { url: creator.instagramUrl, label: "Instagram" },
    { url: creator.youtubeUrl, label: "YouTube" },
    { url: creator.websiteUrl, icon: Globe, label: "Website" },
  ].filter((s) => s.url);

  return (
    <div className="card relative block overflow-hidden transition-shadow hover:shadow-md">
      <Link href={href} className="absolute inset-0 z-0" aria-label={`View @${handle} profile`} />
      <div className="relative z-[1] flex gap-4 p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          {src ? (
            isDicebear ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
              <Image src={src} alt="" fill className="object-cover" unoptimized={src.startsWith("/api/")} />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-xl font-bold text-[var(--text-muted)]">
              {(creator.displayName || handle || "?")[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-1 font-bold">
                {creator.displayName || handle}
                {creator.verified && <VerifiedBadge className="h-4 w-4" />}
              </p>
              <p className="text-sm text-[var(--text-muted)]">@{handle}</p>
            </div>
            <div className="pointer-events-auto relative z-[2] flex shrink-0 items-center gap-1">
              {handle && (
                <Link
                  href={`/chat?new=1&to=${encodeURIComponent(handle)}`}
                  className="rounded-full p-2 hover:bg-[var(--bg-hover)]"
                  aria-label="Message"
                >
                  <MessageCircle className="h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={toggleFollow}
                disabled={loading}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  following
                    ? "border border-[var(--border-default)] bg-[var(--bg-elevated)]"
                    : "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                }`}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : following ? (
                  <>
                    <UserMinus className="mr-1 inline h-3 w-3" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-1 inline h-3 w-3" /> Follow
                  </>
                )}
              </button>
            </div>
          </div>
          {creator.bio && (
            <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">{creator.bio}</p>
          )}
          {socials.length > 0 && (
            <div className="mt-2 flex gap-2">
              {socials.map(({ url, icon: Icon, label }) => (
                <a
                  key={label}
                  href={url!}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto relative z-[2] rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand)]"
                  aria-label={label}
                >
                  {Icon ? (
                    <Icon className="h-3.5 w-3.5" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                </a>
              ))}
            </div>
          )}
          {creator.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {creator.skills.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[var(--accent-dim)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--text-muted)]">{creator.followerCount} followers</p>
        </div>
      </div>
    </div>
  );
}
