import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, NO_STORE, rateLimited, requireUser } from "@/lib/datasets/api";
import { issuePipelineToken } from "@/lib/datasets/pipeline-token";
import { licenseCoversVersion, logDatasetAccess } from "@/lib/datasets/server";

const schema = z.object({ versionId: z.string().regex(/^[0-9a-f]{24}$/i) });

/** Mint a one-hour bearer token scoped to one licence + version, for training pipelines. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`dataset-credentials:${auth.user.id}`, 10);
  if (limited) return limited;

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Dataset not found", 404);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("versionId required");

  const version = await prisma.datasetVersion.findUnique({ where: { id: parsed.data.versionId } });
  if (!version || version.datasetId !== id || version.status !== "SEALED") return jsonError("Version not found", 404);

  const licenses = await prisma.datasetLicense.findMany({
    where: { buyerId: auth.user.id, datasetId: id, status: "ACTIVE" },
    include: { version: { select: { versionNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  const license = licenses.find((l) => licenseCoversVersion(l, version));
  if (!license) return jsonError("A licence covering this version is required", 403);

  const { token, expiresAt } = await issuePipelineToken({ licenseId: license.id, versionId: version.id, userId: auth.user.id });
  await logDatasetAccess({ request, datasetId: id, licenseId: license.id, userId: auth.user.id, action: "CREDENTIAL" });

  const origin = new URL(request.url).origin;
  return NextResponse.json(
    { token, expiresAt, manifestUrl: `${origin}/api/pipeline/manifest` },
    { headers: NO_STORE }
  );
}
