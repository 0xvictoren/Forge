const PRODUCTION_APP_URL = "https://forge-alpha-blush.vercel.app";

/** Canonical app origin for OAuth callbacks, share links, etc. */
export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_URL;
  }

  return "http://localhost:3000";
}

export function getGoogleOAuthCallbackUrl(): string {
  const override = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/+$/, "");
  return `${getAppUrl()}/api/import/google/callback`;
}