"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { CheckCircle2, FileSearch, Loader2, XCircle } from "lucide-react";
import { sha256File } from "@/lib/datasets/hash";
import { formatBytes } from "@/lib/datasets/modalities";
import { cn } from "@/lib/utils";

export type ManifestEntry = { path: string; sha256: string; sizeBytes: number };

type Result = { name: string; size: number; sha256: string; match?: ManifestEntry | null };

/**
 * Hash files locally - nothing is uploaded. With a manifest, each file is
 * matched against the sealed hashes so anyone can check a dataset themselves.
 */
export function FileHasher({ manifest, compact = false }: { manifest?: ManifestEntry[]; compact?: boolean }) {
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState<{ name: string; progress: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).slice(0, 50);
      for (const file of list) {
        setBusy({ name: file.name, progress: 0 });
        try {
          const sha256 = await sha256File(file, (p) => setBusy({ name: file.name, progress: p }));
          const match = manifest ? manifest.find((m) => m.sha256 === sha256) ?? null : undefined;
          setResults((r) => [{ name: file.name, size: file.size, sha256, match }, ...r].slice(0, 50));
        } catch {
          setResults((r) => [{ name: file.name, size: file.size, sha256: "error", match: null }, ...r]);
        }
      }
      setBusy(null);
    },
    [manifest]
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) void handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed text-center transition-all duration-300",
          compact ? "px-5 py-8" : "px-6 py-14",
          drag ? "scale-[1.01] border-[var(--accent)] bg-[var(--accent-dim)]" : "border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)]"
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--accent-ink)] shadow-[var(--shadow-sm)]">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSearch className="h-5 w-5" />}
        </span>
        <span className="mt-4 text-[17px] font-semibold">
          {busy ? `Hashing ${busy.name}… ${Math.round(busy.progress * 100)}%` : manifest ? "Drop files to check them against the seal" : "Drop any file to fingerprint it"}
        </span>
        <span className="mt-1 text-[14px] text-[var(--text-secondary)]">Hashed on your device with SHA-256. Nothing is uploaded.</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void handle(e.target.files);
          e.target.value = "";
        }}
      />
      <AnimatePresence initial={false}>
        {results.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-2">
            {results.map((r, i) => (
              <motion.li
                key={`${r.sha256}-${i}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 shadow-[var(--shadow-sm)]"
              >
                {r.match === undefined ? (
                  <FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-ink)]" />
                ) : r.match ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green)]" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[14px] font-medium">{r.name}</p>
                    <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{formatBytes(r.size)}</span>
                  </div>
                  <p className="mono mt-0.5 break-all text-[11px] text-[var(--text-secondary)]">{r.sha256}</p>
                  {r.match !== undefined && (
                    <p className={cn("mt-1 text-[12px] font-medium", r.match ? "text-[var(--green)]" : "text-[var(--red)]")}>
                      {r.match ? `Matches sealed file ${r.match.path}` : "Not in this sealed version, altered or a different file"}
                    </p>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
