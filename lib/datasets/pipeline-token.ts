import "server-only";
import { SignJWT, jwtVerify } from "jose";

const AUDIENCE = "forge-pipeline";
export const PIPELINE_TOKEN_TTL_SECONDS = 60 * 60;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(`${s}:pipeline`);
}

export type PipelineClaims = { licenseId: string; versionId: string; userId: string };

/** Short-lived bearer credential scoped to one licence and one dataset version. */
export async function issuePipelineToken(claims: PipelineClaims) {
  const expiresAt = new Date(Date.now() + PIPELINE_TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({ lid: claims.licenseId, vid: claims.versionId, uid: claims.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  return { token, expiresAt };
}

export async function verifyPipelineToken(token: string): Promise<PipelineClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    if (typeof payload.lid !== "string" || typeof payload.vid !== "string" || typeof payload.uid !== "string") return null;
    return { licenseId: payload.lid, versionId: payload.vid, userId: payload.uid };
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return null;
}
