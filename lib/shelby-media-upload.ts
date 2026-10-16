import "server-only";

import { getShelbyClient, getShelbySigner } from "@/lib/shelby-client";
import { encodeBlobRef, getShelbyPublicUrl } from "@/lib/shelby-public";

/**
 * Clean, focused helper for Stream video uploads using the Shelby SDK
 * (the core of the Shelby Media Kit upload path).
 *
 * This encapsulates:
 * - Server signer lookup + configuration validation
 * - Onchain blob registration, chunkset upload, and commit
 * - Consistent blobRef (shelby:0x...::...) and proxied URL generation
 *
 * Duration is intentionally returned as `null` because accurate video duration
 * is best extracted on the client (before upload) using a temporary <video> element
 * and passed through the FormData. The route layer will enrich the final response.
 */

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function uploadVideoToStream(
  file: File,
  title?: string
): Promise<{
  blobRef: string;
  url: string;
  duration: number | null;
  size: number;
  fileName: string;
  mimeType: string;
  shelbyTxHash?: string;
}> {
  const signer = getShelbySigner();
  if (!signer) {
    throw new Error(
      "Shelby storage is not configured. Set SHELBY_SIGNER_PRIVATE_KEY in your environment."
    );
  }

  const client = getShelbyClient();

  const mimeType = file.type || "video/mp4";
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    throw new Error("Failed to read video file data");
  }

  const size = buffer.length;

  // Create a clean, organized blob name under streams/
  const baseName = title?.trim() || file.name || "untitled-video";
  const blobName = `streams/${Date.now()}-${sanitizeName(baseName)}`;

  // 30-day renewable retention for marketplace content.
  const expirationMicros =
    Date.now() * 1000 + 30 * 24 * 60 * 60 * 1_000_000;

  try {
    // SDK 0.7+: register → putBlobChunksets → commit_object (overwrite).
    await client.upload({
      blobData: new Uint8Array(buffer),
      signer,
      blobName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("insufficient") || msg.includes("balance")) {
      throw new Error("Shelby account has insufficient balance for storage. Fund with APT and ShelbyUSD on shelbynet.");
    }
    throw new Error(`Shelby upload failed: ${msg}`);
  }

  const account = signer.accountAddress.toString();
  const blobRef = encodeBlobRef(account, blobName);
  const url = getShelbyPublicUrl(blobRef);

  return {
    blobRef,
    url,
    duration: null, // Enriched by caller using client-provided durationSeconds
    size,
    fileName: file.name,
    mimeType,
  };
}
