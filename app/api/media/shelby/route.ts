import { NextRequest, NextResponse } from "next/server";
import { streamFromShelby } from "@/lib/shelby-server";
import { fileNameFromBlobRef } from "@/lib/shelby-public";

function mimeFromFileName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    pdf: "application/pdf",
    zip: "application/zip",
    html: "text/html",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Missing blob ref" }, { status: 400 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const fileName =
    request.nextUrl.searchParams.get("filename") ||
    fileNameFromBlobRef(ref) ||
    "download";

  try {
    const stream = await streamFromShelby(ref);
    const safeName = fileName.replace(/[^\w.\-() ]/g, "_");
    const disposition = download
      ? `attachment; filename="${safeName}"`
      : `inline; filename="${safeName}"`;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": mimeFromFileName(safeName),
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Shelby download error:", error);
    return NextResponse.json({ error: "Failed to load file from Shelby" }, { status: 404 });
  }
}
