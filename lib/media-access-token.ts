import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SEC = 5 * 60;

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.MEDIA_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

/** Build HMAC signature for gated media access. */
export function signMediaAccess(params: {
  grantId: string;
  wallet: string;
  ref: string;
  exp: number;
}): string {
  const payload = `${params.grantId}:${params.wallet}:${params.ref}:${params.exp}`;
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyMediaAccess(params: {
  grantId: string;
  wallet: string;
  ref: string;
  exp: number;
  sig: string;
}): boolean {
  if (params.exp < Math.floor(Date.now() / 1000)) return false;
  const expected = signMediaAccess({
    grantId: params.grantId,
    wallet: params.wallet,
    ref: params.ref,
    exp: params.exp,
  });
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(params.sig));
  } catch {
    return false;
  }
}

/** Signed Shelby proxy URL bound to grant + wallet. */
export function buildSignedMediaUrl(opts: {
  ref: string;
  grantId: string;
  wallet: string;
  fileName?: string;
  download?: boolean;
  ttlSec?: number;
}): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSec ?? DEFAULT_TTL_SEC);
  const wallet = opts.wallet.toLowerCase();
  const sig = signMediaAccess({
    grantId: opts.grantId,
    wallet,
    ref: opts.ref,
    exp,
  });

  const q = new URLSearchParams({
    ref: opts.ref,
    g: opts.grantId,
    w: wallet,
    exp: String(exp),
    sig,
  });
  if (opts.fileName) q.set("filename", opts.fileName);
  if (opts.download) q.set("download", "1");

  return `/api/media/shelby?${q.toString()}`;
}
