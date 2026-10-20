"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, TriangleAlert } from "lucide-react";
import type { OriginalityReport } from "@/lib/datasets/originality-types";
import { cn } from "@/lib/utils";

const PARTS: { key: keyof OriginalityReport["components"]; label: string; hint: string }[] = [
  { key: "uniqueness", label: "Unique", hint: "Not already on Forge" },
  { key: "value", label: "Added value", hint: "Labels, structure, original capture" },
  { key: "internal", label: "No repeats", hint: "No duplicate files inside the upload" },
  { key: "documentation", label: "Described", hint: "How it was made and why it matters" },
];

export function ScoreRing({ score, size = 112, passed }: { score: number; size?: number; passed: boolean }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const color = passed ? "var(--green-solid)" : score >= 3 ? "var(--orange-solid)" : "var(--red)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-pressed)" strokeWidth={10} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 10) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-semibold leading-none tabular tracking-tight">{score.toFixed(1)}</span>
        <span className="mt-1 text-[11px] text-[var(--text-muted)]">out of 10</span>
      </div>
    </div>
  );
}

export function OriginalityCard({ report, onRemoveFlagged }: { report: OriginalityReport; onRemoveFlagged?: (paths: string[]) => void }) {
  const flagged = [...new Set(report.findings.map((f) => f.path))];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={cn("surface overflow-hidden", !report.passed && "ring-1 ring-[var(--orange-solid)]/40")}
    >
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <ScoreRing score={report.score} passed={report.passed} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)]">
            {report.passed ? <Sparkles className="h-4 w-4 text-[var(--green)]" /> : <TriangleAlert className="h-4 w-4 text-[var(--orange)]" />}
            Originality check
          </p>
          <p className="title mt-1">{report.passed ? "Looks original. Uploading now." : "This needs more of you in it"}</p>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {report.passed
              ? "Your files are compared with everything already on Forge. Buyers see this score on your listing."
              : `Uploads need at least ${report.threshold} out of 10. Nothing has been stored. Make the changes below and try again.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-[var(--border-dim)] bg-[var(--border-dim)] sm:grid-cols-4">
        {PARTS.map((p) => {
          const v = report.components[p.key];
          return (
            <div key={p.key} className="bg-[var(--bg-elevated)] px-4 py-3" title={p.hint}>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-[var(--text-secondary)]">{p.label}</span>
                <span className="text-[13px] font-semibold tabular">{v.toFixed(1)}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--bg-pressed)]">
                <motion.div className={cn("h-full rounded-full", v >= 5 ? "bg-[var(--green-solid)]" : "bg-[var(--orange-solid)]")} initial={{ width: 0 }} animate={{ width: `${v * 10}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {report.tips.length > 0 && (
        <div className="space-y-3 border-t border-[var(--border-dim)] p-6">
          <p className="text-[13px] font-semibold">{report.passed ? "To score higher" : "How to pass"}</p>
          <ol className="space-y-2">
            {report.tips.map((t, i) => (
              <li key={t} className="flex gap-3 text-[14px] text-[var(--text-secondary)]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[11px] font-semibold text-[var(--accent-ink)]">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          {report.matches.some((m) => m.slug) && (
            <p className="text-[13px] text-[var(--text-muted)]">
              Matches:{" "}
              {report.matches
                .filter((m) => m.slug)
                .map((m, i) => (
                  <span key={m.slug}>
                    {i > 0 && ", "}
                    <Link href={`/datasets/${m.slug}`} className="underline underline-offset-2" target="_blank">
                      {m.title}
                    </Link>{" "}
                    ({Math.round(m.share * 100)}%)
                  </span>
                ))}
            </p>
          )}
          {!report.passed && flagged.length > 0 && onRemoveFlagged && (
            <button type="button" onClick={() => onRemoveFlagged(flagged)} className="btn-secondary btn-sm mt-2">
              Remove {flagged.length} flagged file{flagged.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}
      {!report.webChecked && (
        <p className="border-t border-[var(--border-dim)] px-6 py-3 text-[12px] text-[var(--text-muted)]">Compared with Forge&apos;s own catalogue. Web comparison is coming soon.</p>
      )}
    </motion.div>
  );
}
