import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createPaymentIntent } from "@/lib/payment-intents";
import { checkRateLimit } from "@/lib/rate-limit";

const intentSchema = z.object({
  kind: z.enum(["ASSET", "PRODUCT", "BURNLINK", "DATASET"]),
  targetId: z.string().trim().min(1).max(128),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = checkRateLimit(`payment-intent:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many payment attempts" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = intentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment intent" }, { status: 400 });
  }

  try {
    const intent = await createPaymentIntent({
      buyerId: user.id,
      kind: parsed.data.kind,
      targetKey: parsed.data.targetId,
    });
    return NextResponse.json({ intent }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create payment intent" },
      { status: 400 }
    );
  }
}
