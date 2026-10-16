import { isObjectId, jsonError, rateLimited } from "@/lib/datasets/api";
import { handlePaidRead } from "@/lib/agents/read";
import { requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Paid read. Without an X-Forge-Micropayment header this returns 402 with
 * everything needed to sign one; with a valid one it returns the bytes
 * (honouring Range) and charges exactly the quoted price.
 */
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!isObjectId(fileId)) return jsonError("File not found", 404);
  const limited = rateLimited(`agent-read:${request.headers.get("x-forge-agent") || requestIp(request)}`, 600);
  if (limited) return limited;
  return handlePaidRead(request, fileId);
}
