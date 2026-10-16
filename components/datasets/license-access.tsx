"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Download, Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassSegmented } from "@/components/glass/glass-segmented";
import { formatBytes } from "@/lib/datasets/modalities";
import { cn } from "@/lib/utils";

type AccessFile = { id: string; path: string; sizeBytes: number; fingerprinted: boolean; downloadUrl: string };
type AccessVersion = { id: string; versionNumber: number; sealHash: string | null; files: AccessFile[] };
type Access = { dailyLimitPerFile: number | null; versions: AccessVersion[] };

function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="mono max-h-56 overflow-auto rounded-[18px] bg-[var(--bg-terminal)] p-4 pr-12 text-[12px] leading-relaxed text-[#e5e5ea]">{text}</pre>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function LicenseAccess({ datasetId, defaultOpen = false }: { datasetId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cred, setCred] = useState<{ token: string; expiresAt: string; manifestUrl: string } | null>(null);
  const [credBusy, setCredBusy] = useState(false);
  const [lang, setLang] = useState<"python" | "curl">("python");

  useEffect(() => {
    if (!open || access) return;
    fetch(`/api/datasets/${datasetId}/access`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load files");
        setAccess(data);
        setVersionId(data.versions[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [open, access, datasetId]);

  const version = access?.versions.find((v) => v.id === versionId) ?? null;

  async function download(f: AccessFile) {
    setDownloading(f.id);
    try {
      const res = await fetch(f.downloadUrl);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.path.split("/").pop() || "file";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  async function mint() {
    if (!versionId) return;
    setCredBusy(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create credential");
      setCred(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCredBusy(false);
    }
  }

  const python = cred
    ? `import os, requests

TOKEN = "${cred.token}"
H = {"Authorization": f"Bearer {TOKEN}"}
m = requests.get("${cred.manifestUrl}", headers=H).json()

for f in m["files"]:
    path = os.path.join("data", f["path"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with requests.get(f["url"], headers=H, stream=True) as r:
        r.raise_for_status()
        with open(path, "wb") as out:
            for chunk in r.iter_content(1 << 20):
                out.write(chunk)`
    : "";
  const curl = cred
    ? `export FORGE_TOKEN="${cred.token}"
curl -s -H "Authorization: Bearer $FORGE_TOKEN" ${cred.manifestUrl} \\
  | jq -r '.files[] | "\\(.url) \\(.path)"' \\
  | while read url path; do
      mkdir -p "data/$(dirname "$path")"
      curl -s -H "Authorization: Bearer $FORGE_TOKEN" "$url" -o "data/$path"
    done`
    : "";

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-secondary btn-sm" aria-expanded={open}>
        <Download className="h-3.5 w-3.5" /> Files & pipeline
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="pt-5">
              {error ? (
                <p className="text-[14px] text-[var(--red)]">{error}</p>
              ) : !access ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton-shimmer h-12 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {access.versions.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {access.versions.map((v) => (
                        <button key={v.id} type="button" className="chip" aria-pressed={v.id === versionId} onClick={() => (setVersionId(v.id), setCred(null))}>
                          v{v.versionNumber}
                        </button>
                      ))}
                    </div>
                  )}
                  {version && (
                    <ul className="divide-y divide-[var(--border-dim)] overflow-hidden rounded-[20px] border border-[var(--border-dim)]">
                      {version.files.map((f) => (
                        <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium">{f.path}</p>
                            <p className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                              {formatBytes(f.sizeBytes)}
                              {f.fingerprinted && (
                                <span className="inline-flex items-center gap-1 text-[var(--purple)]">
                                  <Fingerprint className="h-3 w-3" /> fingerprinted
                                </span>
                              )}
                            </p>
                          </div>
                          <button type="button" onClick={() => download(f)} disabled={downloading === f.id} className="btn-secondary btn-sm">
                            {downloading === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Download
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {access.dailyLimitPerFile && <p className="caption">Up to {access.dailyLimitPerFile} deliveries per file per day. Every delivery is logged against your licence.</p>}

                  <div className="rounded-[22px] bg-[var(--bg-surface)] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-[15px] font-semibold">
                          <KeyRound className="h-4 w-4 text-[var(--accent-ink)]" /> Pipeline access
                        </p>
                        <p className="text-[13px] text-[var(--text-secondary)]">A one-hour bearer token scoped to this licence and version.</p>
                      </div>
                      <button type="button" onClick={mint} disabled={credBusy} className="btn-primary btn-sm">
                        {credBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {cred ? "New token" : "Create token"}
                      </button>
                    </div>
                    {cred && (
                      <div className="mt-5 space-y-3">
                        <GlassSegmented
                          size="sm"
                          ariaLabel="Snippet language"
                          value={lang}
                          onChange={setLang}
                          className="w-[200px]"
                          options={[
                            { value: "python", label: "Python" },
                            { value: "curl", label: "cURL" },
                          ]}
                        />
                        <CopyBlock text={lang === "python" ? python : curl} label="snippet" />
                        <p className="caption">Expires {new Date(cred.expiresAt).toLocaleTimeString()}. Treat it like a password.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
