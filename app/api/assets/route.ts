import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAsset } from "@/lib/v2/assets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const mine = searchParams.get("mine") === "1";

  const session = await getSessionUser();

  const where: Record<string, unknown> = {
    status: "published",
    visibility: "public",
  };

  if (mine && session) {
    delete where.visibility;
    where.userId = session.id;
  } else if (userId) {
    where.userId = userId;
  }

  const assets = await prisma.asset.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          creatorProfile: { select: { handle: true, reputationLevel: true } },
        },
      },
      metadata: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Strip key material from list responses
  const safeAssets = assets.map((a) => {
    const {
      encryptionShareKey: _s,
      wrappedKeyOwner: _o,
      wrappedKeyShare: _w,
      ...rest
    } = a;
    return rest;
  });

  return NextResponse.json({ assets: safeAssets });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.blobRef || !body.title) {
      return NextResponse.json({ error: "blobRef and title required" }, { status: 400 });
    }

    const encryption = body.encryption?.isEncrypted
      ? {
          isEncrypted: true as const,
          encryptionVersion: Number(body.encryption.encryptionVersion || 1),
          wrappedKeyOwner: body.encryption.wrappedKeyOwner as string,
          wrappedKeyShare: body.encryption.wrappedKeyShare as string,
          encryptionShareKey: body.encryption.encryptionShareKey as string,
          mimeType: body.encryption.mimeType as string | undefined,
          plaintextSize: body.encryption.plaintextSize as number | undefined,
        }
      : null;

    if (encryption) {
      if (
        !encryption.wrappedKeyOwner ||
        !encryption.wrappedKeyShare ||
        !encryption.encryptionShareKey
      ) {
        return NextResponse.json(
          { error: "Incomplete encryption material" },
          { status: 400 }
        );
      }
    }

    const asset = await createAsset({
      userId: user.id,
      title: body.title,
      description: body.description,
      blobRef: body.blobRef,
      fileName: body.fileName,
      mimeType: encryption?.mimeType || body.mimeType || body.fileMime,
      fileSize: encryption?.plaintextSize ?? body.fileSize,
      category: body.category,
      priceApt: Number(body.priceApt || 0),
      visibility: body.visibility || "public",
      tags: body.tags,
      thumbnailRef: body.thumbnailRef,
      assetType: body.assetType,
      isListed: body.isListed ?? false,
      isStream: body.isStream ?? false,
      streamVisibility: body.streamVisibility || body.streamVisibility || "everyone",
      streamPriceApt: Number(body.streamPriceApt || 0),
      isEncrypted: !!encryption,
      encryptionVersion: encryption?.encryptionVersion,
      wrappedKeyOwner: encryption?.wrappedKeyOwner,
      wrappedKeyShare: encryption?.wrappedKeyShare,
      encryptionShareKey: encryption?.encryptionShareKey,
    });

    // Never echo share key back on create responses used by public clients
    const { encryptionShareKey: _omit, ...safeAsset } = asset as typeof asset & {
      encryptionShareKey?: string | null;
    };

    return NextResponse.json({
      asset: {
        ...safeAsset,
        isEncrypted: asset.isEncrypted,
        // Owner still needs their wrap for local re-decrypt; share key stays server-side only here
        hasEncryption: asset.isEncrypted,
      },
    });
  } catch (error: any) {
    console.error("Failed to create asset:", error);
    return NextResponse.json(
      { 
        error: "Failed to publish asset", 
        details: error?.message || "Internal server error during asset creation or metadata processing." 
      }, 
      { status: 500 }
    );
  }
}
