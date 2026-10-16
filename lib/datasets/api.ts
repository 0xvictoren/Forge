import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export function jsonError(message: string, status = 400, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function requireUser(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Sign in with your wallet to continue", 401) };
  return { user };
}

export function rateLimited(key: string, limit: number, windowMs = 60_000) {
  const rate = checkRateLimit(key, { limit, windowMs });
  if (rate.allowed) return null;
  return jsonError("Too many requests. Slow down a little", 429, { "Retry-After": String(rate.retryAfterSeconds) });
}

export const isObjectId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);

export const NO_STORE = { "Cache-Control": "no-store" };
