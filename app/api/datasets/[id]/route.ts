import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isObjectId, jsonError, requireUser } from "@/lib/datasets/api";
import { LICENSE_TEMPLATES, parseOffers } from "@/lib/datasets/licenses";
import { isAllowedCoverUrl, MODALITIES } from "@/lib/datasets/modalities";
import { publicDataset } from "@/lib/datasets/server";
import { parseReadPricing } from "@/lib/agents/pricing";
import { notifyFeed } from "@/lib/agents/feeds";

const MODALITY_IDS = MODALITIES.map((m) => m.id) as [string, ...string[]];

async function load(id: string) {
  return prisma.dataset.findFirst({
    where: isObjectId(id) ? { id } : { slug: id },
    include: { owner: true, versions: { orderBy: { versionNumber: "desc" }, include: { files: { where: { isSample: true } } } } },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dataset = await load(id);
  if (!dataset) return jsonError("Dataset not found", 404);
  const user = await getSessionUser();
  const isOwner = user?.id === dataset.ownerId;
  if (!isOwner && (dataset.visibility !== "listed" || dataset.status === "DRAFT")) return jsonError("Dataset not found", 404);
  return NextResponse.json({ dataset: publicDataset(dataset), isOwner });
}

const patchSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  tagline: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  modality: z.enum(MODALITY_IDS).optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(32)).max(12).optional(),
  coverUrl: z.string().url().max(800).refine(isAllowedCoverUrl, "Covers must come from Unsplash or Shelby").nullable().optional(),
  coverCredit: z.string().max(200).nullable().optional(),
  visibility: z.enum(["private", "listed"]).optional(),
  offers: z
    .array(z.object({ template: z.enum(LICENSE_TEMPLATES), priceApt: z.number().min(0).max(1_000_000) }))
    .max(3)
    .optional(),
  readPricing: z
    .object({ enabled: z.boolean(), pricePerGbApt: z.number().min(0).max(1_000_000), minChargeApt: z.number().min(0).max(1_000) })
    .optional(),
  action: z.enum(["publish", "unpublish", "archive"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const dataset = await load(id);
  if (!dataset || dataset.ownerId !== auth.user.id) return jsonError("Dataset not found", 404);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid update");
  const { action, offers, tags, readPricing, ...fields } = parsed.data;

  const data: Record<string, unknown> = { ...fields };
  if (readPricing) {
    if (readPricing.enabled && readPricing.pricePerGbApt <= 0 && readPricing.minChargeApt <= 0) {
      return jsonError("Pay-per-read needs a price per GB or a minimum charge");
    }
    data.readPricing = parseReadPricing(readPricing);
  }
  if (tags) data.tags = [...new Set(tags)];
  if (offers) {
    const clean = parseOffers(offers);
    if (clean.some((o) => o.template !== "RESEARCH" && o.priceApt <= 0)) {
      return jsonError("Commercial and exclusive licences need a price");
    }
    data.offers = clean;
  }

  if (action === "publish") {
    if (dataset.status === "EXCLUSIVE_SOLD") return jsonError("This dataset was sold exclusively");
    const sealed = dataset.versions.find((v) => v.id === dataset.latestVersionId && v.status === "SEALED");
    if (!sealed) return jsonError("Seal a version before publishing");
    const visibility = (fields.visibility as string | undefined) ?? dataset.visibility;
    const effectiveOffers = parseOffers(data.offers ?? dataset.offers);
    const agentReads = parseReadPricing(data.readPricing ?? dataset.readPricing).enabled;
    if (visibility === "listed" && !effectiveOffers.length && !agentReads) return jsonError("Add at least one licence offer or enable pay-per-read");
    data.status = "PUBLISHED";
  } else if (action === "unpublish") {
    data.status = "DRAFT";
  } else if (action === "archive") {
    data.status = "ARCHIVED";
    data.visibility = "private";
  }

  const updated = await prisma.dataset.update({
    where: { id: dataset.id },
    data,
    include: { owner: true, versions: { include: { files: { where: { isSample: true } } } } },
  });
  if (action === "publish") await notifyFeed(updated.id, new URL(request.url).origin).catch(() => 0);
  return NextResponse.json({ dataset: publicDataset(updated) });
}
