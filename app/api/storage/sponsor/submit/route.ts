import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, NO_STORE, rateLimited, requireUser } from "@/lib/datasets/api";
import { submitSponsoredRegistration } from "@/lib/storage/sponsor";

export const runtime = "nodejs";

const schema = z.object({
  versionId: z.string().regex(/^[0-9a-f]{24}$/i),
  transaction: z.string().regex(/^(0x)?[0-9a-f]+$/i).max(200_000),
  mac: z.string().regex(/^[0-9a-f]{64}$/i),
  senderAuthenticator: z.string().regex(/^(0x)?[0-9a-f]+$/i).max(10_000),
});

/** Co-sign (as sponsor) and submit a registration the seller already signed. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`sponsor-submit:${auth.user.id}`, 30);
  if (limited) return limited;
  const wallet = auth.user.walletAddress || auth.user.address;
  if (!wallet) return jsonError("Connect a wallet");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid sponsored submission");
  try {
    return NextResponse.json(await submitSponsoredRegistration({ userId: auth.user.id, wallet, ...parsed.data }), { headers: NO_STORE });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Sponsored registration failed", 400);
  }
}
