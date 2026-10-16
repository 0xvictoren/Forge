import { NextResponse } from "next/server";
import { reconcileShelbyStorage } from "@/lib/shelby-lifecycle";

async function reconcile(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await reconcileShelbyStorage();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const GET = reconcile;
export const POST = reconcile;
