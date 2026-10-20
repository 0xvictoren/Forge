"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Ten soft pills, Apple-style. Shown to licence holders only. */
export function RateDataset({ datasetId, initial }: { datasetId: string; initial?: number | null }) {
  const [score, setScore] = useState<number | null>(initial ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function rate(n: number) {
    setScore(n);
    setSaving(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/rating`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: n }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save your rating");
      toast.success("Thanks. Your rating helps others find good data.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your rating");
    } finally {
      setSaving(false);
    }
  }

  const shown = hover ?? score;
  return (
    <div className="surface mt-4 p-5">
      <p className="text-[15px] font-semibold">How useful was this data?</p>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Rate it out of 10. Ratings shape what buyers and agents see first.</p>
      <div className="mt-4 flex gap-1" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <motion.button
            key={n}
            type="button"
            whileTap={{ scale: 0.9 }}
            disabled={saving}
            onMouseEnter={() => setHover(n)}
            onClick={() => rate(n)}
            aria-label={`${n} out of 10`}
            className={cn(
              "h-9 flex-1 rounded-full text-[13px] font-semibold tabular transition-colors duration-200",
              shown != null && n <= shown ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            )}
          >
            {n}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
