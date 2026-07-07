import "server-only";

import { getShelbyClient, getShelbySigner } from "@/lib/shelby-client";
import { encodeBlobRef, getShelbyPublicUrl } from "@/lib/shelby-public";
import {
  createDefaultErasureCodingProvider,
  generateCommitments,
} from "@shelby-protocol/sdk/node";

/**
 * Clean, focused helper for Stream video uploads using the Shelby SDK
 * (the core of the Shelby Media Kit upload path).
 *
 * This encapsulates:
 * - Server signer lookup + configuration validation
 * - On-chain blob registration (coordination)
 * - Resumable data upload to the distributed storage network
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
  } catch (err) {
    throw new Error("Failed to read video file data");
  }

  const size = buffer.length;

  // Create a clean, organized blob name under streams/
  const baseName = title?.trim() || file.name || "untitled-video";
  const blobName = `streams/${Date.now()}-${sanitizeName(baseName)}`;

  // 1 year default expiration (adjustable via metadata if needed later)
  const expirationMicros =
    Date.now() * 1000 + 365 * 24 * 60 * 60 * 1_000_000;

  let shelbyTxHash: string | undefined;

  try {
    // Check for existing registration (makes re-uploads of same logical name safer)
    const existing = await client.coordination.getBlobMetadata({
      account: signer.accountAddress,
      name: blobName,
    });

    if (!existing) {
      const provider = await createDefaultErasureCodingProvider();
      const blobCommitments = await generateCommitments(
        provider,
        new Uint8Array(buffer)
      );

      const { transaction } = await client.coordination.registerBlob({
        account: signer,
        blobName,
        blobMerkleRoot: blobCommitments.blob_merkle_root,
        size: buffer.length,
        expirationMicros,
        config: provider.config,
      });

      shelbyTxHash = transaction.hash;

      // Wait for the registration tx to settle on ShelbyNet
      await client.coordination.aptos.waitForTransaction({
        transactionHash: transaction.hash,
      });
    }

    // Upload (or re-upload) the actual blob data using the resumable endpoint
    await client.rpc.putBlobResumable({
      account: signer,
      blobName,
      blobData: new Uint8Array(buffer),
    });
  } catch (err: any) {
    // Re-throw with clearer context for the route layer
    const msg = err?.message || String(err);
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
    shelbyTxHash,
  };
}
