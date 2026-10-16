import "server-only";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import {
  encodeBlobRef,
  fileNameFromBlobRef,
  parseBlobRef,
  type ShelbyUploadResult,
} from "./shelby-public";
import { getShelbyClient, getShelbySigner } from "./shelby-client";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function uploadToShelby(
  file: File | Blob,
  fileName?: string,
  metadata?: Record<string, unknown>
): Promise<ShelbyUploadResult & { shelbyTxHash?: string }> {
  const signer = getShelbySigner();
  if (!signer) {
    throw new Error(
      "Shelby storage is not configured. Set SHELBY_SIGNER_PRIVATE_KEY in your environment."
    );
  }

  const client = getShelbyClient();
  const blob = file instanceof File ? file : new File([file], fileName || "upload");
  const mimeType = blob.type || "application/octet-stream";
  const buffer = Buffer.from(await blob.arrayBuffer());
  const size = buffer.length;

  const folder = metadata?.type ? String(metadata.type) : "uploads";
  const blobName = `forge/${folder}/${Date.now()}-${sanitizeName(fileName || blob.name || "file")}`;
  const expirationMicros =
    typeof metadata?.expirationMicros === "number"
      ? metadata.expirationMicros
      : Date.now() * 1000 + 30 * 24 * 60 * 60 * 1_000_000;

  try {
    // SDK 0.7+: register → putBlobChunksets → commit_object (overwrite).
    // Does not query the old GraphQL `blob_name` columns.
    await client.upload({
      blobData: new Uint8Array(buffer),
      signer,
      blobName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/insufficient.*balance/i.test(msg)) {
      throw new Error(
        "Server Shelby signer has insufficient APT for storage fees. Connect your wallet to upload from the browser, or fund SHELBY_SIGNER_PRIVATE_KEY on ShelbyNet."
      );
    }
    throw err;
  }

  const account = signer.accountAddress.toString();
  const cid = encodeBlobRef(account, blobName);

  return { cid, mimeType, size, account, blobName };
}

export async function downloadFromShelby(ref: string): Promise<{
  data: Buffer;
  mimeType: string;
  fileName: string;
}> {
  const parsed = parseBlobRef(ref);
  if (!parsed) {
    throw new Error("Invalid Shelby blob reference");
  }

  const client = getShelbyClient();
  const blob = await client.download({
    account: AccountAddress.from(parsed.account),
    blobName: parsed.blobName,
  });

  const reader = blob.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const data = Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
  const fileName = fileNameFromBlobRef(ref) || parsed.blobName.split("/").pop() || "download";
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    pdf: "application/pdf",
    html: "text/html",
  };

  return {
    data,
    mimeType: (ext && mimeMap[ext]) || "application/octet-stream",
    fileName,
  };
}

/**
 * Stream a blob directly from Shelby for proxy routes.
 * Supports refs encoded as `shelby:0x...::path` (preferred) and legacy `shelby:0x...:path`.
 */
export async function streamFromShelby(ref: string): Promise<ReadableStream<Uint8Array>> {
  const parsed = parseBlobRef(ref);
  if (!parsed) {
    throw new Error(
      "Invalid Shelby blob reference. Expected format: shelby:0xABC...::my-file"
    );
  }

  const { account, blobName } = parsed;

  try {
    const client = getShelbyClient();

    console.log(`[Shelby] Streaming blob: ${account}::${blobName}`);

    const blob = await client.download({
      account: AccountAddress.from(account),
      blobName,
    });

    if (!blob?.readable) {
      throw new Error("SDK did not return a readable stream");
    }

    return blob.readable as ReadableStream<Uint8Array>;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Shelby] Download failed:", message);
    if (message.includes("url option") || message.includes("got")) {
      throw new Error(
        "Shelby SDK `got` compatibility issue. Run `npm install` after adding the `got` override in package.json."
      );
    }
    throw err;
  }
}

export async function deleteFromShelby(ref: string): Promise<string | null> {
  const parsed = parseBlobRef(ref);
  if (!parsed) return null;

  const signer = getShelbySigner();
  if (!signer) {
    throw new Error("Shelby signer not configured");
  }

  const client = getShelbyClient();
  const { transaction } = await client.coordination.deleteObject({
    account: signer,
    blobName: parsed.blobName,
  });

  return transaction.hash;
}

export async function uploadMedia(
  file: File,
  type: "avatar" | "banner" | "thumbnail" | "invoice" | "attachment"
): Promise<string> {
  const result = await uploadToShelby(file, `${type}-${Date.now()}`, { type });
  return result.cid;
}

/**
 * Dedicated helper for Stream (video) uploads via official Shelby path.
 * Uses server signer for registration + resumable put (recommended for reliable large video uploads).
 * Returns structured result usable directly as blobRef for Asset records.
 */
export async function uploadStreamVideo(
  file: File | Blob,
  originalFileName?: string,
  userId?: string
): Promise<{
  blobRef: string;
  url: string;
  mimeType: string;
  size: number;
  fileName: string;
  shelbyTxHash?: string;
}> {
  const name = originalFileName || (file instanceof File ? file.name : "stream-video.mp4");
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

  // Organize under streams/ folder. Include userId when available for ownership clarity.
  const folder = userId ? `streams/${userId}` : "streams";
  const fileNameForBlob = `${folder}/${Date.now()}-${safeName}`;

  const upload = await uploadToShelby(file, fileNameForBlob, {
    type: "stream",
  });

  // Re-encode to the canonical shelby: blobRef (uploadToShelby already returns .cid in that format)
  const blobRef = upload.cid;

  // Public URL helper (proxied with auth checks where applicable)
  const { getShelbyPublicUrl } = await import("./shelby-public");

  return {
    blobRef,
    url: getShelbyPublicUrl(blobRef),
    mimeType: upload.mimeType,
    size: upload.size,
    fileName: safeName,
    shelbyTxHash: upload.shelbyTxHash,
  };
}

/** Batch upload helper for API routes (server signer). */
export async function uploadFilesToShelby(
  files: Array<{ name: string; data: Uint8Array }>,
  options?: { expirationMicros?: number; type?: string }
) {
  const blobRefs: string[] = [];
  let shelbyTxHash: string | undefined;

  for (const f of files) {
    const blob = new Blob([Buffer.from(f.data)]);
    const result = await uploadToShelby(blob, f.name, {
      type: options?.type || "uploads",
      expirationMicros: options?.expirationMicros,
    });
    blobRefs.push(result.cid);
    shelbyTxHash = result.shelbyTxHash || shelbyTxHash;
  }

  return { blobRefs, shelbyTxHash: shelbyTxHash ?? null, uploadResult: blobRefs };
}
