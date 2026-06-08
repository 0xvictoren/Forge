import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToShelby } from "@/lib/shelby-server";
import { generateSlug } from "@/lib/utils";
import { PLATFORM_FEE_BPS } from "@/lib/constants";

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
    } else {
      const form = await request.formData();
      const file = form.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "File required" }, { status: 400 });
      }
      const upload = await uploadToShelby(file, file.name);
      blobRef = upload.cid;
      fileMime = upload.mimeType || file.type || fileMime;
      fileSize = upload.size || file.size;
      priceApt = Number(form.get("priceApt") || 0);
      burnAfterRead = form.get("burnAfterRead") === "true";
      screenshotProtected = form.get("screenshotProtected") === "true";
      const maxViewsRaw = form.get("maxViews") as string | null;
      maxViews = maxViewsRaw ? Number(maxViewsRaw) : null;
      title = file.name;
    }

    if (!blobRef) {
      return NextResponse.json({ error: "Shelby blob reference required" }, { status: 400 });
    }

    const fileRecord = await prisma.file.create({
      data: {
        userId: user.id,
        blobId: blobRef,
        fileName: title,
        mimeType: fileMime,
        fileSize: fileSize,
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
      },
    });

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

  return NextResponse.json({ burnLink });
}
