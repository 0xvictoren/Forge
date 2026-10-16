import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, NO_STORE, rateLimited } from "@/lib/datasets/api";
import { bearerToken, verifyPipelineToken } from "@/lib/datasets/pipeline-token";

/** Bearer-authenticated manifest: every file a pipeline may pull, with its URL and hash. */
export async function GET(request: Request) {
  const token = bearerToken(request);
  const claims = token ? await verifyPipelineToken(token) : null;
  if (!claims) return jsonError("Missing or expired pipeline token", 401);
  const limited = rateLimited(`pipeline-manifest:${claims.licenseId}`, 60);
  if (limited) return limited;

  const license = await prisma.datasetLicense.findUnique({ where: { id: claims.licenseId } });
  if (!license || license.status !== "ACTIVE" || license.buyerId !== claims.userId) return jsonError("Licence is not active", 403);

  const version = await prisma.datasetVersion.findUnique({
    where: { id: claims.versionId },
    include: { dataset: { select: { id: true, slug: true, title: true } }, files: { where: { isSample: false }, orderBy: { path: "asc" } } },
  });
  if (!version) return jsonError("Version not found", 404);

  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      dataset: version.dataset,
      version: { number: version.versionNumber, sealHash: version.sealHash, manifestHash: version.manifestHash },
      license: { template: license.template, certificate: `${origin}/license/${license.certificateSlug}` },
      files: version.files.map((f) => ({
        path: f.path,
        sizeBytes: f.sizeBytes,
        sha256: f.sha256,
        url: `${origin}/api/pipeline/files/${f.id}`,
      })),
      note: "Text files are fingerprinted per licence, so their delivered bytes differ from the sealed sha256. Binary files match it exactly.",
    },
    { headers: NO_STORE }
  );
}
