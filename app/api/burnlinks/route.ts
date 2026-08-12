import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { PLATFORM_FEE_BPS } from "@/lib/constants";
import { normalizeAptosAddress, parseWalletList } from "@/lib/wallet-access";
import { createAssetFromBurnLink } from "@/lib/v2/assets";
import { encryptionFieldsForDb, type EncryptionMaterial } from "@/lib/encryption";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let blobRef: string | undefined;
    let priceApt = 0;
    let burnAfterRead = false;
    let screenshotProtected = false;
    let maxViews: number | null = null;
    let title = "BurnLink";

    let expiresAt: Date | null = null;
    let storageTxHash: string | undefined;
    let uploadTxHash: string | undefined;
    let fileMime = "application/octet-stream";
    let fileSize = 0;
    let walletGated = false;
    let allowedWallets: string[] = [];
    let thumbnailRef: string | undefined;
    let encryption: EncryptionMaterial | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      blobRef =
        body.blobRef ||
        (Array.isArray(body.blobRefs) && body.blobRefs.length > 0
          ? body.blobRefs[0]
          : undefined);
      priceApt = Number(body.priceApt || 0);
      burnAfterRead = !!body.burnAfterRead;
      screenshotProtected = !!body.screenshotProtected;
      maxViews = body.maxViews != null ? Number(body.maxViews) : null;
      title = body.fileName || body.title || title;
      fileMime = body.fileMime || body.mimeType || fileMime;
      fileSize = Number(body.fileSize || body.size || 0);
      expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      storageTxHash = body.storageTxHash || body.aptosTxHash;
      uploadTxHash = body.uploadTxHash || body.shelbyTxHash;
      walletGated = !!body.walletGated;
      if (Array.isArray(body.allowedWallets)) {
        allowedWallets = (body.allowedWallets as string[])
          .map(String)
          .map((w: string) => normalizeAptosAddress(w));
      } else if (typeof body.allowedWallets === "string") {
        allowedWallets = parseWalletList(body.allowedWallets);
      }
      thumbnailRef = body.thumbnailRef || undefined;

      // Client-side encryption package (wrapped keys only — never raw content key)
      if (body.encryption?.isEncrypted) {
        encryption = {
          isEncrypted: true,
          encryptionVersion: Number(body.encryption.encryptionVersion || 1) as 1,
          mimeType: body.encryption.mimeType || fileMime,
          plaintextSize: Number(body.encryption.plaintextSize || fileSize),
          wrappedKeyOwner: String(body.encryption.wrappedKeyOwner || ""),
          wrappedKeyShare: String(body.encryption.wrappedKeyShare || ""),
          encryptionShareKey: String(body.encryption.encryptionShareKey || ""),
        };
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
        fileMime = encryption.mimeType;
        fileSize = encryption.plaintextSize || fileSize;
      }
    } else {
      return NextResponse.json(
        {
          error:
            "Upload to Shelby with your connected wallet first, then POST JSON with blobRef.",
        },
        { status: 400 }
      );
    }

    if (walletGated && allowedWallets.length === 0) {
      return NextResponse.json(
        { error: "Add at least one wallet when whitelist is enabled" },
        { status: 400 }
      );
    }

    if (!blobRef) {
      return NextResponse.json({ error: "Shelby blob reference required" }, { status: 400 });
    }

    const encFields = encryptionFieldsForDb(encryption);

    const fileRecord = await prisma.file.create({
      data: {
        userId: user.id,
        blobId: blobRef,
        fileName: title,
        mimeType: fileMime,
        fileSize: fileSize,
        isEncrypted: encFields.isEncrypted,
        encryptionVersion: encFields.encryptionVersion ?? undefined,
        wrappedKeyOwner: encFields.wrappedKeyOwner ?? undefined,
        wrappedKeyShare: encFields.wrappedKeyShare ?? undefined,
        encryptionShareKey: encFields.encryptionShareKey ?? undefined,
      },
    });

    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.burnLink.findUnique({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const burnLink = await prisma.burnLink.create({
      data: {
        slug,
        userId: user.id,
        fileId: fileRecord.id,
        title,
        priceApt,
        burnAfterRead,
        screenshotProtected,
        maxViews,
        expiresAt,
        storageTxHash,
        uploadTxHash,
        walletGated,
        allowedWallets,
        thumbnailRef,
      },
    });

    try {
      await createAssetFromBurnLink(burnLink.id);
    } catch (e) {
      console.error("Asset index failed:", e);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      slug: burnLink.slug,
      id: burnLink.id,
      shareUrl: `${appUrl}/b/${burnLink.slug}`,
      feeBps: PLATFORM_FEE_BPS,
    });
  } catch (error) {
    console.error("BurnLink create:", error);
    return NextResponse.json({ error: "Failed to create BurnLink" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const burnLink = await prisma.burnLink.findUnique({
    where: { slug },
    include: {
      file: true,
      owner: {
        select: {
          displayName: true,
          username: true,
          avatarUrl: true,
          walletAddress: true,
          creatorProfile: { select: { handle: true } },
        },
      },
    },
  });

  if (!burnLink) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never expose key material on public BurnLink metadata
  const { file, ...rest } = burnLink;
  const safeFile = file
    ? {
        id: file.id,
        blobId: file.blobId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        isEncrypted: file.isEncrypted,
        encryptionVersion: file.encryptionVersion,
        createdAt: file.createdAt,
        userId: file.userId,
      }
    : null;

  return NextResponse.json({
    burnLink: { ...rest, file: safeFile },
  });
}
