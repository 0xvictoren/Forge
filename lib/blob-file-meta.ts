import { prisma } from "@/lib/db";
import { fileNameFromBlobRef } from "@/lib/shelby-public";
import { ensureFileExtension } from "@/lib/download-headers";

export type BlobFileMeta = {
  fileName: string;
  mimeType: string | null;
};

/**
 * Resolve the original filename + MIME for a Shelby blob ref from DB records.
 */
export async function resolveBlobFileMeta(
  ref: string,
  queryFileName?: string | null
): Promise<BlobFileMeta> {
  const asset = await prisma.asset.findFirst({
    where: { OR: [{ blobRef: ref }, { thumbnailRef: ref }] },
    select: { fileName: true, mimeType: true, title: true, thumbnailRef: true },
  });

  if (asset) {
    const isThumb = asset.thumbnailRef === ref;
    const base = isThumb
      ? queryFileName || `${asset.fileName || asset.title || "asset"}-thumb.jpg`
      : asset.fileName || queryFileName || asset.title || "asset";
    const mime = isThumb ? asset.mimeType?.startsWith("image/") ? asset.mimeType : "image/jpeg" : asset.mimeType;
    return {
      fileName: ensureFileExtension(base, mime),
      mimeType: mime,
    };
  }

  const file = await prisma.file.findFirst({
    where: { blobId: ref },
    select: { fileName: true, mimeType: true },
  });

  if (file?.fileName) {
    return {
      fileName: ensureFileExtension(file.fileName, file.mimeType),
      mimeType: file.mimeType,
    };
  }

  const profile = await prisma.user.findFirst({
    where: {
      OR: [
        { avatarRef: ref },
        { bannerRef: ref },
        { avatarCid: ref },
        { bannerCid: ref },
      ],
    },
    select: { avatarRef: true, bannerRef: true },
  });

  if (profile) {
    const isBanner = profile.bannerRef === ref;
    const base = queryFileName || (isBanner ? "banner.jpg" : "avatar.jpg");
    return {
      fileName: ensureFileExtension(base, "image/jpeg"),
      mimeType: "image/jpeg",
    };
  }

  const fromRef = fileNameFromBlobRef(ref);
  const base = queryFileName || fromRef || "download";
  return {
    fileName: ensureFileExtension(base, null),
    mimeType: null,
  };
}

/** True when the signed-in user uploaded or owns this Shelby blob. */
export async function sessionOwnsBlob(ref: string, userId: string): Promise<boolean> {
  const [asset, file, profile] = await Promise.all([
    prisma.asset.findFirst({
      where: { userId, OR: [{ blobRef: ref }, { thumbnailRef: ref }] },
      select: { id: true },
    }),
    prisma.file.findFirst({
      where: { userId, blobId: ref },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: {
        id: userId,
        OR: [
          { avatarRef: ref },
          { bannerRef: ref },
          { avatarCid: ref },
          { bannerCid: ref },
        ],
      },
      select: { id: true },
    }),
  ]);
  return !!(asset || file || profile);
}