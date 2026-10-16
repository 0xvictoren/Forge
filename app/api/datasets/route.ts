import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError, rateLimited, requireUser } from "@/lib/datasets/api";
import { isAllowedCoverUrl, MODALITIES } from "@/lib/datasets/modalities";
import { publicDataset, uniqueDatasetSlug } from "@/lib/datasets/server";

const MODALITY_IDS = MODALITIES.map((m) => m.id) as [string, ...string[]];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 80);
  const modality = url.searchParams.get("modality");
  const sort = url.searchParams.get("sort") || "new";
  const take = Math.min(48, Math.max(1, Number(url.searchParams.get("limit")) || 24));

  const where: Prisma.DatasetWhereInput = { visibility: "listed", status: "PUBLISHED" };
  if (modality && MODALITY_IDS.includes(modality)) where.modality = modality;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { tagline: { contains: q, mode: "insensitive" } },
      { tags: { has: q.toLowerCase() } },
    ];
  }

  const datasets = await prisma.dataset.findMany({
    where,
    take,
    orderBy: sort === "popular" ? { licenseCount: "desc" } : { createdAt: "desc" },
    include: { owner: true, versions: { where: { status: "SEALED" }, include: { files: { where: { isSample: true } } } } },
  });

  return NextResponse.json({ datasets: datasets.map(publicDataset) });
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(8000).optional(),
  modality: z.enum(MODALITY_IDS),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(32)).max(12).optional(),
  coverUrl: z.string().url().max(800).refine(isAllowedCoverUrl, "Covers must come from Unsplash or Shelby").optional(),
  coverCredit: z.string().max(200).optional(),
  visibility: z.enum(["private", "listed"]).default("listed"),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`dataset-create:${auth.user.id}`, 10);
  if (limited) return limited;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid dataset");

  const { tags, ...data } = parsed.data;
  const dataset = await prisma.dataset.create({
    data: {
      ...data,
      tags: [...new Set(tags || [])],
      ownerId: auth.user.id,
      slug: await uniqueDatasetSlug(data.title),
      versions: { create: { versionNumber: 1 } },
    },
    include: { versions: true },
  });

  return NextResponse.json(
    { dataset: { id: dataset.id, slug: dataset.slug }, version: { id: dataset.versions[0].id, versionNumber: 1 } },
    { status: 201 }
  );
}
