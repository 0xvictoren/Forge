import { NextResponse } from "next/server";
import { isObjectId, jsonError } from "@/lib/datasets/api";
import { computeProof } from "@/lib/datasets/proof";

/**
 * Public, recomputed proof for a sealed version: hashes are re-derived from the
 * stored manifest + datasheet and the onchain event is re-checked live.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!isObjectId(versionId)) return jsonError("Proof not found", 404);
  const proof = await computeProof(versionId);
  if (!proof) return jsonError("Proof not found", 404);
  return NextResponse.json(proof, { headers: { "Cache-Control": "public, max-age=60" } });
}
