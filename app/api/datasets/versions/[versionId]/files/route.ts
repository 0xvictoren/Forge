import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, rateLimited, requireUser } from "@/lib/datasets/api";
import { normalizeManifestPath } from "@/lib/datasets/manifest";
import { parseBlobRef } from "@/lib/shelby-public";

const fileSchema = z.object({
  path: z.string().trim().min(1).max(512),
  sizeBytes: z.number().int().min(0).max(1e13),
  mimeType: z.string().max(200).default("application/octet-stream"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  blobRef: z.string().min(8).max(1024),
  storageTxHash: z.string().max(100).optional(),
  storageExpiresAt: z.string().datetime().optional(),
  isSample: z.boolean().default(false),
  encryption: z
    .object({
      encryptionVersion: z.union([z.literal(1), z.literal(2)]),
      wrappedKeyOwner: z.string().min(16).max(4096),
      wrappedKeyShare: z.string().min(16).max(4096),
      encryptionShareKey: z.string().min(16).max(4096),
    })
    .nullable()
    .optional(),
});

const bodySchema = z.object({ files: z.array(fileSchema).min(1).max(200) });

async function loadDraft(versionId: string, userId: string) {
  if (!isObjectId(versionId)) return null;
  const version = await prisma.datasetVersion.findUnique({ where: { id: versionId }, include: { dataset: true } });
  if (!version || version.dataset.ownerId !== userId) return null;
  return version;
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { versionId } = await params;
  const version = await loadDraft(versionId, auth.user.id);
  if (!version) return jsonError("Version not found", 404);
  const files = await prisma.datasetFile.findMany({
    where: { versionId },
    orderBy: { path: "asc" },
    select: { id: true, path: true, sizeBytes: true, isSample: true, mimeType: true },
  });
  return NextResponse.json({ files, status: version.status }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`dataset-files:${auth.user.id}`, 60);
  if (limited) return limited;

  const { versionId } = await params;
  const version = await loadDraft(versionId, auth.user.id);
  if (!version) return jsonError("Version not found", 404);
  if (version.status !== "DRAFT") return jsonError("Sealed versions cannot change. Start a new version.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid files");

  const wallet = (auth.user.walletAddress || auth.user.address || "").toLowerCase();
  for (const f of parsed.data.files) {
    const ref = parseBlobRef(f.blobRef);
    if (!ref) return jsonError(`Invalid storage reference for ${f.path}`);
    if (wallet && ref.account.toLowerCase() !== wallet) return jsonError("Files must be stored from your own wallet");
    if (!f.isSample && !f.encryption) return jsonError(`${f.path} must be encrypted, only samples may be public`);
  }

  const existing = await prisma.datasetFile.findMany({ where: { versionId }, select: { path: true, isSample: true } });
  const taken = new Set(existing.map((e) => `${e.isSample ? "s" : "d"}:${e.path}`));

  const rows = [];
  for (const f of parsed.data.files) {
    const path = normalizeManifestPath(f.path);
    const key = `${f.isSample ? "s" : "d"}:${path}`;
    if (taken.has(key)) return jsonError(`A file named ${path} already exists in this version`);
    taken.add(key);
    rows.push({
      versionId,
      path,
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType,
      sha256: f.sha256.toLowerCase(),
      blobRef: f.blobRef,
      storageTxHash: f.storageTxHash,
      storageExpiresAt: f.storageExpiresAt ? new Date(f.storageExpiresAt) : undefined,
      isSample: f.isSample,
      isEncrypted: !!f.encryption,
      encryptionVersion: f.encryption?.encryptionVersion,
      wrappedKeyOwner: f.encryption?.wrappedKeyOwner,
      wrappedKeyShare: f.encryption?.wrappedKeyShare,
      encryptionShareKey: f.encryption?.encryptionShareKey,
    });
  }

  await prisma.datasetFile.createMany({ data: rows });
  const files = await prisma.datasetFile.findMany({ where: { versionId, isSample: false } });
  await prisma.datasetVersion.update({
    where: { id: versionId },
    data: { fileCount: files.length, totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0) },
  });

  return NextResponse.json({ ok: true, fileCount: files.length }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { versionId } = await params;
  const version = await loadDraft(versionId, auth.user.id);
  if (!version) return jsonError("Version not found", 404);
  if (version.status !== "DRAFT") return jsonError("Sealed versions cannot change");
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!isObjectId(fileId)) return jsonError("fileId required");
  await prisma.datasetFile.deleteMany({ where: { id: fileId, versionId } });
  const files = await prisma.datasetFile.findMany({ where: { versionId, isSample: false } });
  await prisma.datasetVersion.update({
    where: { id: versionId },
    data: { fileCount: files.length, totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0) },
  });
  return NextResponse.json({ ok: true });
}
