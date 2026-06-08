"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { VerifiedBadge } from "@/components/profile/verified-badge";
import { VerifyButton } from "@/components/profile/verify-button";
import { useAppStore } from "@/lib/store";
import { formatApt } from "@/lib/utils";

type SidebarProfile = {
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  skills: string[];
  socials: {
    twitter?: string | null;
    instagram?: string | null;
    behance?: string | null;
    dribbble?: string | null;
    artstation?: string | null;
  };
  stats: { uploads: number; followers: number; revenue: number };
};

const SOCIAL_LABELS: { key: keyof SidebarProfile["socials"]; label: string }[] = [
  { key: "twitter", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "behance", label: "Behance" },
  { key: "dribbble", label: "Dribbble" },
  { key: "artstation", label: "ArtStation" },
];

export function ProfileSidebar() {
  const { user } = useAppStore();
  const [profile, setProfile] = useState<SidebarProfile | null>(null);

  const loadProfile = useCallback(() => {
    if (!user?.username) return;
    fetch(`/api/profile/${encodeURIComponent(user.username)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setProfile({
            username: d.user.username,
            displayName: d.user.displayName,
            bio: d.user.bio,
            avatarUrl: d.avatar,
            verified: d.user.verified,
            skills: d.user.skills || [],
            socials: {
              twitter: d.user.twitterUrl,
              instagram: d.user.instagramUrl,
              behance: d.user.behanceUrl,
              dribbble: d.user.dribbbleUrl,
              artstation: d.user.artstationUrl,
            },
            stats: d.stats || { uploads: 0, followers: 0, revenue: 0 },
          });
        }
      })
      .catch(() => {});
  }, [user?.username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, user?.verified]);

  const handle = profile?.username || user?.username;

  if (!handle) {
    return (
      <aside className="hidden w-80 shrink-0 border-l border-[var(--border-dim)] bg-[var(--bg-elevated)] p-6 xl:block">
        <p className="text-sm text-[var(--text-muted)]">
          Connect your wallet to upload and share files — profile setup is optional.
        </p>
        <Link href="/onboarding" className="btn-primary mt-4 block text-center text-sm">
          Set up profile
        </Link>
        <Link href="/upload" className="btn-ghost mt-2 block text-center text-sm">
          Upload without profile
        </Link>
      </aside>
    );
  }

  const activeSocials = SOCIAL_LABELS.filter(({ key }) => profile?.socials[key]);

  return (
    <aside className="hidden w-80 shrink-0 border-l border-[var(--border-dim)] bg-[var(--bg-elevated)] p-6 xl:block">
      <div className="sticky top-20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-[var(--bg-subtle)]">
            {profile?.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="" fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center text-xl font-bold text-[var(--text-muted)]">
                {(profile?.displayName || handle)[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="inline-flex items-center gap-1 font-bold">
              {profile?.displayName || handle}
              {profile?.verified && <VerifiedBadge className="h-4 w-4" />}
            </p>
            <p className="text-sm text-[var(--text-muted)]">@{handle}</p>
          </div>
        </div>

        {profile?.bio && (
          <p className="line-clamp-3 text-sm text-[var(--text-secondary)]">{profile.bio}</p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-[var(--bg-subtle)] p-2">
            <p className="font-bold">{profile?.stats.uploads ?? 0}</p>
            <p className="text-[var(--text-muted)]">Uploads</p>
          </div>
          <div className="rounded-lg bg-[var(--bg-subtle)] p-2">
            <p className="font-bold">{profile?.stats.followers ?? 0}</p>
            <p className="text-[var(--text-muted)]">Followers</p>
          </div>
          <div className="rounded-lg bg-[var(--bg-subtle)] p-2">
            <p className="font-bold text-[var(--brand)]">
              {formatApt(profile?.stats.revenue ?? 0, 2)}
            </p>
            <p className="text-[var(--text-muted)]">Revenue</p>
          </div>
        </div>

        {profile?.skills && profile.skills.length > 0 && (
          <div>
            <p className="label-caps mb-2">Skills</p>
            <div className="flex flex-wrap gap-1">
              {profile.skills.slice(0, 8).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[var(--accent-dim)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {activeSocials.length > 0 && (
          <div>
            <p className="label-caps mb-2">Links</p>
            <ul className="space-y-1">
              {activeSocials.map(({ key, label }) => {
                const url = profile?.socials[key];
                if (!url) return null;
                return (
                  <li key={key}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      {label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!profile?.verified && <VerifyButton onVerified={loadProfile} />}

        <Link href={`/${handle}`} className="btn-ghost block w-full text-center text-sm">
          View public profile
        </Link>
        <Link href="/onboarding" className="btn-primary block w-full text-center text-sm">
          Edit profile
        </Link>
      </div>
    </aside>
  );
}
