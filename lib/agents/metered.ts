import "server-only";
import { randomBytes } from "crypto";
import type { Dataset, DatasetVersion, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { licenseTextHash, renderLicenseText } from "@/lib/datasets/licenses";
import { newFingerprintId, newSecretHex } from "@/lib/datasets/server";

/**
 * Agents that pay per read hold a METERED licence per dataset. It is created
 * on the first paid read and carries its own fingerprint, so agent deliveries
 * are traceable exactly like human ones and appear in compliance records.
 */
export async function ensureMeteredLicense(input: {
  buyerId: string;
  channelDbId: string;
  dataset: Dataset & { owner: User };
  version: DatasetVersion;
}) {
  const existing = await prisma.datasetLicense.findFirst({
    where: { buyerId: input.buyerId, datasetId: input.dataset.id, template: "METERED" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const sellerName = input.dataset.owner.displayName || input.dataset.owner.username || input.dataset.owner.walletAddress || "Seller";
  const licenseText = renderLicenseText({
    template: "METERED",
    datasetTitle: input.dataset.title,
    datasetId: input.dataset.id,
    versionNumber: input.version.versionNumber,
    sealHash: input.version.sealHash || "",
    sellerName,
  });
  const textHash = await licenseTextHash(licenseText);
  try {
    const license = await prisma.datasetLicense.create({
      data: {
        datasetId: input.dataset.id,
        versionId: input.version.id,
        buyerId: input.buyerId,
        sellerId: input.dataset.ownerId,
        template: "METERED",
        licenseText,
        licenseTextHash: textHash,
        termsHash: textHash,
        txHash: `metered:${input.channelDbId}:${input.dataset.id}`,
        amountApt: 0,
        fingerprintId: newFingerprintId(),
        canarySeed: newSecretHex(32),
        certificateSlug: randomBytes(10).toString("hex"),
        orgName: "Agent",
        intendedUse: "Pay-per-read via Shelby micropayment channel",
      },
    });
    await prisma.dataset.update({ where: { id: input.dataset.id }, data: { licenseCount: { increment: 1 } } });
    return license;
  } catch {
    // A concurrent first read created it; use that one.
    const again = await prisma.datasetLicense.findFirst({
      where: { buyerId: input.buyerId, datasetId: input.dataset.id, template: "METERED" },
    });
    if (again) return again;
    throw new Error("Could not create metered licence");
  }
}
