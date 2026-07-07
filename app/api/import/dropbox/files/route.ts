import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getValidAccessToken, listDropboxFiles } from "@/lib/import-oauth";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getValidAccessToken("dropbox");
  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to Dropbox" }, { status: 401 });
  }

  const folderPath = request.nextUrl.searchParams.get("path") || "";

  try {
    const files = await listDropboxFiles(accessToken, folderPath);
    return NextResponse.json({ files, provider: "dropbox", path: folderPath });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list files" },
      { status: 500 }
    );
  }
}