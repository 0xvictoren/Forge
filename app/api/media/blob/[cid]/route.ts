import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;
  const decoded = decodeURIComponent(cid);
  const session = await getSessionUser();

  // This legacy endpoint exists only for database-backed development blobs.
  // Shelby media must use /api/media/shelby, which enforces asset/grant access.
  if (!decoded.startsWith("dev-")) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await prisma.file.findFirst({
    where: { blobId: decoded, userId: session.id },
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
