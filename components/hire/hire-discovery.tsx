"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreatorCard, type CreatorCardData } from "@/components/lobby/creator-card";
import { Search } from "lucide-react";
import { FEED_CATEGORIES } from "@/lib/constants-shelby";

function HireDiscoveryContent() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [skill, setSkill] = useState(searchParams.get("skill") || "");
  const [creators, setCreators] = useState<CreatorCardData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p: number, reset: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("q", q);
      if (skill) params.set("skill", skill);
      const res = await fetch(`/api/lobby/creators?${params}`);
      const data = await res.json();
      setCreators((prev) => (reset ? data.creators : [...prev, ...data.creators]));
      setHasMore(data.hasMore);
      setLoading(false);
    },
    [q, skill]
  );

  useEffect(() => {
    setPage(1);
    load(1, true);
  }, [q, skill, load]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 lg:px-8">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-10"
            placeholder="Search creators…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input w-auto min-w-[180px]"
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
        >
          <option value="">All skills</option>
          {FEED_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && creators.length === 0 ? (
          <p className="col-span-full py-16 text-center text-[var(--text-muted)]">
            Loading creators…
          </p>
        ) : creators.length === 0 ? (
          <p className="col-span-full py-16 text-center text-[var(--text-muted)]">
            No creators found.
          </p>
        ) : (
          creators.map((c) => (
            <CreatorCard key={c.id} creator={c} onFollowChange={() => load(1, true)} />
          ))
        )}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            className="btn-ghost"
            disabled={loading}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next, false);
            }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

export function HireDiscovery() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-[var(--text-muted)]">Loading…</p>}>
      <HireDiscoveryContent />
    </Suspense>
  );
}
