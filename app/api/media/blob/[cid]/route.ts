import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getShelbyPublicUrl } from "@/lib/shelby";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;
  const decoded = decodeURIComponent(cid);

  if (decoded.startsWith("dev-")) {
    const file = await prisma.file.findFirst({
      where: { blobId: decoded },
    });
    if (file?.dataBase64) {
      const buffer = Buffer.from(file.dataBase64, "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Length": String(buffer.length),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
    return NextResponse.json({ error: "Blob not found locally" }, { status: 404 });
  }

  const url = getShelbyPublicUrl(decoded);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Media not found on Shelby" }, { status: 404 });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch from Shelby" }, { status: 502 });
  }
}
