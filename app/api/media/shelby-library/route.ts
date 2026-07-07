import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildShelbyMediaUrl, parseBlobRef, fileNameFromBlobRef } from "@/lib/shelby-public";
import { ensureFileExtension } from "@/lib/download-headers";

export type ShelbyLibraryImage = {
  blobRef: string;
  url: string;
  label: string;
  fileName: string;
  source: "asset" | "burnlink" | "profile";
  mimeType?: string | null;
};

function isImageMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

function resolveFileName(
  blobRef: string,
  label: string,
  mimeType?: string | null,
  explicit?: string | null
): string {
  const fromRef = fileNameFromBlobRef(blobRef);
  const base = explicit || fromRef || label;
  return ensureFileExtension(base, mimeType?.startsWith("image/") ? mimeType : "image/jpeg");
}

function addImage(
  map: Map<string, ShelbyLibraryImage>,
  blobRef: string | null | undefined,
  label: string,
  source: ShelbyLibraryImage["source"],
  mimeType?: string | null,
  explicitFileName?: string | null
) {
  if (!blobRef || !parseBlobRef(blobRef)) return;
  if (map.has(blobRef)) return;
  const fileName = resolveFileName(blobRef, label, mimeType, explicitFileName);
  map.set(blobRef, {
    blobRef,
    fileName,
    url: buildShelbyMediaUrl(blobRef, fileName),
    label,
    source,
    mimeType,
  });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [assets, burnLinks, profile] = await Promise.all([
    prisma.asset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        title: true,
        fileName: true,
        blobRef: true,
        thumbnailRef: true,
        mimeType: true,
        assetType: true,
      },
    }),
    prisma.burnLink.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        file: { select: { blobId: true, fileName: true, mimeType: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarRef: true, bannerRef: true, avatarCid: true, bannerCid: true },
    }),
  ]);

  const images = new Map<string, ShelbyLibraryImage>();

  for (const asset of assets) {
    const label = asset.fileName || asset.title || "Asset";
    if (isImageMime(asset.mimeType) || asset.assetType === "IMAGE") {
      addImage(images, asset.blobRef, label, "asset", asset.mimeType, asset.fileName);
    }
    if (asset.thumbnailRef) {
      addImage(
        images,
        asset.thumbnailRef,
        label,
        "asset",
        "image/jpeg",
        `${asset.fileName || asset.title || "thumb"}.jpg`
      );
    }
  }

  for (const link of burnLinks) {
    const file = link.file;
    if (!file || !isImageMime(file.mimeType)) continue;
    addImage(
      images,
      file.blobId,
      file.fileName || link.title || "BurnLink",
      "burnlink",
      file.mimeType,
      file.fileName
    );
  }

  if (profile) {
    const avatar = profile.avatarRef || profile.avatarCid;
    const banner = profile.bannerRef || profile.bannerCid;
    if (avatar) addImage(images, avatar, "Avatar", "profile", "image/jpeg", "avatar.jpg");
    if (banner) addImage(images, banner, "Banner", "profile", "image/jpeg", "banner.jpg");
  }

  return NextResponse.json({
    images: Array.from(images.values()),
  });
}