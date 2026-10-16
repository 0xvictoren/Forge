import { prisma } from "@/lib/db";
import { inferAssetType } from "./constants";

/** Stub AI pipeline - extracts basic metadata from file info. */
export async function processAssetMetadata(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return null;

  const assetType = inferAssetType(asset.mimeType, asset.fileName);
  const keywords = [
    ...asset.tags,
    asset.category,
    assetType.toLowerCase(),
    asset.fileName?.split(".").pop()?.toLowerCase(),
  ].filter(Boolean) as string[];

  const summary =
    asset.description ||
    `${asset.title}, ${assetType} digital asset on Forge.`;

  const suggestedCategory =
    asset.category ||
    (assetType === "CODE"
      ? "code"
      : assetType === "PDF"
        ? "research"
        : assetType === "TEMPLATE"
          ? "templates"
          : "all");

  return prisma.assetMetadata.upsert({
    where: { assetId },
    create: {
      assetId,
      summary,
      keywords: [...new Set(keywords)],
      suggestedCategory,
      processingStatus: "complete",
    },
    update: {
      summary,
      keywords: [...new Set(keywords)],
      suggestedCategory,
      processingStatus: "complete",
    },
  });
}
