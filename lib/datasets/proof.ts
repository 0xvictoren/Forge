import "server-only";
import { prisma } from "@/lib/db";
import { getExplorerUrl } from "@/lib/aptos";
import { computeSealHash, hashDatasheet, hashManifest, type DatasetManifest, type Datasheet } from "./manifest";
import { verifyAnchorTransaction } from "./provenance-server";
import { checkAvailability } from "./availability";

/** Recompute every hash from stored data and re-check the onchain event. */
export async function computeProof(versionId: string) {
  const version = await prisma.datasetVersion.findUnique({
    where: { id: versionId },
    include: { dataset: { include: { owner: true } } },
  });
  if (!version || version.status !== "SEALED" || !version.manifest || !version.datasheet) return null;

  const manifest = version.manifest as unknown as DatasetManifest;
  const datasheet = version.datasheet as unknown as Datasheet;
  const manifestHash = await hashManifest(manifest);
  const datasheetHash = await hashDatasheet(datasheet);
  const sealHash = await computeSealHash({ datasetId: version.datasetId, versionNumber: version.versionNumber, manifestHash, datasheetHash });

  const checks = {
    manifestHash: manifestHash === version.manifestHash,
    datasheetHash: datasheetHash === version.datasheetHash,
    sealHash: sealHash === version.sealHash,
    onChain: null as null | boolean,
    onChainError: null as null | string,
  };

  const owner = version.dataset.owner.walletAddress || version.dataset.owner.address;
  if (version.anchorTxHash && owner) {
    const result = await verifyAnchorTransaction(version.anchorTxHash, {
      owner,
      datasetId: version.datasetId,
      versionNumber: version.versionNumber,
      manifestHash,
      datasheetHash,
      sealHash,
    });
    checks.onChain = result.valid;
    checks.onChainError = result.error ?? null;
  }

  const availability = await checkAvailability(version.id).catch(() => null);

  return {
    availability,
    dataset: {
      id: version.datasetId,
      slug: version.dataset.slug,
      title: version.dataset.title,
      visibility: version.dataset.visibility,
      status: version.dataset.status,
    },
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      sealedAt: version.sealedAt,
      anchoredAt: version.anchoredAt,
      fileCount: version.fileCount,
      totalBytes: version.totalBytes,
    },
    owner,
    ownerName: version.dataset.owner.displayName || version.dataset.owner.username || null,
    manifest,
    datasheet,
    manifestHash,
    datasheetHash,
    sealHash,
    anchorTxHash: version.anchorTxHash,
    anchorExplorerUrl: version.anchorTxHash ? getExplorerUrl(version.anchorTxHash) : null,
    checks,
    verified: checks.manifestHash && checks.datasheetHash && checks.sealHash && checks.onChain !== false,
  };
}

export type Proof = NonNullable<Awaited<ReturnType<typeof computeProof>>>;
