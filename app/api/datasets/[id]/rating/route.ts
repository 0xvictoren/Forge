import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, NO_STORE, rateLimited, requireUser } from "@/lib/datasets/api";
import { refreshRating } from "@/lib/datasets/rating";

const schema = z.object({ score: z.number().int().min(1).max(10), comment: z.string().trim().max(1000).optional() });

/** Licence holders rate a dataset out of 10. One rating per person, editable. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`rating:${auth.user.id}`, 10);
  if (limited) return limited;
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Dataset not found", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Give a score from 1 to 10");

  const dataset = await prisma.dataset.findUnique({ where: { id }, select: { ownerId: true } });
  if (!dataset) return jsonError("Dataset not found", 404);
  if (dataset.ownerId === auth.user.id) return jsonError("You cannot rate your own dataset", 403);
  const holds = await prisma.datasetLicense.findFirst({ where: { datasetId: id, buyerId: auth.user.id }, select: { id: true } });
  if (!holds) return jsonError("Only licence holders can rate a dataset", 403);

  await prisma.datasetRating.upsert({
    where: { datasetId_userId: { datasetId: id, userId: auth.user.id } },
    create: { datasetId: id, userId: auth.user.id, score: parsed.data.score, comment: parsed.data.comment, source: "HUMAN" },
    update: { score: parsed.data.score, comment: parsed.data.comment },
  });
  const refreshed = await refreshRating(id);
  return NextResponse.json({ ok: true, rating: refreshed?.rating ?? null }, { headers: NO_STORE });
}
