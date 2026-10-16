import { NextResponse } from "next/server";
import { isObjectId, jsonError, requireUser } from "@/lib/datasets/api";
import { buildProjectRecord } from "@/lib/datasets/compliance-server";
import { slugify } from "@/lib/utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Project not found", 404);
  const built = await buildProjectRecord(id, auth.user.id, new URL(request.url).origin);
  if (!built) return jsonError("Project not found", 404);
  return new NextResponse(JSON.stringify(built.record, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${slugify(built.project.name) || "compliance"}-training-data-record.json"`,
      "Cache-Control": "no-store",
    },
  });
}
