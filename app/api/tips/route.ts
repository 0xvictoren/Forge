import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLATFORM_FEE_BPS, TxType } from "@/lib/constants";
import { verifyAptPayment, calcFee } from "@/lib/payments";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorHandle, amountApt, message, txHash } = await request.json();

  if (!creatorHandle || !amountApt || !txHash?.startsWith("0x")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.transaction.findUnique({ where: { txHash } });
  if (existing) {
    return NextResponse.json({ error: "Transaction already used" }, { status: 409 });
  }

  const profile = await prisma.creatorProfile.findUnique({
    where: { handle: creatorHandle },
    include: { user: true },
  });

  if (!profile?.user.walletAddress) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const verification = await verifyAptPayment(txHash, {
    sender: user.walletAddress || undefined,
    recipient: profile.user.walletAddress,
    minAmountApt: amountApt * 0.99,
  });

  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error || "Payment failed" },
      { status: 400 }
    );
  }

  const { feeApt, netApt } = calcFee(amountApt, PLATFORM_FEE_BPS);

  await prisma.$transaction([
    prisma.tip.create({
      data: {
        fromUserId: user.id,
        toUserId: profile.userId,
        amountApt,
        feeApt,
        netApt,
        message: message || null,
        txHash,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: profile.userId,
        type: TxType.TIP_RECEIVED,
        direction: "IN",
        amountApt,
        feeApt,
        netApt,
        counterpartyWallet: user.walletAddress || undefined,
        description: `Tip from ${user.username || user.walletAddress?.slice(0, 8)}${message ? ` — "${message}"` : ""}`,
        txHash,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        type: TxType.TIP_SENT,
        direction: "OUT",
        amountApt,
        feeApt,
        netApt: amountApt,
        counterpartyWallet: profile.user.walletAddress,
        description: `Tip to @${creatorHandle}`,
        txHash: `${txHash}-sent`,
      },
    }),
    prisma.creatorProfile.update({
      where: { id: profile.id },
      data: { totalEarnings: { increment: netApt } },
    }),
  ]);

  await recordAnalyticsEvent({
    creatorId: profile.userId,
    eventType: "TIP",
    walletAddr: user.walletAddress || undefined,
    amountApt,
  });

  await createNotification({
    userId: profile.userId,
    type: "TIP",
    title: "Tip received",
    body: `${amountApt} APT from ${user.displayName || user.username || "a fan"}`,
    href: "/wallet",
  });

  return NextResponse.json({ ok: true });
}
