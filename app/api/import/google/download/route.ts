import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { downloadGoogleDriveFile, getValidAccessToken } from "@/lib/import-oauth";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getValidAccessToken("google");
  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to Google Drive" }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  const mimeType = request.nextUrl.searchParams.get("mimeType");
  if (!fileId || !mimeType) {
    return NextResponse.json({ error: "fileId and mimeType required" }, { status: 400 });
  }

  try {
    const { buffer, fileName, mimeType: outMime } = await downloadGoogleDriveFile(
      accessToken,
      fileId,
      mimeType
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": outMime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "X-File-Name": encodeURIComponent(fileName),
        "X-File-Size": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("Google download error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Download failed" },
      { status: 500 }
    );
  }
}