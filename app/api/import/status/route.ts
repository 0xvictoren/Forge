import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOAuthTokens, getGoogleRedirectUri, isGoogleOAuthConfigured } from "@/lib/import-oauth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const google = await getOAuthTokens("google");

  return NextResponse.json({
    google: !!google,
    googleConfigured: isGoogleOAuthConfigured(),
    googleRedirectUri: isGoogleOAuthConfigured() ? getGoogleRedirectUri() : null,
  });
}