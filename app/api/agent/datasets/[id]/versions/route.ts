import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError } from "@/lib/datasets/api";
import { parseReadPricing } from "@/lib/agents/pricing";

/** Sealed versions newer than ?since=N: poll this, or subscribe to webhooks. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
  const dataset = await prisma.dataset.findFirst({
    where: isObjectId(id) ? { id } : { slug: id },
    include: { versions: { where: { status: "SEALED", versionNumber: { gt: since } }, orderBy: { versionNumber: "asc" } } },
  });
  if (!dataset || dataset.visibility !== "listed" || dataset.status !== "PUBLISHED" || !parseReadPricing(dataset.readPricing).enabled) {
    return jsonError("Dataset is not available to agents", 404);
  }
  return NextResponse.json(
    {
      dataset: { id: dataset.id, slug: dataset.slug, title: dataset.title },
      versions: dataset.versions.map((v) => ({
        id: v.id,
        number: v.versionNumber,
        changelog: v.changelog,
        sealHash: v.sealHash,
        anchorTxHash: v.anchorTxHash,
        sealedAt: v.sealedAt,
        fileCount: v.fileCount,
        totalBytes: v.totalBytes,
        proof: `${url.origin}/api/datasets/proof/${v.id}`,
      })),
      latest: dataset.versions.at(-1)?.versionNumber ?? since,
    },
    { headers: { "Cache-Control": "public, max-age=30" } }
  );
}
