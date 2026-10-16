import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/datasets/api";

const schema = z.object({ changelog: z.string().trim().max(2000).optional() });

/** Start a new draft version. Sealed versions are immutable, so updates always add one. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!dataset || dataset.ownerId !== auth.user.id) return jsonError("Dataset not found", 404);
  const latest = dataset.versions[0];
  if (latest && latest.status === "DRAFT") {
    return NextResponse.json({ version: { id: latest.id, versionNumber: latest.versionNumber }, existing: true });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const version = await prisma.datasetVersion.create({
    data: {
      datasetId: dataset.id,
      versionNumber: (latest?.versionNumber || 0) + 1,
      changelog: parsed.success ? parsed.data.changelog : undefined,
    },
  });
  return NextResponse.json({ version: { id: version.id, versionNumber: version.versionNumber } }, { status: 201 });
}
