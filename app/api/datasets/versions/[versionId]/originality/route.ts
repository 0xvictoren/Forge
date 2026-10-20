import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, NO_STORE, rateLimited, requireUser } from "@/lib/datasets/api";
import { originalityConfigured, originalityRequired, scoreWithService } from "@/lib/datasets/originality";

const gray = z.array(z.number().int().min(0).max(255)).length(1024);
const fileSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  path: z.string().max(512),
  sizeBytes: z.number().min(0),
  mime: z.string().max(200).default(""),
  kind: z.enum(["text", "image", "video", "binary"]),
  text: z.string().max(700_000).optional(),
  gray32: gray.optional(),
  frames: z.array(gray).max(8).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  hasCameraMetadata: z.boolean().optional(),
});
const bodySchema = z.object({ files: z.array(fileSchema).min(1).max(300) });

/**
 * Score a batch of files before they are encrypted and stored. The samples
 * are passed to the originality service and dropped; only fingerprints stay.
 */
export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`originality:${auth.user.id}`, 60);
  if (limited) return limited;
  const { versionId } = await params;
  if (!isObjectId(versionId)) return jsonError("Version not found", 404);

  const version = await prisma.datasetVersion.findUnique({ where: { id: versionId }, include: { dataset: true } });
  if (!version || version.dataset.ownerId !== auth.user.id) return jsonError("Version not found", 404);
  if (version.status !== "DRAFT") return jsonError("Sealed versions cannot change. Start a new version.");

  if (!originalityConfigured()) {
    if (originalityRequired()) return jsonError("The originality check is not available right now. Try again in a few minutes.", 503);
    return NextResponse.json({ skipped: true }, { headers: NO_STORE });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid files");

  const d = version.dataset;
  let report;
  try {
    report = await scoreWithService({
      datasetId: d.id,
      versionId,
      ownerId: auth.user.id,
      meta: { title: d.title, description: [d.tagline, d.description].filter(Boolean).join("\n"), tags: d.tags, modality: d.modality },
      files: parsed.data.files,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "The originality check failed", 502);
  }

  // Name matching datasets only when they are public listings.
  const ids = report.matches.map((m) => m.datasetId).filter(isObjectId);
  const listed = ids.length
    ? await prisma.dataset.findMany({ where: { id: { in: ids }, visibility: "listed", status: "PUBLISHED" }, select: { id: true, title: true, slug: true } })
    : [];
  const byId = new Map(listed.map((l) => [l.id, l]));
  report.matches = report.matches.map((m) => ({ share: m.share, datasetId: byId.has(m.datasetId) ? m.datasetId : "", title: byId.get(m.datasetId)?.title, slug: byId.get(m.datasetId)?.slug }));

  await prisma.originalityCheck.create({
    data: {
      versionId,
      datasetId: d.id,
      ownerId: auth.user.id,
      score: report.score,
      passed: report.passed,
      shas: report.checkedShas.map((s) => s.toLowerCase()),
      bytes: parsed.data.files.reduce((s, f) => s + f.sizeBytes, 0),
      report,
    },
  });

  return NextResponse.json({ report }, { headers: NO_STORE });
}
