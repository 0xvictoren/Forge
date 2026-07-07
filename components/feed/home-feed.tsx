"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectGrid } from "@/components/explore/project-grid";
import { FEED_CATEGORIES } from "@/lib/constants-shelby";
import type { ProjectCardData } from "@/components/explore/project-card";

export function HomeFeed() {
  const [tab, setTab] = useState<"recommended" | "following">("recommended");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ProjectCardData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p: number, reset: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({
        tab,
        page: String(p),
        ...(category ? { category } : {}),
      });
      const res = await fetch(`/api/feed?${params}`);
      const data = await res.json();
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setHasMore(data.hasMore);
      setLoading(false);
    },
    [tab, category]
  );

  useEffect(() => {
    setPage(1);
    load(1, true);
  }, [tab, category, load]);

  return (
    <main className="mx-auto max-w-[1760px] px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-full bg-[var(--bg-subtle)] p-1">
          {(["recommended", "following"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-semibold capitalize ${
                tab === t
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          className="rounded-full border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {FEED_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8">
        {loading && items.length === 0 ? (
          <p className="py-20 text-center text-[var(--text-muted)]">Loading feed…</p>
        ) : items.length === 0 ? (
          <p className="py-20 text-center text-[var(--text-muted)]">
            {tab === "following"
              ? "Follow creators to see their uploads here."
              : "No uploads yet. Share your first BurnLink!"}
          </p>
        ) : (
          <ProjectGrid projects={items} />
        )}
      </div>

      {hasMore && (
        <div className="mt-10 flex justify-center pb-8">
          <button
            type="button"
            disabled={loading}
            className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-8 py-2.5 text-sm font-semibold hover:bg-[var(--bg-hover)]"
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next, false);
            }}
          >
            {loading ? "Loading…" : "Load more work"}
          </button>
        </div>
      )}
    </main>
  );
}
