"use client";

import React, { useState, useCallback } from "react";
import { useUploadBlobs } from "@shelby-protocol/react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { encodeBlobRef } from "@/lib/shelby-public";
import { PLATFORM_ADDRESS } from "@/lib/constants";

const BURNLINK_STORAGE_FEE_APT =
  Number(process.env.NEXT_PUBLIC_BURNLINK_STORAGE_FEE_APT) || 0.5;

export type ShelbyTxData = {
  shelbyTxHash?: string | null;
  aptosTxHash?: string | null;
  expirationMicros?: number;
};

export type ShelbyUploadResult = {
  blobRefs: string[];
  shelbyTxHash?: string;
  aptosTxHash?: string;
  storageTxHash?: string;
  expirationAt: Date;
};

interface ShelbyUploaderProps {
  mode?: "post" | "burnlink" | "media";
  onSuccess?: (blobRefs: string[], txData: ShelbyTxData) => void;
  maxFiles?: number;
  acceptedTypes?: string;
  storageFeeApt?: number;
  expirationHours?: number;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function uploadViaServer(
  file: File,
  hours: number,
  aptosTxHash?: string
): Promise<{ blobRef: string; shelbyTxHash?: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", "burnlinks");
  form.append("expirationHours", String(hours));
  if (aptosTxHash) form.append("aptosTxHash", aptosTxHash);
  const res = await fetch("/api/media/upload", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Server upload failed");
  return { blobRef: data.blobRef, shelbyTxHash: data.shelbyTxHash };
}

export default function ShelbyUploader({
  mode = "burnlink",
  onSuccess,
  maxFiles = 5,
  acceptedTypes = "image/*,video/*,audio/*,.pdf,.zip",
  storageFeeApt = BURNLINK_STORAGE_FEE_APT,
  expirationHours = 168,
}: ShelbyUploaderProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const { transfer } = useAptTransfer();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hours, setHours] = useState(expirationHours);

  const uploadBlobs = useUploadBlobs({
    onError: (err) => toast.error(err.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files).slice(0, maxFiles));
  };

  const payStorageFee = useCallback(async (): Promise<string | undefined> => {
    if (mode !== "burnlink" || !PLATFORM_ADDRESS) return undefined;
    try {
      const hash = await transfer(PLATFORM_ADDRESS, storageFeeApt);
      toast.info(`Paid ${storageFeeApt} APT storage fee`);
      return hash;
    } catch {
      toast.error("Storage fee payment failed");
      return undefined;
    }
  }, [mode, storageFeeApt, transfer]);

  const handleUpload = async () => {
    if (!files.length || !account || !connected) {
      toast.error("Please select files and connect wallet");
      return;
    }

    if (!signAndSubmitTransaction) {
      toast.error("Wallet cannot sign transactions");
      return;
    }

    setIsUploading(true);

    try {
      let aptosTxHash: string | undefined;
      if (mode === "burnlink") {
        aptosTxHash = await payStorageFee();
        if (mode === "burnlink" && PLATFORM_ADDRESS && !aptosTxHash) {
          return;
        }
      }

      const ownerAddress = account.address.toString();
      const expirationMicros = Date.now() * 1000 + hours * 3600 * 1_000_000;

      const blobs = await Promise.all(
        files.map(async (file) => {
          const buffer = await file.arrayBuffer();
          return {
            blobName: `forge/${mode === "burnlink" ? "burnlinks" : "media"}/${Date.now()}-${sanitizeName(file.name)}`,
            blobData: new Uint8Array(buffer),
          };
        })
      );

      let shelbyTxHash: string | undefined;
      const blobRefs: string[] = [];

      try {
        let registrationHash: string | undefined;
        const signingSigner = {
          account,
          signAndSubmitTransaction: async (
            ...args: Parameters<typeof signAndSubmitTransaction>
          ) => {
            const res = await signAndSubmitTransaction(...args);
            const hash =
              typeof res === "object" && res && "hash" in res
                ? String((res as { hash: string }).hash)
                : undefined;
            if (hash) registrationHash = hash;
            return res;
          },
        };

        await uploadBlobs.mutateAsync({
          signer: signingSigner,
          blobs,
          expirationMicros,
          maxConcurrentUploads: 1,
        });

        shelbyTxHash = registrationHash;
        for (const b of blobs) {
          blobRefs.push(encodeBlobRef(ownerAddress, b.blobName));
        }
      } catch (clientErr) {
        console.warn("Client Shelby upload failed, trying server:", clientErr);
        for (const file of files) {
          const server = await uploadViaServer(file, hours, aptosTxHash);
          blobRefs.push(server.blobRef);
          shelbyTxHash = server.shelbyTxHash || shelbyTxHash;
        }
      }

      const txData: ShelbyTxData = {
        shelbyTxHash: shelbyTxHash ?? null,
        aptosTxHash: aptosTxHash ?? null,
        expirationMicros,
      };

      toast.success(`${files.length} file(s) uploaded to Shelby`);
      onSuccess?.(blobRefs, txData);
      setFiles([]);
    } catch (error: unknown) {
      console.error("Shelby upload error:", error);
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const inputId = `shelby-upload-${mode}`;

  return (
    <div className="rounded-3xl border-2 border-dashed border-[var(--border-default)] p-8 text-center transition-colors hover:border-[var(--brand)]">
      <input
        type="file"
        multiple={maxFiles > 1}
        accept={acceptedTypes}
        onChange={handleFileSelect}
        className="hidden"
        id={inputId}
      />

      <label htmlFor={inputId} className="block cursor-pointer">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-2xl">
          📤
        </div>
        <p className="text-lg font-medium">Drop files or click to upload</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {mode === "burnlink"
            ? `Pay ${storageFeeApt} APT storage fee · Stored on Shelby`
            : "Stored on Shelby"}
        </p>
      </label>

      {mode === "burnlink" && (
        <label className="mt-4 block text-left text-sm">
          Link expires in
          <select
            className="input mt-1 w-full"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={24}>24 hours</option>
            <option value={72}>3 days</option>
            <option value={168}>7 days</option>
            <option value={720}>30 days</option>
            <option value={2160}>90 days</option>
          </select>
        </label>
      )}

      {files.length > 0 && (
        <div className="mt-6">
          <ul className="mb-6 max-h-40 space-y-2 overflow-auto text-left text-sm">
            {files.map((file, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-2xl bg-[var(--bg-subtle)] px-4 py-2"
              >
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || !connected}
            className="w-full rounded-2xl bg-[var(--text-primary)] py-4 text-lg font-semibold text-[var(--text-inverse)] transition hover:opacity-90 disabled:opacity-50"
          >
            {isUploading
              ? "Uploading to Shelby…"
              : mode === "burnlink"
                ? `Pay ${storageFeeApt} APT & Upload`
                : "Upload to Shelby"}
          </button>
        </div>
      )}
    </div>
  );
}
