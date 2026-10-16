import { NextResponse } from "next/server";
import { runSettlement } from "@/lib/agents/settlement";
import { notifyAllPending } from "@/lib/agents/feeds";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Settles agent pay-per-read: withdraws channels into the settlement account,
 * then pays sellers. Moves money, so it always requires CRON_SECRET.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runSettlement();
  const feedDeliveries = await notifyAllPending(new URL(request.url).origin).catch(() => 0);
  return NextResponse.json({ ...result, feedDeliveries });
}

export const GET = handle;
export const POST = handle;
