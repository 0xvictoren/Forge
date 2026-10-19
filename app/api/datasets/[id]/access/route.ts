import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, NO_STORE, requireUser } from "@/lib/datasets/api";
import { detectFingerprintFormat } from "@/lib/datasets/fingerprint";
import { bestCoveringLicense, MAX_DELIVERIES_PER_FILE_PER_DAY, MAX_FINGERPRINT_BYTES } from "@/lib/datasets/server";

/** Files the signed-in user may download, grouped by version, with delivery mode. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Dataset not found", 404);

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: { versions: { where: { status: "SEALED" }, orderBy: { versionNumber: "desc" }, include: { files: { where: { isSample: false } } } } },
  });
  if (!dataset) return jsonError("Dataset not found", 404);

  const isOwner = dataset.ownerId === auth.user.id;
  const licenses = isOwner
    ? []
    : await prisma.datasetLicense.findMany({
        where: { buyerId: auth.user.id, datasetId: id, status: "ACTIVE" },
        include: { version: { select: { versionNumber: true } } },
        orderBy: { createdAt: "desc" },
      });
  if (!isOwner && !licenses.length) return jsonError("You need a licence to access these files", 403);

  const versions = dataset.versions
    .map((v) => {
      const license = isOwner ? null : bestCoveringLicense(licenses, v);
      if (!isOwner && !license) return null;
      return {
        id: v.id,
        versionNumber: v.versionNumber,
        sealHash: v.sealHash,
        licenseId: license?.id ?? null,
        files: v.files.map((f) => {
          const format = detectFingerprintFormat(f.path, f.mimeType);
          return {
            id: f.id,
            path: f.path,
            sizeBytes: f.sizeBytes,
            mimeType: f.mimeType,
            sha256: f.sha256,
            fingerprinted: !isOwner && format !== "binary" && f.sizeBytes <= MAX_FINGERPRINT_BYTES,
            downloadUrl: `/api/datasets/files/${f.id}/download`,
          };
        }),
      };
    })
    .filter(Boolean);

  return NextResponse.json(
    {
      isOwner,
      dailyLimitPerFile: isOwner ? null : MAX_DELIVERIES_PER_FILE_PER_DAY,
      licenses: licenses.map((l) => ({
        id: l.id,
        template: l.template,
        certificateSlug: l.certificateSlug,
        fingerprintId: l.fingerprintId,
        downloadCount: l.downloadCount,
      })),
      versions,
    },
    { headers: NO_STORE }
  );
}
