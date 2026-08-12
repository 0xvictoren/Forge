import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordLibraryActivity } from "@/lib/library-activity";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          walletAddress: true,
          address: true,
          creatorProfile: {
            select: { handle: true, reputationLevel: true, reputationScore: true },
          },
        },
      },
      metadata: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.asset.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });

  // Strip key material — use /decrypt-package after access check
  const {
    encryptionShareKey: _s,
    wrappedKeyOwner: _o,
    wrappedKeyShare: _w,
    ...safeAsset
  } = asset;

  return NextResponse.json({ asset: safeAsset });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updateData: any = {};

  if (typeof body.isListed === "boolean") updateData.isListed = body.isListed;
  if (body.visibility) updateData.visibility = body.visibility;
  if (typeof body.priceApt === "number") updateData.priceApt = body.priceApt;
  if (body.title) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.streamVisibility) updateData.streamVisibility = body.streamVisibility;
  if (typeof body.streamPriceApt === "number") updateData.streamPriceApt = body.streamPriceApt;
  if (typeof body.isStream === "boolean") updateData.isStream = body.isStream;

  const updated = await prisma.asset.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ asset: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete from storage (Shelby blob or S3 for streams)
  if (asset.blobRef) {
    try {
      if (asset.blobRef.startsWith("http")) {
        // S3 / CDN stream video
        const { deleteFromS3 } = await import("@/lib/s3");
        await deleteFromS3(asset.blobRef);
      } else {
        const { deleteFromShelby } = await import("@/lib/shelby-server");
        await deleteFromShelby(asset.blobRef);
      }
    } catch (e) {
      console.error("Failed to delete blob from storage:", e);
      // Continue to delete DB record anyway
    }
  }

  await recordLibraryActivity({
    userId: user.id,
    type: "DELETE",
    title: asset.title,
    assetId: asset.id,
  });

  await prisma.asset.delete({ where: { id } });
  revalidatePath("/library");

  return NextResponse.json({ success: true });
}
