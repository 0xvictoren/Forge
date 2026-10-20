import "server-only";
import { prisma } from "@/lib/db";

/** Uploads scoring below this (out of 10) are turned back with tips. */
export const ORIGINALITY_PASS = 5;

export type { OriginalityReport } from "./originality-types";
import type { OriginalityReport } from "./originality-types";

const SERVICE_URL = () => process.env.ORIGINALITY_SERVICE_URL?.replace(/\/$/, "") || "";

/**
 * Every upload must pass the check. Set ORIGINALITY_REQUIRED=false only for
 * local work without the Python service running.
 */
export function originalityRequired() {
  if (process.env.ORIGINALITY_REQUIRED === "false") return false;
  return true;
}

export function originalityConfigured() {
  return !!SERVICE_URL() && !!process.env.ORIGINALITY_SERVICE_SECRET;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  if (!originalityConfigured()) throw new Error("The originality check is not available right now");
  const res = await fetch(`${SERVICE_URL()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Forge-Key": process.env.ORIGINALITY_SERVICE_SECRET!, ...init.headers },
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The originality check failed");
  return data as T;
}

export async function scoreWithService(body: unknown) {
  return call<OriginalityReport>("/v1/score", { method: "POST", body: JSON.stringify(body) });
}

/** Make a sealed version's fingerprints comparable for future uploads. */
export async function commitFingerprints(versionId: string) {
  if (!originalityConfigured()) return;
  await call("/v1/commit", { method: "POST", body: JSON.stringify({ versionId }) }).catch((e) => console.error("[originality] commit", e));
}

export async function forgetDataset(datasetId: string) {
  if (!originalityConfigured()) return;
  await call(`/v1/datasets/${datasetId}`, { method: "DELETE" }).catch((e) => console.error("[originality] delete", e));
}

/**
 * Seal gate: every data file must be covered by a passing check. Returns the
 * version score (byte-weighted across checks), or an error to show the seller.
 */
export async function originalityForSeal(versionId: string, files: { sha256: string; sizeBytes: number }[]) {
  if (!originalityRequired()) return { ok: true as const, score: null };
  const checks = await prisma.originalityCheck.findMany({ where: { versionId, passed: true }, orderBy: { createdAt: "desc" } });
  const covered = new Map<string, number>();
  for (const c of checks) for (const s of c.shas) if (!covered.has(s)) covered.set(s, c.score);
  const missing = files.filter((f) => !covered.has(f.sha256.toLowerCase()));
  if (missing.length) {
    return { ok: false as const, error: `${missing.length} file${missing.length === 1 ? " has" : "s have"} not passed the originality check. Upload them again from Studio.` };
  }
  const total = files.reduce((s, f) => s + Math.max(1, f.sizeBytes), 0);
  const score = files.reduce((s, f) => s + covered.get(f.sha256.toLowerCase())! * Math.max(1, f.sizeBytes), 0) / total;
  return { ok: true as const, score: Math.round(score * 10) / 10 };
}
