"use client";

import React, { useState, useCallback } from "react";
import { useUploadBlobs } from "@shelby-protocol/react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import {
  DEFAULT_APTOS_GAS_UNIT_PRICE,
  useAptTransfer,
} from "@/lib/use-apt-transfer";
import { encodeBlobRef } from "@/lib/shelby-public";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";
import { PLATFORM_ADDRESS } from "@/lib/constants";
import { useContentEncryption } from "@/hooks/use-content-encryption";
import type { EncryptionMaterial } from "@/lib/encryption";
import { EncryptedBadge } from "@/components/ui/encrypted-badge";
import { Lock, Loader2 } from "lucide-react";

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

export type FileUploadMeta = {
  name: string;
  size: number;
  mime: string;
};

interface ShelbyUploaderProps {
  mode?: "post" | "burnlink" | "media";
  onSuccess?: (
    blobRefs: string[],
    txData: ShelbyTxData,
    fileMetas?: FileUploadMeta[],
    encryptionMaterials?: Array<EncryptionMaterial | null>
  ) => void;
  maxFiles?: number;
  acceptedTypes?: string;
  storageFeeApt?: number;
  expirationHours?: number;
  /**
   * Encrypt with AES-256-GCM before upload (default: true for burnlink, false for media).
   * When true, only ciphertext is sent to Shelby.
   */
  encrypt?: boolean;
  /** Allow user to toggle encryption (shows checkbox). */
  showEncryptToggle?: boolean;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export default function ShelbyUploader({
  mode = "burnlink",
  onSuccess,
  maxFiles = 5,
  acceptedTypes = "image/*,video/*,audio/*,.pdf,.zip",
  storageFeeApt = BURNLINK_STORAGE_FEE_APT,
  expirationHours = 168,
  encrypt: encryptProp,
  showEncryptToggle = mode === "media",
}: ShelbyUploaderProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const { transfer } = useAptTransfer();
  const {
    encryptMany,
    isBusy: isEncrypting,
    canEncrypt,
  } = useContentEncryption();

  const defaultEncrypt = encryptProp ?? mode === "burnlink";
  const [encryptEnabled, setEncryptEnabled] = useState(defaultEncrypt);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hours, setHours] = useState(expirationHours);
  const [phase, setPhase] = useState<
    "idle" | "fee" | "encrypting" | "uploading"
  >("idle");

  const uploadBlobs = useUploadBlobs({
    onError: (err) => toast.error(formatShelbyUploadError(err.message)),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files).slice(0, maxFiles));
  };

  const payStorageFee = useCallback(async (): Promise<string | undefined> => {
    if (mode !== "burnlink" || !PLATFORM_ADDRESS) return undefined;
    try {
      const hash = await transfer(PLATFORM_ADDRESS, storageFeeApt, {
        gasUnitPrice: DEFAULT_APTOS_GAS_UNIT_PRICE,
        maxGasAmount: 300_000,
      });
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

    const doEncrypt = encryptEnabled;
    if (doEncrypt && !canEncrypt) {
      toast.error("Your wallet must support signMessage for client-side encryption");
      return;
    }

    setIsUploading(true);
    setPhase("fee");

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

      let filesToUpload = files;
      let encryptionMaterials: Array<EncryptionMaterial | null> = files.map(
        () => null
      );

      if (doEncrypt) {
        setPhase("encrypting");
        toast.message("Sign once to derive your encryption key…");
        const encrypted = await encryptMany(files);
        filesToUpload = encrypted.map((e) => e.encryptedFile);
        encryptionMaterials = encrypted.map((e) => e.material);
      }

      setPhase("uploading");

      const blobs = await Promise.all(
        filesToUpload.map(async (file, i) => {
          const buffer = await file.arrayBuffer();
          const baseName = sanitizeName(files[i]?.name || file.name);
          return {
            blobName: `forge/${mode === "burnlink" ? "burnlinks" : "media"}/${Date.now()}-${baseName}${doEncrypt ? ".enc" : ""}`,
            blobData: new Uint8Array(buffer),
          };
        })
      );

      let shelbyTxHash: string | undefined;
      const blobRefs: string[] = [];

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

      const txData: ShelbyTxData = {
        shelbyTxHash: shelbyTxHash ?? null,
        aptosTxHash: aptosTxHash ?? null,
        expirationMicros,
      };

      const metas: FileUploadMeta[] = files.map((f, i) => {
        const mat = encryptionMaterials[i];
        return {
          name: f.name,
          size: mat?.plaintextSize ?? f.size,
          mime: mat?.mimeType ?? (f.type || "application/octet-stream"),
        };
      });

      toast.success(
        doEncrypt
          ? `${files.length} file(s) encrypted & uploaded to Shelby`
          : `${files.length} file(s) uploaded to Shelby`
      );
      onSuccess?.(blobRefs, txData, metas, encryptionMaterials);
      setFiles([]);
    } catch (error: unknown) {
      console.error("Shelby upload error:", error);
      const message =
        error instanceof Error ? formatShelbyUploadError(error.message) : "Upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
      setPhase("idle");
    }
  };

  const inputId = `shelby-upload-${mode}`;
  const busy = isUploading || isEncrypting;

  const statusLabel = (() => {
    if (phase === "fee") return "Paying storage fee…";
    if (phase === "encrypting") return "Encrypting (AES-256-GCM)…";
    if (phase === "uploading") return "Uploading to Shelby (approve register, then commit)…";
    if (mode === "burnlink") return `Pay ${storageFeeApt} APT & Upload`;
    return encryptEnabled ? "Encrypt & upload to Shelby" : "Upload to Shelby";
  })();

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
        {encryptEnabled && (
          <div className="mt-3 flex justify-center">
            <EncryptedBadge label="Client-side AES-256-GCM" />
          </div>
        )}
      </label>

      {(showEncryptToggle || encryptEnabled) && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border-dim)] bg-[var(--bg-subtle)] p-3 text-left text-sm">
          <input
            type="checkbox"
            className="mt-1 rounded"
            checked={encryptEnabled}
            disabled={!showEncryptToggle && encryptProp === true}
            onChange={(e) => setEncryptEnabled(e.target.checked)}
          />
          <span>
            <span className="flex items-center gap-1.5 font-medium">
              <Lock className="h-3.5 w-3.5" />
              Encrypt before upload
            </span>
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              Generates a per-file key, encrypts in your browser, wraps the key with
              your wallet signature. Only ciphertext is stored on Shelby.
            </span>
          </span>
        </label>
      )}

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
                  {encryptEnabled ? " · will encrypt" : ""}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleUpload}
            disabled={busy || !connected}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] py-4 text-lg font-semibold text-[var(--text-inverse)] transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            {statusLabel}
          </button>
        </div>
      )}
    </div>
  );
}
