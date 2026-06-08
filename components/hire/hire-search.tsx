"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HireSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();

  const go = () => {
    if (!q.trim()) return;
    router.push(`/hire?q=${encodeURIComponent(q)}&skill=`);
  };

  return (
    <div className="mx-auto mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
      <input
        className="input flex-1 !rounded-lg !bg-white/95"
        placeholder="I'm looking for…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") go();
        }}
      />
      <button
        type="button"
        className="btn-primary shrink-0 !bg-[var(--text-primary)]"
        onClick={go}
      >
        Search Creators
      </button>
    </div>
  );
}
