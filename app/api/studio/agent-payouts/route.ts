import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimited, requireUser, NO_STORE } from "@/lib/datasets/api";
import { runSettlement } from "@/lib/agents/settlement";
import { octasToAptString } from "@/lib/agents/pricing";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Seller's agent earnings: accrued, funded, paid, and recent payouts. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const reads = await prisma.agentRead.findMany({ where: { sellerId: auth.user.id }, select: { priceOctas: true, funded: true, payoutId: true } });
  const sum = (f: (r: (typeof reads)[number]) => boolean) => reads.filter(f).reduce((s, r) => s + BigInt(r.priceOctas), BigInt(0));
  const payouts = await prisma.sellerPayout.findMany({ where: { sellerId: auth.user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json(
    {
      reads: reads.length,
      accrued: octasToAptString(sum(() => true)),
      awaitingSettlement: octasToAptString(sum((r) => !r.funded)),
      readyToPay: octasToAptString(sum((r) => r.funded && !r.payoutId)),
      payouts: payouts.map((p) => ({ id: p.id, status: p.status, net: octasToAptString(p.netOctas), fee: octasToAptString(p.feeOctas), reads: p.readCount, txHash: p.txHash, error: p.error, createdAt: p.createdAt })),
    },
    { headers: NO_STORE }
  );
}

/** Settle and pay out this seller's agent earnings now. */
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`agent-payout:${auth.user.id}`, 3, 10 * 60_000);
  if (limited) return limited;
  const result = await runSettlement({ sellerId: auth.user.id, force: true });
  return NextResponse.json(result, { headers: NO_STORE });
}
