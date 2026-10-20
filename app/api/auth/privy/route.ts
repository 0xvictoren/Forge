import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, mapDbUser } from "@/lib/auth";
import { findOrCreateWalletUser } from "@/lib/find-or-create-user";
import { privyConfigured, verifyPrivyUser } from "@/lib/privy/server";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

const schema = z.object({ accessToken: z.string().min(20).max(4096) });

/** Email sign-in: trade a Privy access token for a Forge session. */
export async function POST(request: Request) {
  if (!privyConfigured()) return NextResponse.json({ error: "Email sign-in is not set up" }, { status: 503 });
  const rate = checkRateLimit(`privy-login:${requestIp(request)}`, { limit: 20, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let identity;
  try {
    identity = await verifyPrivyUser(parsed.data.accessToken);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sign-in failed" }, { status: 401 });
  }

  let user = await findOrCreateWalletUser(identity.aptos.address);
  if (user.privyUserId !== identity.privyUserId || (!user.email && identity.email)) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { privyUserId: identity.privyUserId, ...(!user.email && identity.email ? { email: identity.email } : {}) },
    });
  }
  await createSession(user.id, user.email ?? undefined, identity.aptos.address.toLowerCase());
  return NextResponse.json({ user: mapDbUser(user) }, { headers: { "Cache-Control": "no-store" } });
}
