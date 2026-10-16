"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowUpRight, Download, FileText } from "lucide-react";
import { GlassSegmented } from "@/components/glass/glass-segmented";
import { FileHasher } from "@/components/datasets/file-hasher";
import { formatBytes, shortHash } from "@/lib/datasets/modalities";
import { SOURCE_TYPE_LABELS, type Datasheet, type DatasetManifest } from "@/lib/datasets/manifest";

type Tab = "overview" | "datasheet" | "files" | "proof";

type Version = {
  id: string;
  versionNumber: number;
  manifestHash: string | null;
  datasheetHash: string | null;
  sealHash: string | null;
  anchorTxHash: string | null;
  anchorExplorerUrl: string | null;
  sealedAt: string | Date | null;
  datasheet: Datasheet | null;
  manifest: DatasetManifest | null;
  samples: { id: string; path: string; sizeBytes: number; mimeType: string; url: string }[];
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--border-dim)] py-4 last:border-0 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-[14px] text-[var(--text-secondary)]">{label}</dt>
      <dd className="text-[15px]">{children}</dd>
    </div>
  );
}

function Sample({ s }: { s: Version["samples"][number] }) {
  const isImage = s.mimeType.startsWith("image/");
  const isVideo = s.mimeType.startsWith("video/");
  const isAudio = s.mimeType.startsWith("audio/");
  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--border-dim)] bg-[var(--bg-elevated)]">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.url} alt={s.path} className="aspect-video w-full object-cover" loading="lazy" />
      ) : isVideo ? (
        <video src={s.url} controls preload="metadata" className="aspect-video w-full bg-black" />
      ) : isAudio ? (
        <div className="p-4">
          <audio src={s.url} controls className="w-full" preload="none" />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-[var(--bg-subtle)]">
          <FileText className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="truncate text-[13px] font-medium">{s.path}</span>
        <a href={s.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-[13px] text-[var(--accent-ink)]">
          <Download className="h-3.5 w-3.5" /> {formatBytes(s.sizeBytes)}
        </a>
      </div>
    </div>
  );
}

export function DatasetTabs({ description, version }: { description: string | null; version: Version | null }) {
  const [tab, setTab] = useState<Tab>("overview");
  const d = version?.datasheet;
  const files = version?.manifest?.files ?? [];

  return (
    <div>
      <GlassSegmented
        ariaLabel="Dataset sections"
        value={tab}
        onChange={setTab}
        className="w-full max-w-[460px]"
        options={[
          { value: "overview", label: "Overview" },
          { value: "datasheet", label: "Datasheet" },
          { value: "files", label: "Files" },
          { value: "proof", label: "Proof" },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
        >
          {tab === "overview" && (
            <div>
              {description ? (
                <div className="whitespace-pre-line text-[17px] leading-[1.6] text-[var(--text-primary)]">{description}</div>
              ) : (
                <p className="text-[var(--text-secondary)]">The seller hasn&apos;t added a description yet.</p>
              )}
              {!!version?.samples.length && (
                <div className="mt-10">
                  <h3 className="title">Free samples</h3>
                  <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Public preview files, not part of the licensed manifest.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {version.samples.map((s) => (
                      <Sample key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "datasheet" &&
            (d ? (
              <dl className="surface px-6">
                <Row label="Source">{SOURCE_TYPE_LABELS[d.sourceType]}</Row>
                <Row label="How it was made">{d.sourceDescription}</Row>
                <Row label="Rights held">{d.rightsStatement}</Row>
                <Row label="Personal data">
                  {d.containsPersonalData ? (
                    <span>
                      Yes: <span className="text-[var(--text-secondary)]">{d.consentBasis}</span>
                    </span>
                  ) : (
                    "None declared"
                  )}
                </Row>
                <Row label="Text & data mining opt-outs">{d.respectsTdmOptOut ? "Respected" : "Not declared"}</Row>
                {(d.collectionStart || d.collectionEnd) && (
                  <Row label="Collected">
                    {d.collectionStart || "?"} → {d.collectionEnd || "ongoing"}
                  </Row>
                )}
                {!!d.geographies.length && <Row label="Geographies">{d.geographies.join(", ")}</Row>}
                {!!d.languages.length && <Row label="Languages">{d.languages.join(", ")}</Row>}
                {!!d.modalities.length && <Row label="Modalities">{d.modalities.join(", ")}</Row>}
                {d.processingSteps && <Row label="Processing">{d.processingSteps}</Row>}
                {d.knownLimitations && <Row label="Known limitations">{d.knownLimitations}</Row>}
              </dl>
            ) : (
              <p className="text-[var(--text-secondary)]">No sealed datasheet yet.</p>
            ))}

          {tab === "files" && (
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border-dim)] px-5 py-3.5 text-[13px] text-[var(--text-secondary)]">
                <span>{files.length.toLocaleString()} files in the sealed manifest</span>
                <span className="tabular">{formatBytes(version?.manifest?.totals.totalBytes ?? 0)}</span>
              </div>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Path</th>
                      <th className="px-3 py-2.5 font-medium">Size</th>
                      <th className="hidden px-5 py-2.5 font-medium sm:table-cell">SHA-256</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.slice(0, 1000).map((f) => (
                      <tr key={f.path} className="border-t border-[var(--border-dim)]">
                        <td className="max-w-[280px] truncate px-5 py-2.5 font-medium">{f.path}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular text-[var(--text-secondary)]">{formatBytes(f.sizeBytes)}</td>
                        <td className="mono hidden px-5 py-2.5 text-[12px] text-[var(--text-muted)] sm:table-cell">{shortHash(f.sha256, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {files.length > 1000 && <p className="px-5 py-3 text-[13px] text-[var(--text-muted)]">Showing the first 1,000 files.</p>}
              </div>
            </div>
          )}

          {tab === "proof" && version && (
            <div className="space-y-5">
              <div className="surface p-6">
                <dl className="space-y-4">
                  {[
                    ["Seal", version.sealHash],
                    ["Manifest", version.manifestHash],
                    ["Datasheet", version.datasheetHash],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[13px] text-[var(--text-secondary)]">{k}</dt>
                      <dd className="mono mt-1 break-all text-[13px]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href={`/proof/${version.id}`} className="btn-primary btn-sm">
                    Open full proof
                  </Link>
                  {version.anchorExplorerUrl && (
                    <a href={version.anchorExplorerUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                      Aptos transaction <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <FileHasher manifest={files.map((f) => ({ path: f.path, sha256: f.sha256, sizeBytes: f.sizeBytes }))} compact />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
