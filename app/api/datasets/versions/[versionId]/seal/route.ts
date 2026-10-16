import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, requireUser } from "@/lib/datasets/api";
import {
  buildManifest,
  computeSealHash,
  hashDatasheet,
  hashManifest,
  validateDatasheet,
} from "@/lib/datasets/manifest";
import { CONTRACT_ADDRESS } from "@/lib/constants";

const schema = z.object({ datasheet: z.unknown(), changelog: z.string().trim().max(2000).optional() });

/**
 * Phase 1 of sealing: freeze the file list, hash manifest + datasheet and
 * return the values the owner signs onchain. The version only becomes SEALED
 * once the anchor transaction is verified (or the owner opts to seal offchain).
 */
export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { versionId } = await params;
  if (!isObjectId(versionId)) return jsonError("Version not found", 404);

  const version = await prisma.datasetVersion.findUnique({
    where: { id: versionId },
    include: { dataset: true, files: { where: { isSample: false } } },
  });
  if (!version || version.dataset.ownerId !== auth.user.id) return jsonError("Version not found", 404);
  if (version.status === "SEALED") return jsonError("This version is already sealed");
  if (!version.files.length) return jsonError("Add at least one file before sealing");

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request");
  const sheet = validateDatasheet(parsed.data.datasheet);
  if (!sheet.ok) return jsonError(sheet.error);

  let manifest;
  try {
    manifest = buildManifest({
      datasetId: version.datasetId,
      versionNumber: version.versionNumber,
      files: version.files.map((f) => ({ path: f.path, sizeBytes: f.sizeBytes, sha256: f.sha256, mimeType: f.mimeType })),
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not build manifest");
  }

  const manifestHash = await hashManifest(manifest);
  const datasheetHash = await hashDatasheet(sheet.datasheet);
  const sealHash = await computeSealHash({
    datasetId: version.datasetId,
    versionNumber: version.versionNumber,
    manifestHash,
    datasheetHash,
  });

  await prisma.datasetVersion.update({
    where: { id: version.id },
    data: {
      manifest,
      datasheet: sheet.datasheet,
      manifestHash,
      datasheetHash,
      sealHash,
      changelog: parsed.data.changelog ?? version.changelog,
      fileCount: manifest.totals.fileCount,
      totalBytes: manifest.totals.totalBytes,
    },
  });

  return NextResponse.json({
    seal: {
      datasetId: version.datasetId,
      versionNumber: version.versionNumber,
      manifestHash,
      datasheetHash,
      sealHash,
    },
    anchorAvailable: !!CONTRACT_ADDRESS,
  });
}
