import "server-only";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import { isBlobCommitted } from "@shelby-protocol/sdk/node";
import { createHash } from "crypto";
import { prisma } from "./db";
import { getShelbyClient } from "./shelby-client";
import { parseBlobRef } from "./shelby-public";

export const STORAGE_SALE_SAFETY_MS = 72 * 60 * 60 * 1_000;

export async function inspectShelbyBlob(
  ref: string,
  options?: { expectedSha256?: string | null; verifyIntegrity?: boolean }
) {
  const parsed = parseBlobRef(ref);
  if (!parsed) throw new Error("Invalid Shelby blob reference");
  // SDK 0.9: blobs are keyed by uid and paid in epochs - there is no onchain
  // expiry timestamp any more, so availability is "committed and readable".
  const found = await getShelbyClient().coordination.getObjectBlobMetadata({
    account: AccountAddress.from(parsed.account),
    name: parsed.blobName,
  });
  const metadata = found
    ? { owner: found.blob.owner, size: found.blob.content.blobSize, committed: isBlobCommitted(found.blob.state) }
    : null;
  if (!metadata || !metadata.committed) {
    return {
      available: false as const,
      owner: parsed.account,
      expiresAt: undefined,
      integrityStatus: "UNAVAILABLE",
      reason: "Blob is not committed and readable",
    };
  }
  const expiresAt = undefined as Date | undefined;

  let integrityStatus = options?.expectedSha256 ? "PENDING" : "NOT_PROVIDED";
  if (options?.verifyIntegrity && options.expectedSha256) {
    const blob = await getShelbyClient().download({
      account: AccountAddress.from(parsed.account),
      blobName: parsed.blobName,
    });
    const reader = blob.readable.getReader();
    const hash = createHash("sha256");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }
    integrityStatus = hash.digest("hex") === options.expectedSha256.toLowerCase()
      ? "VERIFIED"
      : "MISMATCH";
    if (integrityStatus === "MISMATCH") {
      return {
        available: false as const,
        owner: metadata.owner.toString(),
        expiresAt,
        integrityStatus,
        reason: "Retrieved blob failed its SHA-256 integrity check",
      };
    }
  } else {
    const blob = await getShelbyClient().download({
      account: AccountAddress.from(parsed.account),
      blobName: parsed.blobName,
      range: { start: 0, end: Math.min(metadata.size, 1) },
    });
    const reader = blob.readable.getReader();
    const first = await reader.read();
    await reader.cancel();
    if (first.done || !first.value.length) {
      return {
        available: false as const,
        owner: metadata.owner.toString(),
        expiresAt,
        integrityStatus,
        reason: "Shelby retrieval returned no data",
      };
    }
  }

  return {
    available: true as const,
    owner: metadata.owner.toString(),
    expiresAt,
    integrityStatus,
    reason: undefined,
  };
}

export function storageIsSaleable(asset: {
  storageStatus?: string | null;
  storageExpiresAt?: Date | null;
  integrityStatus?: string | null;
}): boolean {
  return (
    asset.storageStatus === "ACTIVE" &&
    asset.integrityStatus !== "MISMATCH" &&
    (!asset.storageExpiresAt || asset.storageExpiresAt.getTime() > Date.now() + STORAGE_SALE_SAFETY_MS)
  );
}

export async function reconcileShelbyStorage(limit = 100) {
  const assets = await prisma.asset.findMany({
    where: {
      OR: [
        { isListed: true },
        { storageStatus: { in: ["UNKNOWN", "EXPIRING", "CHECK_FAILED"] } },
        { renewalStatus: { in: ["REQUIRED", "RETRY"] } },
      ],
    },
    orderBy: { storageExpiresAt: "asc" },
    take: limit,
  });

  const summary = { checked: 0, active: 0, stopped: 0, failed: 0 };
  for (const asset of assets) {
    summary.checked++;
    try {
      const verifyIntegrity = !!asset.contentSha256 &&
        (!asset.integrityLastCheckedAt || asset.integrityLastCheckedAt.getTime() < Date.now() - 24 * 60 * 60 * 1_000);
      const state = await inspectShelbyBlob(asset.blobRef, {
        expectedSha256: asset.contentSha256,
        verifyIntegrity,
      });
      const saleable = state.available &&
        (!state.expiresAt || state.expiresAt.getTime() > Date.now() + STORAGE_SALE_SAFETY_MS);
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          isListed: saleable ? asset.isListed : false,
          storageOwner: state.owner,
          storageExpiresAt: state.expiresAt,
          storageStatus: saleable ? "ACTIVE" : state.available ? "EXPIRING" : "UNAVAILABLE",
          storageLastCheckedAt: new Date(),
          storageFailureReason: state.reason,
          integrityStatus: state.integrityStatus,
          integrityLastCheckedAt: verifyIntegrity ? new Date() : asset.integrityLastCheckedAt,
          renewalStatus: saleable ? "SCHEDULED" : state.available ? "REQUIRED" : "FAILED",
          renewalNextAttemptAt: saleable && state.expiresAt
            ? new Date(state.expiresAt.getTime() - STORAGE_SALE_SAFETY_MS)
            : undefined,
        },
      });
      if (saleable) summary.active++;
      else summary.stopped++;
    } catch (error) {
      summary.failed++;
      const reason = error instanceof Error ? error.message : "Shelby health check failed";
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          isListed: false,
          storageStatus: "CHECK_FAILED",
          storageLastCheckedAt: new Date(),
          storageFailureReason: reason,
          renewalStatus: "RETRY",
          renewalAttempts: { increment: 1 },
          renewalNextAttemptAt: new Date(Date.now() + 60 * 60 * 1_000),
        },
      });
      console.error(`[Shelby lifecycle] stopped sales for asset ${asset.id}: ${reason}`);
    }
  }
  return summary;
}
