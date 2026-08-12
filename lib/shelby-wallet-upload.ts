"use client";

import { encodeBlobRef, getShelbyPublicUrl } from "@/lib/shelby-public";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";
import type { EncryptionMaterial } from "@/lib/encryption";

export type ShelbyUploadKind =
  | "avatar"
  | "banner"
  | "thumbnail"
  | "upload"
  | "media"
  | "burnlinks"
  | "imports"
  | "post";

export type ShelbyUploadResult = {
  blobRef: string;
  url: string;
  shelbyTxHash?: string;
  mimeType: string;
  size: number;
  /** Original plaintext MIME when encrypted */
  plaintextMimeType?: string;
  plaintextSize?: number;
  encryption?: EncryptionMaterial | null;
};

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function defaultExpirationHours(kind: ShelbyUploadKind): number {
  if (kind === "avatar" || kind === "banner") return 365 * 24;
  return 168;
}

// Wallet + Shelby SDK signer shapes vary by adapter — keep loose for compatibility.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShelbyWalletSigner = any;

type UploadBlobsMutate = (params: {
  signer: ShelbyWalletSigner;
  blobs: { blobName: string; blobData: Uint8Array }[];
  expirationMicros: number;
  maxConcurrentUploads?: number;
}) => Promise<unknown>;

export type EncryptFileFn = (file: File) => Promise<{
  encryptedFile: File;
  material: EncryptionMaterial;
}>;

function createSigningSigner(
  account: ShelbyWalletSigner,
  signAndSubmitTransaction: ShelbyWalletSigner,
  onHash?: (hash: string) => void
) {
  return {
    account,
    signAndSubmitTransaction: async (...args: unknown[]) => {
      const res = await signAndSubmitTransaction(...args);
      const hash =
        typeof res === "object" && res && "hash" in res
          ? String((res as { hash: string }).hash)
          : typeof res === "string"
            ? res
            : undefined;
      if (hash) onHash?.(hash);
      return res;
    },
  };
}

export async function uploadFileToShelbyWithWallet(
  file: File,
  kind: ShelbyUploadKind,
  account: ShelbyWalletSigner,
  signAndSubmitTransaction: ShelbyWalletSigner,
  uploadBlobs: UploadBlobsMutate,
  options?: {
    expirationHours?: number;
    /** When set, file is encrypted client-side before Shelby upload */
    encryptFile?: EncryptFileFn;
  }
): Promise<ShelbyUploadResult> {
  const [result] = await uploadFilesToShelbyWithWallet(
    [file],
    kind,
    account,
    signAndSubmitTransaction,
    uploadBlobs,
    options
  );
  return result;
}

export async function uploadFilesToShelbyWithWallet(
  files: File[],
  kind: ShelbyUploadKind,
  account: ShelbyWalletSigner,
  signAndSubmitTransaction: ShelbyWalletSigner,
  uploadBlobs: UploadBlobsMutate,
  options?: {
    expirationHours?: number;
    encryptFile?: EncryptFileFn;
  }
): Promise<ShelbyUploadResult[]> {
  if (!files.length) return [];

  const hours = options?.expirationHours ?? defaultExpirationHours(kind);
  const expirationMicros = Date.now() * 1000 + hours * 3600 * 1_000_000;
  const ownerAddress = account.address.toString();
  const timestamp = Date.now();

  const prepared = await Promise.all(
    files.map(async (file, i) => {
      let uploadFile = file;
      let encryption: EncryptionMaterial | null = null;
      let plaintextMime = file.type || "application/octet-stream";
      let plaintextSize = file.size;

      if (options?.encryptFile) {
        const enc = await options.encryptFile(file);
        uploadFile = enc.encryptedFile;
        encryption = enc.material;
        plaintextMime = enc.material.mimeType;
        plaintextSize = enc.material.plaintextSize;
      }

      const buffer = await uploadFile.arrayBuffer();
      const displayName = encryption
        ? sanitizeName(file.name)
        : sanitizeName(file.name);

      return {
        originalFile: file,
        uploadFile,
        encryption,
        plaintextMime,
        plaintextSize,
        blobName: `forge/${kind}/${timestamp}-${i}-${displayName}${encryption ? ".enc" : ""}`,
        blobData: new Uint8Array(buffer),
      };
    })
  );

  let shelbyTxHash: string | undefined;
  const signingSigner = createSigningSigner(account, signAndSubmitTransaction, (hash) => {
    shelbyTxHash = hash;
  });

  try {
    await uploadBlobs({
      signer: signingSigner,
      blobs: prepared.map((b) => ({ blobName: b.blobName, blobData: b.blobData })),
      expirationMicros,
      maxConcurrentUploads: 1,
    });
  } catch (e) {
    throw new Error(formatShelbyUploadError(e instanceof Error ? e.message : "Wallet upload failed"));
  }

  return prepared.map((b) => ({
    blobRef: encodeBlobRef(ownerAddress, b.blobName),
    url: getShelbyPublicUrl(encodeBlobRef(ownerAddress, b.blobName)),
    shelbyTxHash,
    // Stored MIME should be the original when encrypted (ciphertext is octet-stream)
    mimeType: b.encryption ? b.plaintextMime : b.originalFile.type || "application/octet-stream",
    size: b.encryption ? b.plaintextSize : b.originalFile.size,
    plaintextMimeType: b.encryption ? b.plaintextMime : undefined,
    plaintextSize: b.encryption ? b.plaintextSize : undefined,
    encryption: b.encryption,
  }));
}

/** @deprecated Use uploadFileToShelbyWithWallet */
export const uploadImageToShelbyWithWallet = uploadFileToShelbyWithWallet;

/** @deprecated Use ShelbyUploadKind */
export type ShelbyImageKind = ShelbyUploadKind;
