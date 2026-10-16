import "server-only";
import { prisma } from "@/lib/db";
import { getExplorerUrl } from "@/lib/aptos";
import { buildComplianceRecord, type ComplianceDatasetEntry } from "./compliance";
import type { Datasheet } from "./manifest";

/** Sources a user can attach: their active licences and their own sealed versions. */
export async function listAttachableSources(userId: string) {
  const [licenses, ownVersions] = await Promise.all([
    prisma.datasetLicense.findMany({
      where: { buyerId: userId, status: "ACTIVE" },
      include: { dataset: true, version: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.datasetVersion.findMany({
      where: { status: "SEALED", dataset: { ownerId: userId } },
      include: { dataset: true },
      orderBy: { sealedAt: "desc" },
    }),
  ]);
  return { licenses, ownVersions };
}

export async function buildProjectRecord(projectId: string, userId: string, origin: string) {
  const project = await prisma.complianceProject.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== userId) return null;

  const [licenses, versions] = await Promise.all([
    prisma.datasetLicense.findMany({
      where: { id: { in: project.licenseIds }, buyerId: userId },
      include: { dataset: true, version: true, seller: true },
    }),
    prisma.datasetVersion.findMany({
      where: { id: { in: project.datasetVersionIds }, status: "SEALED", dataset: { ownerId: userId } },
      include: { dataset: true },
    }),
  ]);

  const entries: ComplianceDatasetEntry[] = [
    ...licenses.map((l) => ({
      datasetTitle: l.dataset.title,
      datasetUrl: `${origin}/datasets/${l.dataset.slug}`,
      versionNumber: l.version.versionNumber,
      sealHash: l.version.sealHash || "",
      manifestHash: l.version.manifestHash || "",
      anchorTxHash: l.version.anchorTxHash,
      anchorExplorerUrl: l.version.anchorTxHash ? getExplorerUrl(l.version.anchorTxHash) : null,
      totalBytes: l.version.totalBytes,
      fileCount: l.version.fileCount,
      relationship: "LICENSED" as const,
      license: {
        template: l.template,
        certificateUrl: `${origin}/license/${l.certificateSlug}`,
        txHash: l.txHash,
        termsHash: l.termsHash,
        issuedAt: l.createdAt.toISOString(),
        licensor: l.seller.displayName || l.seller.username || l.seller.walletAddress || "Seller",
      },
      datasheet: (l.version.datasheet as unknown as Datasheet) ?? null,
    })),
    ...versions.map((v) => ({
      datasetTitle: v.dataset.title,
      datasetUrl: `${origin}/proof/${v.id}`,
      versionNumber: v.versionNumber,
      sealHash: v.sealHash || "",
      manifestHash: v.manifestHash || "",
      anchorTxHash: v.anchorTxHash,
      anchorExplorerUrl: v.anchorTxHash ? getExplorerUrl(v.anchorTxHash) : null,
      totalBytes: v.totalBytes,
      fileCount: v.fileCount,
      relationship: "OWN" as const,
      datasheet: (v.datasheet as unknown as Datasheet) ?? null,
    })),
  ];

  return {
    project,
    record: buildComplianceRecord({
      projectName: project.name,
      modelName: project.modelName,
      providerName: project.providerName,
      purpose: project.purpose,
      generatedAt: new Date().toISOString(),
      entries,
    }),
    entries,
  };
}
