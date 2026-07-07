import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [inTx, outTx, tips] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: user.id, direction: "IN" },
      _sum: { netApt: true, feeApt: true, amountApt: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, direction: "OUT" },
      _sum: { netApt: true, amountApt: true },
    }),
    prisma.tip.aggregate({
      where: { toUserId: user.id },
      _sum: { netApt: true },
    }),
  ]);

  const earned = inTx._sum.amountApt || 0;
  const spent = outTx._sum.amountApt || 0;
  const fees = inTx._sum.feeApt || 0;

  return NextResponse.json({
    earned,
    spent,
    fees,
    net: earned - spent,
    tipsReceived: tips._sum.netApt || 0,
  });
}
