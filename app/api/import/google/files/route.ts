import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getValidAccessToken, listGoogleDriveFiles } from "@/lib/import-oauth";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getValidAccessToken("google");
  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to Google Drive" }, { status: 401 });
  }

  const folderId = request.nextUrl.searchParams.get("folderId") || undefined;

  try {
    const files = await listGoogleDriveFiles(accessToken, folderId);
    return NextResponse.json({ files, provider: "google" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list files" },
      { status: 500 }
    );
  }
}