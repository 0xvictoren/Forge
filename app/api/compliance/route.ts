import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/datasets/api";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const projects = await prisma.complianceProject.findMany({ where: { ownerId: auth.user.id }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ projects });
}

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  modelName: z.string().trim().max(120).optional(),
  providerName: z.string().trim().max(160).optional(),
  purpose: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid project");
  const project = await prisma.complianceProject.create({ data: { ...parsed.data, ownerId: auth.user.id } });
  return NextResponse.json({ project }, { status: 201 });
}
