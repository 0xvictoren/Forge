import "server-only";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import {
  encodeBlobRef,
  parseBlobRef,
  type ShelbyUploadResult,
} from "./shelby-public";
import { getShelbyClient, getShelbySigner } from "./shelby-client";
import {
  createDefaultErasureCodingProvider,
  generateCommitments,
  type ShelbyNodeClient,
} from "@shelby-protocol/sdk/node";

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
      : Date.now() * 1000 + 365 * 24 * 60 * 60 * 1_000_000;

  let shelbyTxHash: string | undefined;
  const existing = await client.coordination.getBlobMetadata({
    account: signer.accountAddress,
    name: blobName,
  });

  if (!existing) {
    const provider = await createDefaultErasureCodingProvider();
    const blobCommitments = await generateCommitments(provider, new Uint8Array(buffer));
    const { transaction } = await client.coordination.registerBlob({
      account: signer,
      blobName,
      blobMerkleRoot: blobCommitments.blob_merkle_root,
      size: buffer.length,
      expirationMicros,
      config: provider.config,
    });
    shelbyTxHash = transaction.hash;
    await client.coordination.aptos.waitForTransaction({
      transactionHash: transaction.hash,
    });
  }

  await client.rpc.putBlobResumable({
    account: signer,
    blobName,
    blobData: new Uint8Array(buffer),
  });

  const account = signer.accountAddress.toString();
  const cid = encodeBlobRef(account, blobName);

  return { cid, mimeType, size, account, blobName, shelbyTxHash };
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
  const fileName = parsed.blobName.split("/").pop() || "download";
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

  const client = getShelbyClient() as ShelbyNodeClient & {
    deleteBlob: (params: {
      account: typeof signer;
      blobName: string;
    }) => Promise<{ transaction: { hash: string } }>;
  };

  const { transaction } = await client.deleteBlob({
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
