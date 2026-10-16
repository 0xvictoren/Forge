import { NextResponse } from "next/server";
import { anchorMemoryBatch } from "@/lib/agents/memory";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Anchor all new agent memory checkpoints onchain as one Merkle root. */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ anchored: await anchorMemoryBatch() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Anchoring failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
