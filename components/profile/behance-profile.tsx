"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, FileText, GripVertical, Trash2, Plus } from "lucide-react";
import { VerifiedBadge } from "@/components/profile/verified-badge";
import { VerifyButton } from "@/components/profile/verify-button";
import { ProfileFollowButton } from "@/components/profile/profile-follow-button";
import { ShareBurnLink } from "@/components/burnlink/share-burnlink";
import { StorefrontActions } from "@/components/creator/storefront-actions";
import type { Tier } from "@/components/creator/subscribe-modal";
import { formatApt } from "@/lib/utils";
import { FEED_CATEGORIES } from "@/lib/constants-shelby";
import { toast } from "sonner";

function TierQuickAdd({ handle, onAdded }: { handle: string; onAdded: () => void }) {
  const [name, setName] = useState("Monthly Access");
  const [price, setPrice] = useState(5);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, priceApt: price, perks: ["Access to new uploads", "Vault entry"] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Tier added");
      setDesc(""); onAdded();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-1">
      <input className="input text-xs py-1" value={name} onChange={e=>setName(e.target.value)} placeholder="Tier name" />
      <div className="flex gap-1">
        <input type="number" className="input text-xs py-1 w-16" value={price} onChange={e=>setPrice(Number(e.target.value))} />
        <input className="input text-xs py-1 flex-1" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Short benefit" />
        <button onClick={add} disabled={busy} className="btn-accent-ghost text-xs px-2">Add</button>
      </div>
      <p className="text-[10px] text-[var(--text-muted)]">Buyers pay monthly; you must remind to renew (manual for now).</p>
    </div>
  );
}

interface ProfileStats {
  uploads: number;
  followers: number;
  following: number;
  revenue: number;
}

interface BurnLinkRow {
  id: string;
  slug: string;
  title: string;
  mimeType: string;
  thumbnailUrl: string | null;
  viewCount: number;
  createdAt: string;
  priceApt: number;
}

interface ProfileData {
  handle: string;
  user: {
    id: string;
    displayName: string | null;
    bio: string | null;
    username: string | null;
    walletAddress: string | null;
    verified: boolean;
    websiteUrl?: string | null;
    skills: string[];
  };
  avatar: string | null;
  banner: string | null;
  isOwner: boolean;
  isFollowing: boolean;
  stats: ProfileStats;
  burnLinks: BurnLinkRow[];
  tiers: Tier[];
}

const TABS = ["Uploads", "Services"] as const;

export function BehanceProfile({ handle }: { handle: string }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Uploads");
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setSkills(json.user.skills || []);
    }
    setLoading(false);
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSkills = async (next: string[]) => {
    setSkills(next);
    await fetch("/api/users/me/skills", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills: next }),
    });
  };

  if (loading || !data) {
    return <p className="py-20 text-center text-[var(--text-muted)]">Loading profile…</p>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="relative h-[200px] bg-[var(--text-primary)] md:h-[280px]">
        {data.banner && (
          <Image src={data.banner} alt="" fill className="object-cover" priority />
        )}
      </div>

      <div className="mx-auto max-w-[1200px] px-4 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="-mt-16 lg:-mt-20">
            <div className="relative mx-auto h-[120px] w-[120px] overflow-hidden rounded-full border-4 border-[var(--bg-elevated)] bg-[var(--bg-subtle)] shadow-sm lg:mx-0 lg:h-[160px] lg:w-[160px]">
              {data.avatar ? (
                <Image src={data.avatar} alt="" fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl font-bold text-[var(--text-muted)]">
                  {(data.user.displayName || data.handle)[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-1 lg:justify-start">
              <h1 className="text-center text-2xl font-bold lg:text-left">
                {data.user.displayName || data.handle}
              </h1>
              {data.user.verified && <VerifiedBadge className="h-5 w-5" />}
            </div>

            {data.user.walletAddress && (
              <p className="mt-1 text-center text-sm text-[var(--text-muted)] lg:text-left">
                {data.user.walletAddress.slice(0, 6)}…{data.user.walletAddress.slice(-4)}
              </p>
            )}

            {data.user.bio && (
              <p className="mt-4 text-center text-sm leading-relaxed text-[var(--text-secondary)] lg:text-left">
                {data.user.bio}
              </p>
            )}

            <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[var(--text-muted)] lg:justify-start">
              <MapPin className="h-4 w-4" />
              Web3 · Aptos
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
              {[
                { label: "Uploads", value: data.stats.uploads },
                { label: "Followers", value: data.stats.followers },
                { label: "Following", value: data.stats.following },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-[var(--bg-elevated)] p-2">
                  <p className="font-bold text-[var(--text-primary)]">{value}</p>
                  <p className="text-[var(--text-muted)]">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-[var(--text-muted)] lg:text-left">
              Revenue: {formatApt(data.stats.revenue)}
            </p>

            {data.isOwner && (
              <div className="mt-4 rounded-xl border border-[var(--border-dim)] p-3 text-xs">
                <div className="font-semibold mb-2">Subscription tiers ({data.tiers?.length || 0})</div>
                <div className="space-y-1 mb-2 max-h-24 overflow-auto">
                  {(data.tiers || []).map((t: any) => (
                    <div key={t.id} className="flex justify-between bg-[var(--bg-elevated)] px-2 py-1 rounded">
                      <span>{t.name}</span>
                      <span className="text-[var(--accent)]">{formatApt(t.priceApt)}/mo</span>
                    </div>
                  ))}
                  {(!data.tiers || data.tiers.length === 0) && <div className="text-[var(--text-muted)]">No tiers yet — add below.</div>}
                </div>
                <TierQuickAdd handle={data.handle} onAdded={load} />
              </div>
            )}

            {data.isOwner && !data.user.verified && <VerifyButton />}

            <div className="mt-4">
              {data.isOwner ? (
                <Link href="/onboarding" className="btn-primary block w-full text-center">
                  Edit Profile
                </Link>
              ) : data.user.walletAddress ? (
                <div className="space-y-2">
                  <ProfileFollowButton
                    userId={data.user.id}
                    initialFollowing={data.isFollowing}
                    isOwner={data.isOwner}
                  />
                  <StorefrontActions
                    creatorHandle={data.handle}
                    creatorAddress={data.user.walletAddress}
                    tiers={data.tiers}
                  />
                </div>
              ) : null}
            </div>
          </aside>

          <div className="pb-16 pt-4 lg:pt-6">
            <div className="flex flex-wrap gap-1 border-b border-[var(--border-dim)]">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-4 py-3 text-sm font-semibold ${
                    tab === t
                      ? "border-b-2 border-[var(--brand)] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === "Uploads" && (
                <div>
                  {data.isOwner && (
                    <Link href="/upload" className="btn-primary mb-4 inline-flex">
                      New upload
                    </Link>
                  )}
                  {data.burnLinks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--border-default)] py-16 text-center">
                      <p className="text-[var(--text-muted)]">No uploads yet</p>
                      {data.isOwner && (
                        <Link href="/upload" className="btn-primary mt-4 inline-flex">
                          Upload file
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {data.burnLinks.map((bl) => (
                        <div key={bl.id} className="card overflow-hidden">
                          <div className="relative aspect-square bg-[var(--bg-subtle)]">
                            {bl.thumbnailUrl ? (
                              <Image src={bl.thumbnailUrl} alt="" fill className="object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <FileText className="h-10 w-10 text-[var(--text-muted)]" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="truncate text-sm font-semibold">{bl.title}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {bl.mimeType.split("/")[1]?.toUpperCase() || "FILE"} ·{" "}
                              {new Date(bl.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{bl.viewCount} unlocks</p>
                            <div className="mt-2">
                              <ShareBurnLink slug={bl.slug} compact />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "Services" && (
                <div>
                  {data.isOwner ? (
                    <div className="space-y-4">
                      <p className="text-sm text-[var(--text-secondary)]">
                        Add skills that describe your creative services.
                      </p>
                      <ul className="space-y-2">
                        {skills.map((skill, idx) => (
                          <li
                            key={skill}
                            className="card flex items-center gap-2 p-3"
                          >
                            <GripVertical className="h-4 w-4 text-[var(--text-muted)]" />
                            <span className="flex-1 text-sm font-medium">{skill}</span>
                            <button
                              type="button"
                              className="rounded p-1 hover:bg-[var(--bg-hover)]"
                              onClick={() => {
                                const next = skills.filter((_, i) => i !== idx);
                                saveSkills(next);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <select
                          className="input flex-1"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                        >
                          <option value="">Add skill…</option>
                          {FEED_CATEGORIES.filter((c) => !skills.includes(c)).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!newSkill}
                          onClick={() => {
                            if (!newSkill || skills.includes(newSkill)) return;
                            saveSkills([...skills, newSkill]);
                            setNewSkill("");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.user.skills.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">No skills listed.</p>
                      ) : (
                        data.user.skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-[var(--accent-dim)] px-3 py-1 text-sm font-semibold text-[var(--brand)]"
                          >
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
