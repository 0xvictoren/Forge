import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, NO_STORE, rateLimited, requireUser } from "@/lib/datasets/api";
import { prisma } from "@/lib/db";
import { sponsorGas } from "@/lib/sponsor-gas";

const schema = z.object({ transaction: z.string().regex(/^(0x)?[0-9a-f]+$/i).max(200_000), senderAuthenticator: z.string().regex(/^(0x)?[0-9a-f]+$/i).max(2_000) });

/** Forge pays gas for transactions signed by email (Forge account) users. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`sponsor-gas:${auth.user.id}`, 20);
  if (limited) return limited;
  const wallet = auth.user.walletAddress || auth.user.address;
  if (!wallet) return jsonError("Sign in first", 401);
  const row = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { privyUserId: true } });
  if (!row?.privyUserId) return jsonError("Gas is sponsored for Forge accounts only", 403);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid transaction");
  try {
    return NextResponse.json(await sponsorGas({ userId: auth.user.id, wallet, ...parsed.data }), { headers: NO_STORE });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not submit the transaction");
  }
}
