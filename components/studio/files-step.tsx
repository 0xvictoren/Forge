"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, Eye, FolderOpen, Loader2, Lock, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useDatasetUpload, type UploadItem } from "@/hooks/use-dataset-upload";
import { formatBytes } from "@/lib/datasets/modalities";
import { cn } from "@/lib/utils";
import { getSponsorStatus, type SponsorStatus } from "@/lib/storage/sponsored-upload";

const STATUS: Record<UploadItem["status"], string> = {
  queued: "Ready",
  hashing: "Hashing",
  encrypting: "Encrypting",
  uploading: "Uploading to Shelby",
  registering: "Registering",
  done: "Stored",
  error: "Failed",
};

export type ExistingFile = { id: string; path: string; sizeBytes: number; isSample: boolean };

export function FilesStep({
  datasetId,
  versionId,
  versionNumber,
  existing,
  onUploaded,
  onRemoveExisting,
}: {
  datasetId: string;
  versionId: string;
  versionNumber: number;
  existing: ExistingFile[];
  onUploaded: () => void;
  onRemoveExisting?: (id: string) => void;
}) {
  const { items, add, remove, toggleSample, run, running } = useDatasetUpload();
  const [drag, setDrag] = useState(false);
  const [sponsor, setSponsor] = useState<SponsorStatus | null>(null);
  useEffect(() => {
    getSponsorStatus().then(setSponsor).catch(() => undefined);
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const queued = items.filter((i) => i.status !== "done");
  const totalQueued = queued.reduce((s, i) => s + i.file.size, 0);
  const dataCount = existing.filter((e) => !e.isSample).length;

  async function upload() {
    try {
      const n = await run({ datasetId, versionId, versionNumber });
      if (n) {
        toast.success(`${n} file${n === 1 ? "" : "s"} encrypted and stored on Shelby`);
        onUploaded();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center rounded-[28px] border-2 border-dashed px-6 py-12 text-center transition-all duration-300",
          drag ? "scale-[1.01] border-[var(--accent)] bg-[var(--accent-dim)]" : "border-[var(--border-default)]"
        )}
      >
        <motion.span
          animate={drag ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent-ink)]"
        >
          <CloudUpload className="h-7 w-7" />
        </motion.span>
        <p className="title mt-5">Drop your dataset here</p>
        <p className="mt-1 max-w-md text-[14px] text-[var(--text-secondary)]">
          Files are hashed and encrypted on this device before upload. Mark a few as free samples, those stay public.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className="btn-primary btn-sm">
            Choose files
          </button>
          <button type="button" onClick={() => folderInput.current?.click()} className="btn-secondary btn-sm">
            <FolderOpen className="h-4 w-4" /> Choose a folder
          </button>
        </div>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => (add(Array.from(e.target.files || [])), (e.target.value = ""))} />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => (add(Array.from(e.target.files || [])), (e.target.value = ""))}
        />
      </div>

      {(existing.length > 0 || items.length > 0) && (
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-dim)] px-5 py-3 text-[13px] text-[var(--text-secondary)]">
            <span>
              {dataCount} stored · {queued.length} to upload
            </span>
            {queued.length > 0 && <span className="tabular">{formatBytes(totalQueued)}</span>}
          </div>
          <ul className="max-h-[420px] divide-y divide-[var(--border-dim)] overflow-auto">
            {existing.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--green)]" />
                <span className="min-w-0 flex-1 truncate text-[14px]">{f.path}</span>
                {f.isSample ? <span className="badge badge-neutral">Sample</span> : <span className="badge badge-paid"><Lock className="h-3 w-3" /> Encrypted</span>}
                <span className="w-16 text-right text-[12px] tabular text-[var(--text-muted)]">{formatBytes(f.sizeBytes)}</span>
                {onRemoveExisting && (
                  <button type="button" onClick={() => onRemoveExisting(f.id)} aria-label={`Remove ${f.path}`} className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--red)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
            <AnimatePresence initial={false}>
              {queued.map((i) => (
                <motion.li key={i.key} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="relative px-5 py-3">
                  <div className="flex items-center gap-3">
                    {i.status === "error" ? (
                      <TriangleAlert className="h-4 w-4 shrink-0 text-[var(--orange)]" />
                    ) : i.status === "queued" ? (
                      <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--border-strong)]" />
                    ) : (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent-ink)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[14px]">{i.path}</span>
                    <button
                      type="button"
                      disabled={i.status !== "queued"}
                      onClick={() => toggleSample(i.key)}
                      className={cn("badge transition-colors", i.isSample ? "badge-neutral" : "badge-paid")}
                      title="Toggle free sample"
                    >
                      {i.isSample ? <Eye className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {i.isSample ? "Sample" : "Encrypted"}
                    </button>
                    <span className="w-16 text-right text-[12px] tabular text-[var(--text-muted)]">{formatBytes(i.file.size)}</span>
                    <button type="button" disabled={running} onClick={() => remove(i.key)} aria-label={`Remove ${i.path}`} className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--red)] disabled:opacity-30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {i.status !== "queued" && (
                    <div className="mt-2 flex items-center gap-3 pl-7">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                        <motion.div className={cn("h-full rounded-full", i.status === "error" ? "bg-[var(--orange-solid)]" : "bg-[var(--accent)]")} animate={{ width: `${Math.round(i.progress * 100)}%` }} transition={{ ease: "easeOut" }} />
                      </div>
                      <span className={cn("text-[12px]", i.status === "error" ? "text-[var(--orange)]" : "text-[var(--text-secondary)]")}>{i.error || STATUS[i.status]}</span>
                    </div>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {queued.length > 0 && (
        <div className="flex flex-col gap-4 rounded-[24px] bg-[var(--bg-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-semibold">Ready to store on Shelby</p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {sponsor?.enabled
                ? `Forge pays the storage fee (${formatBytes(sponsor.remainingBytes)} of sponsored storage left today). You only sign.`
                : "One wallet signature per batch. Storage fees are paid from your wallet."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={upload} disabled={running} className="btn-primary">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {running ? "Working…" : `Encrypt & upload ${queued.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
