import { NextResponse } from "next/server";
import { jsonError } from "@/lib/datasets/api";
import { verifyCheckpoint } from "@/lib/agents/memory";

/** Public proof that a memory checkpoint existed, unaltered, by a given time. */
export async function GET(request: Request) {
  const entry = new URL(request.url).searchParams.get("entry")?.toLowerCase();
  if (!entry || !/^[0-9a-f]{64}$/.test(entry)) return jsonError("entry must be a 64-character hex hash");
  const result = await verifyCheckpoint(entry);
  if (!result) return jsonError("No checkpoint with that hash", 404);
  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=30" } });
}
