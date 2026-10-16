import { NextResponse } from "next/server";
import { z } from "zod";
import { issueWalletLoginChallenge } from "@/lib/wallet-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

const challengeSchema = z.object({
  walletAddress: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`auth-challenge:${requestIp(request)}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const parsed = challengeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
    }

    const challenge = await issueWalletLoginChallenge(
      parsed.data.walletAddress,
      new URL(request.url).origin
    );
    return NextResponse.json(challenge, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
}
