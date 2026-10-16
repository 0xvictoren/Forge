"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Ban, Fingerprint, Loader2, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { OffersEditor } from "./offers-editor";
import { GlassSegmented } from "@/components/glass/glass-segmented";
import type { LicenseOffer } from "@/lib/datasets/licenses";
import { cn } from "@/lib/utils";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function PublishControls({ datasetId, status, visibility, canPublish }: { datasetId: string; status: string; visibility: string; canPublish: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (action: "publish" | "unpublish" | "archive", extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await call(`/api/datasets/${datasetId}`, "PATCH", { action, ...extra });
      toast.success(action === "publish" ? "Published" : action === "unpublish" ? "Moved to draft" : "Archived");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  if (status === "EXCLUSIVE_SOLD") return <span className="badge badge-purple">Sold exclusively</span>;
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/studio/new?dataset=${datasetId}`} className="btn-primary btn-sm">
        New version
      </Link>
      {status === "PUBLISHED" ? (
        <button type="button" disabled={busy} onClick={() => act("unpublish")} className="btn-secondary btn-sm">
          Unpublish
        </button>
      ) : (
        <button type="button" disabled={busy || !canPublish} onClick={() => act("publish", visibility === "private" ? {} : undefined)} className="btn-secondary btn-sm">
          Publish
        </button>
      )}
      {status !== "ARCHIVED" && (
        <button type="button" disabled={busy} onClick={() => confirm("Archive this dataset? It will be unlisted. Existing licences stay valid.") && act("archive")} className="btn-ghost btn-sm">
          Archive
        </button>
      )}
    </div>
  );
}

export function OffersPanel({ datasetId, initial }: { datasetId: string; initial: LicenseOffer[] }) {
  const router = useRouter();
  const [offers, setOffers] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(offers) !== JSON.stringify(initial);
  return (
    <div>
      <OffersEditor value={offers} onChange={setOffers} />
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOffers(initial)} className="btn-secondary btn-sm">
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await call(`/api/datasets/${datasetId}`, "PATCH", { offers });
                  toast.success("Pricing saved");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setSaving(false);
                }
              }}
              className="btn-primary btn-sm"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save pricing
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export type LicenseeRow = {
  id: string;
  certificateSlug: string;
  template: string;
  buyer: string;
  orgName: string | null;
  amountApt: number;
  status: string;
  downloadCount: number;
  lastAccessAt: string | null;
  createdAt: string;
  fingerprintId: string;
  versionNumber: number;
};

export function LicenseesTable({ datasetId, rows }: { datasetId: string; rows: LicenseeRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (row: LicenseeRow, action: "revoke" | "reinstate") => {
    const reason = action === "revoke" ? prompt("Why are you revoking this licence? The licensee will see this.") : undefined;
    if (action === "revoke" && !reason) return;
    setBusy(row.id);
    try {
      await call(`/api/datasets/${datasetId}/licenses/${row.id}`, "PATCH", { action, reason: reason || undefined });
      toast.success(action === "revoke" ? "Licence revoked" : "Licence reinstated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };
  if (!rows.length) return <p className="py-6 text-center text-[14px] text-[var(--text-secondary)]">No licences yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead className="text-[12px] text-[var(--text-muted)]">
          <tr>
            <th className="px-4 py-2 font-medium">Licensee</th>
            <th className="px-3 py-2 font-medium">Licence</th>
            <th className="px-3 py-2 font-medium">Paid</th>
            <th className="px-3 py-2 font-medium">Pulls</th>
            <th className="px-3 py-2 font-medium">Fingerprint</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--border-dim)]">
              <td className="px-4 py-3">
                <Link href={`/license/${r.certificateSlug}`} className="font-medium hover:text-[var(--accent-ink)]">
                  {r.orgName || r.buyer}
                </Link>
                <p className="text-[12px] text-[var(--text-muted)]">{new Date(r.createdAt).toLocaleDateString()}</p>
              </td>
              <td className="px-3 py-3">
                <span className="capitalize">{r.template.toLowerCase()}</span> <span className="text-[var(--text-muted)]">· v{r.versionNumber}</span>
              </td>
              <td className="px-3 py-3 tabular">{r.amountApt ? `${r.amountApt} APT` : "Free"}</td>
              <td className="px-3 py-3 tabular">{r.downloadCount}</td>
              <td className="mono px-3 py-3 text-[12px] text-[var(--text-secondary)]">{r.fingerprintId}</td>
              <td className="px-4 py-3 text-right">
                {r.status === "ACTIVE" ? (
                  <button type="button" disabled={busy === r.id} onClick={() => act(r, "revoke")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--red)] hover:bg-[var(--red-dim)]">
                    <Ban className="h-3.5 w-3.5" /> Revoke
                  </button>
                ) : (
                  <button type="button" disabled={busy === r.id} onClick={() => act(r, "reinstate")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-dim)]">
                    <RotateCcw className="h-3.5 w-3.5" /> Reinstate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TraceMatch = {
  licenseId: string;
  certificateSlug: string;
  template: string;
  orgName: string | null;
  buyer: string;
  wallet: string | null;
  confidence: "conclusive" | "strong" | "weak";
  signatureHits?: number;
  canaryHits?: number;
  canaryTotal?: number;
};

export function TraceTool({ datasetId, textFiles }: { datasetId: string; textFiles: { id: string; path: string }[] }) {
  const [mode, setMode] = useState<"content" | "hash">("content");
  const [suspect, setSuspect] = useState("");
  const [sha, setSha] = useState("");
  const [fileId, setFileId] = useState(textFiles[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ method: string; matches: TraceMatch[] } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const body = mode === "hash" ? { sha256: sha.trim().toLowerCase() } : fileId ? { fileId, suspect } : { suspect };
      setResult(await call(`/api/datasets/${datasetId}/trace`, "POST", body));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trace failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(f: File) {
    if (f.size > 20_000_000) return toast.error("Paste or drop up to 20 MB");
    setSuspect(await f.text());
  }

  return (
    <div>
      <GlassSegmented
        size="sm"
        ariaLabel="Trace method"
        value={mode}
        onChange={setMode}
        className="w-[300px]"
        options={[
          { value: "content", label: "Suspected content" },
          { value: "hash", label: "File SHA-256" },
        ]}
      />
      <div className="mt-5 space-y-3">
        {mode === "content" ? (
          <>
            {textFiles.length > 0 && (
              <div>
                <label className="field-label" htmlFor="trace-file">Which file did it come from?</label>
                <select id="trace-file" className="field" value={fileId} onChange={(e) => setFileId(e.target.value)}>
                  {textFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.path}
                    </option>
                  ))}
                  <option value="">Not sure? Check invisible signatures only</option>
                </select>
              </div>
            )}
            <textarea
              className="field mono text-[12px]"
              style={{ minHeight: 160 }}
              value={suspect}
              onChange={(e) => setSuspect(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void loadFile(f);
              }}
              placeholder="Paste rows you found online, or drop the leaked file here"
            />
          </>
        ) : (
          <input className="field mono text-[13px]" value={sha} onChange={(e) => setSha(e.target.value)} placeholder="SHA-256 of the leaked file" />
        )}
        <button type="button" onClick={run} disabled={busy || (mode === "content" ? !suspect.trim() : !/^[0-9a-f]{64}$/i.test(sha.trim()))} className="btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Trace
        </button>
      </div>
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            {result.matches.length === 0 ? (
              <div className="flex items-center gap-3 rounded-[20px] bg-[var(--bg-surface)] p-4 text-[14px]">
                <Fingerprint className="h-5 w-5 text-[var(--text-muted)]" />
                No licence marks found. The content may be from samples, heavily altered, or not from this dataset.
              </div>
            ) : (
              <ul className="space-y-2">
                {result.matches.map((m) => (
                  <li key={m.licenseId} className={cn("flex items-start gap-3 rounded-[20px] p-4", m.confidence === "weak" ? "bg-[var(--orange-dim)]" : "bg-[var(--red-dim)]")}>
                    <ShieldAlert className={cn("mt-0.5 h-5 w-5 shrink-0", m.confidence === "weak" ? "text-[var(--orange)]" : "text-[var(--red)]")} />
                    <div className="flex-1 text-[14px]">
                      <p className="font-semibold">
                        {m.orgName || m.buyer} · <span className="capitalize">{m.confidence}</span> match
                      </p>
                      <p className="text-[13px] text-[var(--text-secondary)]">
                        {m.template.toLowerCase()} licence
                        {m.signatureHits ? ` · ${m.signatureHits} invisible signature${m.signatureHits === 1 ? "" : "s"}` : ""}
                        {m.canaryTotal ? ` · ${m.canaryHits}/${m.canaryTotal} canaries` : ""}
                      </p>
                    </div>
                    <Link href={`/license/${m.certificateSlug}`} className="btn-secondary btn-sm">
                      Licence
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
