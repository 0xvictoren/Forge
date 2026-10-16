import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, NO_STORE, rateLimited, requireUser } from "@/lib/datasets/api";
import { prepareSponsoredRegistration, sponsorStatus } from "@/lib/storage/sponsor";

export const runtime = "nodejs";

/** Is sponsored storage available to this seller, and how much quota is left today? */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await sponsorStatus(auth.user.id), { headers: NO_STORE });
}

const schema = z.object({
  versionId: z.string().regex(/^[0-9a-f]{24}$/i),
  blobs: z.array(z.object({ blobName: z.string().min(1).max(1024), size: z.number().int().positive(), merkleRoot: z.string() })).min(1).max(32),
});

/** Build a sponsored registration transaction for the seller's wallet to sign. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`sponsor-prepare:${auth.user.id}`, 30);
  if (limited) return limited;
  const wallet = auth.user.walletAddress || auth.user.address;
  if (!wallet) return jsonError("Connect a wallet");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid sponsorship request");
  try {
    return NextResponse.json(await prepareSponsoredRegistration({ userId: auth.user.id, wallet, ...parsed.data }), { headers: NO_STORE });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not prepare sponsorship");
  }
}
