const PRODUCTION_APP_URL = "https://forge-alpha-blush.vercel.app";

export const GOOGLE_OAUTH_CALLBACK_PRODUCTION =
  "https://forge-alpha-blush.vercel.app/api/import/google/callback";

/** Canonical app origin for OAuth callbacks, share links, etc. */
export function getAppUrl(): string {
  if (process.env.VERCEL === "1") {
    const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
    return PRODUCTION_APP_URL;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv && !fromEnv.includes("localhost")) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_URL;
  }

  return fromEnv?.replace(/\/+$/, "") || "http://localhost:3000";
}

/** Google OAuth redirect — must match Google Cloud Console exactly. */
export function getGoogleOAuthCallbackUrl(): string {
  const override = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/+$/, "");

  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return GOOGLE_OAUTH_CALLBACK_PRODUCTION;
  }

  return `${getAppUrl()}/api/import/google/callback`;
}