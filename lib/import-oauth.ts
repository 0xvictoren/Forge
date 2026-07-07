import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAppUrl, getGoogleOAuthCallbackUrl } from "@/lib/app-url";

export { getAppUrl } from "@/lib/app-url";

export type OAuthProvider = "google" | "dropbox";

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  provider: OAuthProvider;
};

const COOKIE_PREFIX = "forge_oauth_";
const STATE_COOKIE = "forge_oauth_state";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function isGoogleOAuthConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return !!(id && secret);
}

export function getGoogleRedirectUri(): string {
  return getGoogleOAuthCallbackUrl();
}

export async function setOAuthState(state: string, provider: OAuthProvider) {
  const cookieStore = await cookies();
  const token = await new SignJWT({ state, provider })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(getSecret());
  cookieStore.set(STATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
}

export async function verifyOAuthState(
  state: string
): Promise<{ ok: true; provider: OAuthProvider } | { ok: false }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(STATE_COOKIE)?.value;
  if (!raw) return { ok: false };
  try {
    const { payload } = await jwtVerify(raw, getSecret());
    if (payload.state !== state) return { ok: false };
    cookieStore.delete(STATE_COOKIE);
    return { ok: true, provider: payload.provider as OAuthProvider };
  } catch {
    return { ok: false };
  }
}

export async function storeOAuthTokens(provider: OAuthProvider, tokens: Omit<OAuthTokens, "provider">) {
  const cookieStore = await cookies();
  const token = await new SignJWT({ ...tokens, provider })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getSecret());
  cookieStore.set(`${COOKIE_PREFIX}${provider}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 3600,
    path: "/",
  });
}

export async function getOAuthTokens(provider: OAuthProvider): Promise<OAuthTokens | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(`${COOKIE_PREFIX}${provider}`)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, getSecret());
    return payload as unknown as OAuthTokens;
  } catch {
    return null;
  }
}

export async function clearOAuthTokens(provider: OAuthProvider) {
  const cookieStore = await cookies();
  cookieStore.delete(`${COOKIE_PREFIX}${provider}`);
}

/* ─── Google Drive ─────────────────────────────────────────────────────────── */

export function getGoogleAuthUrl(state: string): string {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();

  const redirectUri = getGoogleRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token exchange failed");
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export async function refreshGoogleToken(refreshToken: string) {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Google refresh failed");
  return {
    accessToken: data.access_token as string,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export type CloudFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  isFolder: boolean;
  modifiedAt?: string;
};

export async function listGoogleDriveFiles(
  accessToken: string,
  folderId?: string
): Promise<CloudFile[]> {
  const q = folderId
    ? `'${folderId}' in parents and trashed=false`
    : "trashed=false and 'root' in parents";

  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,size,modifiedTime)",
    pageSize: "50",
    orderBy: "folder,name",
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Failed to list Google Drive files");

  return (data.files || []).map((f: Record<string, string>) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : undefined,
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    modifiedAt: f.modifiedTime,
  }));
}

export async function downloadGoogleDriveFile(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  let url: string;
  let outMime = mimeType;
  let fileName = "download";

  if (mimeType.startsWith("application/vnd.google-apps.")) {
    const exportMap: Record<string, { mime: string; ext: string }> = {
      "application/vnd.google-apps.document": { mime: "application/pdf", ext: ".pdf" },
      "application/vnd.google-apps.spreadsheet": {
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ext: ".xlsx",
      },
      "application/vnd.google-apps.presentation": {
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ext: ".pptx",
      },
    };
    const exp = exportMap[mimeType];
    if (!exp) throw new Error("Unsupported Google Workspace file type");
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exp.mime)}`;
    outMime = exp.mime;
    fileName = `export${exp.ext}`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (meta.name) fileName = meta.name;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("Failed to download from Google Drive");
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, fileName, mimeType: outMime };
}

/* ─── Dropbox ──────────────────────────────────────────────────────────────── */

export function getDropboxAuthUrl(state: string): string {
  const appKey = process.env.DROPBOX_APP_KEY;
  if (!appKey) throw new Error("DROPBOX_APP_KEY not configured");

  const redirectUri = `${getAppUrl()}/api/import/dropbox/callback`;
  const params = new URLSearchParams({
    client_id: appKey,
    redirect_uri: redirectUri,
    response_type: "code",
    token_access_type: "offline",
    state,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params}`;
}

export async function exchangeDropboxCode(code: string) {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) throw new Error("Dropbox OAuth not configured");

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: `${getAppUrl()}/api/import/dropbox/callback`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Dropbox token exchange failed");
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export async function listDropboxFiles(
  accessToken: string,
  folderPath = ""
): Promise<CloudFile[]> {
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: folderPath || "",
      limit: 50,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_summary || "Failed to list Dropbox files");

  return (data.entries || []).map((e: Record<string, unknown>) => ({
    id: (e.path_lower as string) || (e.id as string),
    name: e.name as string,
    mimeType: e[".tag"] === "folder" ? "application/folder" : "application/octet-stream",
    size: typeof e.size === "number" ? e.size : undefined,
    isFolder: e[".tag"] === "folder",
    modifiedAt: e.server_modified as string | undefined,
  }));
}

export async function downloadDropboxFile(
  accessToken: string,
  path: string
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_summary || "Failed to download from Dropbox");
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName = path.split("/").pop() || "download";
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buffer, fileName, mimeType: contentType };
}

export async function getValidAccessToken(
  provider: OAuthProvider
): Promise<string | null> {
  const tokens = await getOAuthTokens(provider);
  if (!tokens) return null;

  if (tokens.expiresAt && tokens.expiresAt < Date.now() + 60_000) {
    if (provider === "google" && tokens.refreshToken) {
      const refreshed = await refreshGoogleToken(tokens.refreshToken);
      await storeOAuthTokens(provider, {
        accessToken: refreshed.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: refreshed.expiresAt,
      });
      return refreshed.accessToken;
    }
    return null;
  }

  return tokens.accessToken;
}