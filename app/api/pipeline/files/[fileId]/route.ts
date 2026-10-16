import { prisma } from "@/lib/db";
import { isObjectId, jsonError, rateLimited } from "@/lib/datasets/api";
import { buildDeliveryResponse } from "@/lib/datasets/delivery-response";
import { bearerToken, verifyPipelineToken } from "@/lib/datasets/pipeline-token";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const token = bearerToken(request);
  const claims = token ? await verifyPipelineToken(token) : null;
  if (!claims) return jsonError("Missing or expired pipeline token", 401);
  const limited = rateLimited(`pipeline-file:${claims.licenseId}`, 120);
  if (limited) return limited;

  const { fileId } = await params;
  if (!isObjectId(fileId)) return jsonError("File not found", 404);

  const [license, file] = await Promise.all([
    prisma.datasetLicense.findUnique({ where: { id: claims.licenseId } }),
    prisma.datasetFile.findUnique({ where: { id: fileId }, include: { version: true } }),
  ]);
  if (!license || license.status !== "ACTIVE" || license.buyerId !== claims.userId) return jsonError("Licence is not active", 403);
  if (!file || file.isSample || file.versionId !== claims.versionId) return jsonError("File is outside this credential's scope", 403);

  return buildDeliveryResponse({
    request,
    file,
    datasetId: file.version.datasetId,
    userId: claims.userId,
    license,
    action: "PIPELINE",
  });
}
