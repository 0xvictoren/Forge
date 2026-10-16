"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { MODALITIES } from "@/lib/datasets/modalities";
import { GlassSegmented } from "@/components/glass/glass-segmented";

export function BrowseControls() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const modality = params.get("modality") ?? "";
  const sort = (params.get("sort") as "new" | "popular") ?? "new";

  const push = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    start(() => router.replace(`/datasets${sp.toString() ? `?${sp}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) push({ q: q.trim() || null });
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search datasets, tags, sellers"
            className="field h-12 rounded-full pl-11 pr-10"
            aria-label="Search datasets"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--bg-pressed)]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <GlassSegmented
          ariaLabel="Sort"
          value={sort}
          onChange={(v) => push({ sort: v === "new" ? null : v })}
          className="w-[220px] shrink-0"
          options={[
            { value: "new", label: "Newest" },
            { value: "popular", label: "Popular" },
          ]}
        />
      </div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" style={{ opacity: pending ? 0.6 : 1 }}>
        <button type="button" className="chip shrink-0" aria-pressed={!modality} onClick={() => push({ modality: null })}>
          All
        </button>
        {MODALITIES.map((m) => (
          <button key={m.id} type="button" className="chip shrink-0" aria-pressed={modality === m.id} onClick={() => push({ modality: modality === m.id ? null : m.id })}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
