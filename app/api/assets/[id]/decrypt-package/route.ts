import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUserAccessAsset } from "@/lib/asset-access";
import { toAuthorizedKeyPackage } from "@/lib/encryption";
import { buildShelbyMediaUrl } from "@/lib/shelby-public";

/**
 * Returns ciphertext stream URL + key material for authorized users only.
 * Share secret is included so the browser can unwrap the content key client-side.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await canUserAccessAsset(user.id, {
    id: asset.id,
    userId: asset.userId,
    priceApt: asset.priceApt,
    visibility: asset.visibility,
    blobRef: asset.blobRef,
  });

  if (!access.canAccess) {
    return NextResponse.json(
      { error: "Purchase or unlock required to decrypt this asset" },
      { status: 403 }
    );
  }

  if (!asset.isEncrypted) {
    return NextResponse.json({
      isEncrypted: false,
      streamUrl: buildShelbyMediaUrl(asset.blobRef, asset.fileName),
      fileName: asset.fileName || asset.title,
      mimeType: asset.mimeType,
    });
  }

  const isOwner = asset.userId === user.id;
  const encryption = toAuthorizedKeyPackage(
    {
      isEncrypted: asset.isEncrypted,
      encryptionVersion: asset.encryptionVersion,
      wrappedKeyOwner: asset.wrappedKeyOwner,
      wrappedKeyShare: asset.wrappedKeyShare,
      encryptionShareKey: asset.encryptionShareKey,
      mimeType: asset.mimeType,
      fileName: asset.fileName || asset.title,
    },
    { includeOwnerWrap: isOwner }
  );

  return NextResponse.json({
    isEncrypted: true,
    streamUrl: `/api/media/shelby?ref=${encodeURIComponent(asset.blobRef)}&filename=${encodeURIComponent(asset.fileName || asset.title || "file.enc")}`,
    fileName: asset.fileName || asset.title,
    mimeType: asset.mimeType,
    encryption,
    asOwner: isOwner,
  });
}
