"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Cloud,
  Folder,
  File as FileIcon,
  CheckSquare,
  Square,
  Loader2,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import type { ShelbyTxData } from "@/components/upload/shelby-uploader";
import { useShelbyWalletUpload } from "@/hooks/use-shelby-wallet-upload";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";

type CloudFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  isFolder: boolean;
};

type FileMeta = { name: string; size: number; mime: string };

type Props = {
  onImportSuccess: (
    blobRefs: string[],
    txData: ShelbyTxData,
    metas?: FileMeta[]
  ) => void;
};

export function CloudImport({ onImportSuccess }: Props) {
  const { uploadFile, isWalletReady } = useShelbyWalletUpload();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<{
    google: boolean;
    googleConfigured: boolean;
    googleRedirectUri?: string | null;
  } | null>(null);

  const [connected, setConnected] = useState(false);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [asBundle, setAsBundle] = useState(false);

  useEffect(() => {
    fetch("/api/import/status")
      .then((r) => r.json())
      .then((d) => {
        setStatus({
          google: d.google,
          googleConfigured: d.googleConfigured,
          googleRedirectUri: d.googleRedirectUri,
        });
        setConnected(d.google);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const importConnected = searchParams.get("import_connected");
    const err = searchParams.get("import_error");
    if (importConnected === "google") {
      toast.success("Google Drive connected!");
      setConnected(true);
    }
    if (err) {
      const decoded = decodeURIComponent(err);
      if (decoded.includes("redirect_uri_mismatch") || decoded === "redirect_uri_mismatch") {
        toast.error(
          "Google redirect URI mismatch. Add this exact URI in Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs.",
          { duration: 10000 }
        );
      } else {
        toast.error(`Import error: ${decoded}`);
      }
    }
  }, [searchParams]);

  const loadFiles = useCallback(async (folderId?: string) => {
    setLoadingFiles(true);
    try {
      const params = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
      const res = await fetch(`/api/import/google/files${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(data.files || []);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    const folderId = folderStack.length ? folderStack[folderStack.length - 1].id : undefined;
    loadFiles(folderId);
  }, [connected, folderStack, loadFiles]);

  const connect = () => {
    if (!status?.googleConfigured) {
      toast.error(
        "Google OAuth not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL in .env"
      );
      return;
    }
    window.location.href = "/api/import/google/auth";
  };

  const openFolder = (file: CloudFile) => {
    setFolderStack((s) => [...s, { id: file.id, name: file.name }]);
  };

  const goUp = () => {
    setFolderStack((s) => s.slice(0, -1));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelected = async () => {
    if (selected.size === 0) return;

    if (!isWalletReady) {
      toast.error("Connect your wallet to register files on Shelby");
      return;
    }

    const toImport = files.filter((f) => !f.isFolder && selected.has(f.id));
    if (toImport.length === 0) {
      toast.error("Select at least one file (not folders)");
      return;
    }

    setImporting(true);
    setImportProgress({ done: 0, total: toImport.length });

    const blobRefs: string[] = [];
    const metas: FileMeta[] = [];
    let lastShelbyTxHash: string | null = null;

    try {
      for (let i = 0; i < toImport.length; i++) {
        const driveFile = toImport[i];
        const params = new URLSearchParams({
          fileId: driveFile.id,
          mimeType: driveFile.mimeType,
        });
        const res = await fetch(`/api/import/google/download?${params}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || `Failed to download ${driveFile.name}`
          );
        }

        const blob = await res.blob();
        const fileName =
          decodeURIComponent(res.headers.get("X-File-Name") || "") || driveFile.name;
        const localFile = new File([blob], fileName, {
          type: blob.type || driveFile.mimeType,
        });

        const upload = await uploadFile(localFile, "imports");
        blobRefs.push(upload.blobRef);
        if (upload.shelbyTxHash) lastShelbyTxHash = upload.shelbyTxHash;
        metas.push({
          name: fileName,
          size: upload.size || driveFile.size || 0,
          mime: upload.mimeType || driveFile.mimeType,
        });
        setImportProgress({ done: i + 1, total: toImport.length });
      }

      toast.success(`Imported ${blobRefs.length} file(s) to Shelby`);
      onImportSuccess(blobRefs, { shelbyTxHash: lastShelbyTxHash }, metas);

      if (asBundle && blobRefs.length > 1) {
        toast.info("Files imported — enable “Create as bundle” in the form below.");
      }
    } catch (e) {
      const msg = e instanceof Error ? formatShelbyUploadError(e.message) : "Import failed";
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  if (!status) {
    return (
      <div className="card-terminal flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-terminal p-6">
        <div className="flex items-center gap-3">
          <Cloud className="h-6 w-6 text-[var(--brand)]" />
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[var(--text-cream)]">
              Import from Google Drive
            </h3>
            <p className="text-sm text-[var(--text-cream)]/60">
              Connect Google Drive and your wallet. Your wallet pays Shelby registration fees.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => (connected ? loadFiles(folderStack.at(-1)?.id) : connect())}
            className="btn-pill-dark inline-flex items-center gap-2"
          >
            <HardDrive className="h-4 w-4" />
            {connected ? "Refresh Google Drive" : "Connect Google Drive"}
          </button>
          {status.googleConfigured && status.googleRedirectUri && (
            <p className="text-xs text-[var(--text-cream)]/50">
              Google Console redirect URI must be:{" "}
              <span className="break-all font-mono text-[var(--text-cream)]/70">
                {status.googleRedirectUri}
              </span>
            </p>
          )}
        </div>
      </div>

      {connected && (
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              {folderStack.length > 0 && (
                <button type="button" onClick={goUp} className="btn-accent-ghost text-xs">
                  ← Back
                </button>
              )}
              <span className="font-medium">Google Drive</span>
              {folderStack.map((f) => (
                <span key={f.id} className="text-[var(--text-muted)]">
                  / {f.name}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setConnected(false);
                setFiles([]);
                setSelected(new Set());
                setFolderStack([]);
              }}
              className="text-xs text-[var(--text-muted)] underline"
            >
              Disconnect
            </button>
          </div>

          {loadingFiles ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
            </div>
          ) : (
            <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
              {files.map((file) => (
                <li key={file.id}>
                  {file.isFolder ? (
                    <button
                      type="button"
                      onClick={() => openFolder(file)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--bg-hover)]"
                    >
                      <Folder className="h-4 w-4 text-[var(--brand)]" />
                      <span className="font-medium">{file.name}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSelect(file.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                        selected.has(file.id) ? "bg-[var(--accent-dim)]" : "hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      {selected.has(file.id) ? (
                        <CheckSquare className="h-4 w-4 text-[var(--brand)]" />
                      ) : (
                        <Square className="h-4 w-4 text-[var(--text-muted)]" />
                      )}
                      <FileIcon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      {file.size && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      )}
                    </button>
                  )}
                </li>
              ))}
              {files.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">No files in this folder.</p>
              )}
            </ul>
          )}

          {selected.size > 0 && (
            <div className="mt-4 space-y-3 border-t border-[var(--border-dim)] pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={asBundle}
                  onChange={(e) => setAsBundle(e.target.checked)}
                  disabled={selected.size < 2}
                />
                Group as Bundle after import ({selected.size} files selected)
              </label>

              {importing && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--border-dim)]">
                    <div
                      className="h-full bg-[var(--brand)] transition-all"
                      style={{
                        width: `${(importProgress.done / importProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Importing {importProgress.done}/{importProgress.total} to Shelby…
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={importSelected}
                disabled={importing}
                className="btn-brand w-full"
              >
                {importing
                  ? `Importing… (${importProgress.done}/${importProgress.total})`
                  : `Import ${selected.size} file(s) to Shelby`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}