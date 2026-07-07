import { NextRequest, NextResponse } from "next/server";
import { streamFromShelby, downloadFromShelby } from "@/lib/shelby-server";
import { isProtectedBlob, validateSignedMediaRequest } from "@/lib/burnlink-access";
import { checkAssetBlobAccess } from "@/lib/asset-access";
import { resolveBlobFileMeta, sessionOwnsBlob } from "@/lib/blob-file-meta";
import { getSessionUser } from "@/lib/auth";
import { recordLibraryActivity } from "@/lib/library-activity";
import { prisma } from "@/lib/db";
import {
  buildDownloadResponseHeaders,
  mimeFromFileName,
  sanitizeDownloadFileName,
} from "@/lib/download-headers";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Missing blob ref" }, { status: 400 });
  }

  const grantId = request.nextUrl.searchParams.get("g");
  const wallet = request.nextUrl.searchParams.get("w");
  const sig = request.nextUrl.searchParams.get("sig");
  const expRaw = request.nextUrl.searchParams.get("exp");

  const session = await getSessionUser();
  const ownerPreview = session ? await sessionOwnsBlob(ref, session.id) : false;

  if (!ownerPreview) {
    const protectedBlob = await isProtectedBlob(ref);

    if (protectedBlob) {
      if (!grantId || !wallet || !sig || !expRaw) {
        return NextResponse.json({ error: "Signed access required" }, { status: 403 });
      }

      const exp = Number(expRaw);
      if (!Number.isFinite(exp)) {
        return NextResponse.json({ error: "Invalid expiry" }, { status: 400 });
      }

      const validated = await validateSignedMediaRequest({
        ref,
        grantId,
        wallet,
        exp,
        sig,
      });

      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: validated.status });
      }
    } else {
      const assetCheck = await checkAssetBlobAccess(ref);
      if (!assetCheck.ok) {
        if (assetCheck.error && assetCheck.error !== "Not an asset blob") {
          return NextResponse.json({ error: assetCheck.error }, { status: assetCheck.status });
        }
      }
    }
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const queryFileName = request.nextUrl.searchParams.get("filename");

  try {
    const meta = await resolveBlobFileMeta(ref, queryFileName);
    const fileName = sanitizeDownloadFileName(meta.fileName);
    const mimeType = meta.mimeType || mimeFromFileName(fileName);

    // Downloads: buffer the full blob so browsers get correct bytes + filename (avoids shelby.json artifacts)
    if (download) {
      const blob = await downloadFromShelby(ref);
      const finalName = sanitizeDownloadFileName(
        queryFileName && queryFileName.includes(".") ? queryFileName : meta.fileName || blob.fileName
      );
      const finalMime = meta.mimeType || blob.mimeType || mimeFromFileName(finalName);

      if (session) {
        const asset = await prisma.asset.findFirst({
          where: { blobRef: ref },
          select: { id: true, title: true },
        });
        if (asset) {
          await recordLibraryActivity({
            userId: session.id,
            type: "DOWNLOAD",
            title: asset.title,
            assetId: asset.id,
          });
        }
      }

      return new NextResponse(new Uint8Array(blob.data), {
        headers: buildDownloadResponseHeaders(finalName, finalMime, true),
      });
    }

    const stream = await streamFromShelby(ref);
    return new NextResponse(stream, {
      headers: buildDownloadResponseHeaders(fileName, mimeType, false),
    });
  } catch (error) {
    console.error("Shelby download error:", error);
    return NextResponse.json({ error: "Failed to load file from Shelby" }, { status: 404 });
  }
}