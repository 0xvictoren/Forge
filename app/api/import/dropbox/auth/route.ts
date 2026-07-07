import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDropboxAuthUrl, setOAuthState } from "@/lib/import-oauth";
import { randomBytes } from "crypto";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = randomBytes(16).toString("hex");
    await setOAuthState(state, "dropbox");
    const url = getDropboxAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dropbox OAuth not configured" },
      { status: 500 }
    );
  }
}