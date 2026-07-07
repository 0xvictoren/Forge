import { prisma } from "@/lib/db";
import { inferAssetType } from "./constants";
import { processAssetMetadata } from "./asset-metadata";

export async function createAssetFromBurnLink(burnLinkId: string) {
  const burnLink = await prisma.burnLink.findUnique({
    where: { id: burnLinkId },
    include: { file: true },
  });
  if (!burnLink) return null;

  const existing = await prisma.asset.findFirst({
    where: { burnLinkId },
  });
  if (existing) return existing;

  const asset = await prisma.asset.create({
    data: {
      userId: burnLink.userId,
      title: burnLink.title || burnLink.file.fileName,
      blobRef: burnLink.file.blobId,
      fileName: burnLink.file.fileName,
      mimeType: burnLink.file.mimeType,
      fileSize: burnLink.file.fileSize,
      priceApt: burnLink.priceApt,
      assetType: inferAssetType(burnLink.file.mimeType, burnLink.file.fileName),
      visibility: "public",
      thumbnailRef: burnLink.thumbnailRef ?? undefined,
      isListed: !burnLink.walletGated,
      burnLinkId: burnLink.id,
      tags: burnLink.walletGated ? ["whitelist", "burnlink"] : ["burnlink"],
    },
  });

  await processAssetMetadata(asset.id);
  return asset;
}

export async function createAsset(input: {
  userId: string;
  title: string;
  description?: string;
  blobRef: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  category?: string;
  priceApt?: number;
  visibility?: string;
  tags?: string[];
  thumbnailRef?: string;
  assetType?: string;
  isListed?: boolean;
  isStream?: boolean;
  streamVisibility?: string;
  streamPriceApt?: number;
}) {
  const asset = await prisma.asset.create({
    data: {
      userId: input.userId,
      title: input.title,
      description: input.description,
      blobRef: input.blobRef,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      category: input.category,
      priceApt: input.priceApt ?? 0,
      visibility: input.visibility ?? "public",
      assetType: input.assetType || inferAssetType(input.mimeType, input.fileName),
      tags: input.tags ?? [],
      thumbnailRef: input.thumbnailRef,
      isListed: input.isListed ?? false,
      isStream: input.isStream ?? false,
      streamVisibility: input.streamVisibility ?? "everyone",
      streamPriceApt: input.streamPriceApt ?? 0,
      // Note: burnLinkId is intentionally omitted here.
      // It is only set via createAssetFromBurnLink (which has its own existence check).
      // The @unique was removed from the schema because it prevented multiple
      // "normal" assets (including all Stream videos) from being created
      // (Mongo unique on optional field only allows one null).
    },
  });

  await processAssetMetadata(asset.id);
  return asset;
}
