import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, requireUser } from "@/lib/datasets/api";

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  modelName: z.string().trim().max(120).nullable().optional(),
  providerName: z.string().trim().max(160).nullable().optional(),
  purpose: z.string().trim().max(2000).nullable().optional(),
  licenseIds: z.array(z.string().regex(/^[0-9a-f]{24}$/i)).max(500).optional(),
  datasetVersionIds: z.array(z.string().regex(/^[0-9a-f]{24}$/i)).max(500).optional(),
});

async function own(id: string, userId: string) {
  if (!isObjectId(id)) return null;
  const p = await prisma.complianceProject.findUnique({ where: { id } });
  return p && p.ownerId === userId ? p : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!(await own(id, auth.user.id))) return jsonError("Project not found", 404);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid update");

  const data = { ...parsed.data };
  // Only allow sources the user actually holds.
  if (data.licenseIds) {
    const valid = await prisma.datasetLicense.findMany({
      where: { id: { in: data.licenseIds }, buyerId: auth.user.id },
      select: { id: true },
    });
    data.licenseIds = valid.map((v) => v.id);
  }
  if (data.datasetVersionIds) {
    const valid = await prisma.datasetVersion.findMany({
      where: { id: { in: data.datasetVersionIds }, status: "SEALED", dataset: { ownerId: auth.user.id } },
      select: { id: true },
    });
    data.datasetVersionIds = valid.map((v) => v.id);
  }
  const project = await prisma.complianceProject.update({ where: { id }, data });
  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!(await own(id, auth.user.id))) return jsonError("Project not found", 404);
  await prisma.complianceProject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
