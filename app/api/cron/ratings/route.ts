import { NextResponse } from "next/server";
import { refreshAllRatings } from "@/lib/datasets/rating";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Recomputes every listed dataset's rating from the last 90 days of use. */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await refreshAllRatings());
}

export const GET = handle;
export const POST = handle;
