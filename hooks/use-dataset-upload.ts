"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useUploadBlobs } from "@shelby-protocol/react";
import { useContentEncryption } from "@/hooks/use-content-encryption";
import { bytesToBase64, generateContentKey, wrapKey } from "@/lib/encryption";
import { encryptBlobChunked } from "@/lib/datasets/chunked-crypto";
import { sha256File } from "@/lib/datasets/hash";
import { normalizeManifestPath } from "@/lib/datasets/manifest";
import { encodeBlobRef } from "@/lib/shelby-public";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";
import { getShelbyBrowserClient } from "@/lib/shelby-browser";
import { getSponsorStatus, uploadSponsored } from "@/lib/storage/sponsored-upload";

export type UploadItem = {
  key: string;
  file: File;
  path: string;
  isSample: boolean;
  status: "queued" | "hashing" | "encrypting" | "uploading" | "registering" | "done" | "error";
  progress: number;
  error?: string;
};

/** Keep each Shelby batch (one wallet signature) within a sane memory budget. */
const BATCH_BYTES = 192 * 1024 * 1024;
const BATCH_FILES = 12;

function safeBlobSegment(path: string) {
  return normalizeManifestPath(path)
    .split("/")
    .map((s) => s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80))
    .join("/")
    .slice(0, 400);
}

export function useDatasetUpload() {
  const { account, connected, signAndSubmitTransaction, signTransaction } = useWallet();
  const [sponsored, setSponsored] = useState<boolean | null>(null);
  const { ensureOwnerKey } = useContentEncryption();
  const uploadBlobs = useUploadBlobs({});
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);

  const update = (key: string, patch: Partial<UploadItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const add = useCallback((files: File[], asSample = false) => {
    setItems((list) => {
      const taken = new Set(list.map((i) => `${i.isSample}:${i.path}`));
      const next = [...list];
      for (const f of files) {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        let path = normalizeManifestPath(rel);
        let n = 1;
        while (taken.has(`${asSample}:${path}`)) path = normalizeManifestPath(rel).replace(/(\.[^./]+)?$/, `-${n++}$1`);
        taken.add(`${asSample}:${path}`);
        next.push({ key: crypto.randomUUID(), file: f, path, isSample: asSample, status: "queued", progress: 0 });
      }
      return next;
    });
  }, []);

  const remove = useCallback((key: string) => setItems((l) => l.filter((i) => i.key !== key || i.status === "done")), []);
  const toggleSample = useCallback(
    (key: string) => setItems((l) => l.map((i) => (i.key === key && i.status === "queued" ? { ...i, isSample: !i.isSample } : i))),
    []
  );
  const rename = useCallback(
    (key: string, path: string) => setItems((l) => l.map((i) => (i.key === key && i.status === "queued" ? { ...i, path } : i))),
    []
  );
  const reset = useCallback(() => setItems([]), []);

  /**
   * Encrypt (data files) and upload every queued item, then register them on
   * the draft version. Returns the number of files registered.
   */
  const run = useCallback(
    async (opts: { datasetId: string; versionId: string; versionNumber: number }) => {
      if (!connected || !account || !signAndSubmitTransaction) throw new Error("Connect your wallet to upload");
      const queued = items.filter((i) => i.status === "queued" || i.status === "error");
      if (!queued.length) return 0;
      setRunning(true);
      let registered = 0;
      try {
        const ownerKey = queued.some((q) => !q.isSample) ? await ensureOwnerKey() : null;
        const owner = account.address.toString();
        // Forge pays Shelby storage when sponsorship is on and quota remains.
        const sponsor = await getSponsorStatus();
        let sponsorBudget = sponsor?.enabled ? sponsor.remainingBytes : 0;
        setSponsored(!!sponsor?.enabled);

        // Group into batches so one signature covers several files.
        const batches: UploadItem[][] = [];
        let current: UploadItem[] = [];
        let bytes = 0;
        for (const item of queued) {
          if (current.length && (bytes + item.file.size > BATCH_BYTES || current.length >= BATCH_FILES)) {
            batches.push(current);
            current = [];
            bytes = 0;
          }
          current.push(item);
          bytes += item.file.size;
        }
        if (current.length) batches.push(current);

        for (const batch of batches) {
          const prepared: {
            item: UploadItem;
            blobName: string;
            blobData: Uint8Array;
            sha256: string;
            encryption: null | { encryptionVersion: 2; wrappedKeyOwner: string; wrappedKeyShare: string; encryptionShareKey: string };
          }[] = [];

          for (const item of batch) {
            try {
              update(item.key, { status: "hashing", progress: 0, error: undefined });
              const sha256 = await sha256File(item.file, (p) => update(item.key, { progress: p * 0.4 }));
              const base = `forge/datasets/${opts.datasetId}/v${opts.versionNumber}/${item.isSample ? "samples/" : ""}${safeBlobSegment(item.path)}`;
              if (item.isSample) {
                prepared.push({ item, blobName: base, blobData: new Uint8Array(await item.file.arrayBuffer()), sha256, encryption: null });
              } else {
                update(item.key, { status: "encrypting" });
                const contentKey = generateContentKey();
                const shareKey = generateContentKey();
                const encrypted = await encryptBlobChunked(item.file, contentKey, {
                  onProgress: (p) => update(item.key, { progress: 0.4 + p * 0.4 }),
                });
                prepared.push({
                  item,
                  blobName: `${base}.fgc`,
                  blobData: new Uint8Array(await encrypted.arrayBuffer()),
                  sha256,
                  encryption: {
                    encryptionVersion: 2,
                    wrappedKeyOwner: await wrapKey(contentKey, ownerKey!),
                    wrappedKeyShare: await wrapKey(contentKey, shareKey),
                    encryptionShareKey: bytesToBase64(shareKey),
                  },
                });
                contentKey.fill(0);
              }
            } catch (e) {
              update(item.key, { status: "error", error: e instanceof Error ? e.message : "Could not prepare file" });
            }
          }
          if (!prepared.length) continue;

          prepared.forEach((p) => update(p.item.key, { status: "uploading", progress: 0.85 }));
          let txHash: string | undefined;
          const batchBytes = prepared.reduce((sum, p) => sum + p.blobData.length, 0);
          try {
            if (sponsorBudget >= batchBytes) {
              txHash = await uploadSponsored({
                client: getShelbyBrowserClient(),
                versionId: opts.versionId,
                owner,
                blobs: prepared.map((p) => ({ blobName: p.blobName, blobData: p.blobData })),
                signTransaction: signTransaction as unknown as Parameters<typeof uploadSponsored>[0]["signTransaction"],
                signAndSubmitTransaction: signAndSubmitTransaction as unknown as Parameters<typeof uploadSponsored>[0]["signAndSubmitTransaction"],
              });
              sponsorBudget -= batchBytes;
            } else await uploadBlobs.mutateAsync({
              signer: {
                account,
                signAndSubmitTransaction: async (...args: Parameters<typeof signAndSubmitTransaction>) => {
                  const res = await signAndSubmitTransaction(...args);
                  if (res && typeof res === "object" && "hash" in res) txHash = String((res as { hash: string }).hash);
                  return res;
                },
              },
              blobs: prepared.map((p) => ({ blobName: p.blobName, blobData: p.blobData })),
              maxConcurrentUploads: 2,
            });
          } catch (e) {
            const msg = formatShelbyUploadError(e instanceof Error ? e.message : "Upload failed");
            prepared.forEach((p) => update(p.item.key, { status: "error", error: msg }));
            throw new Error(msg);
          }

          prepared.forEach((p) => update(p.item.key, { status: "registering", progress: 0.95 }));
          const res = await fetch(`/api/datasets/versions/${opts.versionId}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: prepared.map((p) => ({
                path: p.item.path,
                sizeBytes: p.item.file.size,
                mimeType: p.item.file.type || "application/octet-stream",
                sha256: p.sha256,
                blobRef: encodeBlobRef(owner, p.blobName),
                storageTxHash: txHash,
                isSample: p.item.isSample,
                encryption: p.encryption,
              })),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            prepared.forEach((p) => update(p.item.key, { status: "error", error: data.error || "Registration failed" }));
            throw new Error(data.error || "Registration failed");
          }
          prepared.forEach((p) => update(p.item.key, { status: "done", progress: 1 }));
          registered += prepared.length;
        }
        return registered;
      } finally {
        setRunning(false);
      }
    },
    [items, connected, account, signAndSubmitTransaction, signTransaction, ensureOwnerKey, uploadBlobs]
  );

  return { items, add, remove, toggleSample, rename, reset, run, running, sponsored };
}
