import { prisma } from "@/lib/db";
import { isObjectId, jsonError, rateLimited, requireUser } from "@/lib/datasets/api";
import { buildDeliveryResponse } from "@/lib/datasets/delivery-response";
import { resolveFileAccess } from "@/lib/datasets/server";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`dataset-download:${auth.user.id}`, 30);
  if (limited) return limited;

  const { fileId } = await params;
  if (!isObjectId(fileId)) return jsonError("File not found", 404);
  const file = await prisma.datasetFile.findUnique({ where: { id: fileId }, include: { version: { include: { dataset: true } } } });
  if (!file || file.isSample) return jsonError("File not found", 404);

  const access = await resolveFileAccess(auth.user.id, file);
  if (!access.allowed) return jsonError("A licence covering this version is required", 403);

  return buildDeliveryResponse({
    request,
    file,
    datasetId: file.version.datasetId,
    userId: auth.user.id,
    license: access.license,
    action: "DOWNLOAD",
  });
}
