import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  storeOAuthTokens,
  verifyOAuthState,
  getAppUrl,
} from "@/lib/import-oauth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  const redirectBase = `${getAppUrl()}/upload`;

  if (error) {
    return NextResponse.redirect(`${redirectBase}?import_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?import_error=missing_params`);
  }

  const verified = await verifyOAuthState(state);
  if (!verified.ok || verified.provider !== "google") {
    return NextResponse.redirect(`${redirectBase}?import_error=invalid_state`);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    await storeOAuthTokens("google", tokens);
    return NextResponse.redirect(`${redirectBase}?import_connected=google`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(`${redirectBase}?import_error=${encodeURIComponent(msg)}`);
  }
}