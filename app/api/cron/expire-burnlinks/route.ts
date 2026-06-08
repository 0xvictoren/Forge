import { NextResponse } from "next/server";
import { purgeExpiredBurnLinks } from "@/lib/shelby-expiry";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const purged = await purgeExpiredBurnLinks(50);
  return NextResponse.json({ purged });
}
