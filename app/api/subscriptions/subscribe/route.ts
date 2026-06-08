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

  const { creatorHandle, tierIndex, txHash } = await request.json();

  if (!creatorHandle || tierIndex === undefined || !txHash?.startsWith("0x")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.transaction.findUnique({ where: { txHash } });
  if (existing) {
    return NextResponse.json({ error: "Transaction already used" }, { status: 409 });
  }

  const profile = await prisma.creatorProfile.findUnique({
    where: { handle: creatorHandle },
    include: { user: true, tiers: true },
  });

  if (!profile?.user.walletAddress) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const tier = profile.tiers.find((t) => t.tierIndex === tierIndex);
  if (!tier) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const verification = await verifyAptPayment(txHash, {
    sender: user.walletAddress || undefined,
    recipient: profile.user.walletAddress,
    minAmountApt: tier.priceApt * 0.99,
  });

  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error || "Payment failed" },
      { status: 400 }
    );
  }

  const { feeApt, netApt } = calcFee(tier.priceApt, PLATFORM_FEE_BPS);
  const renewsAt = new Date();
  renewsAt.setDate(renewsAt.getDate() + 30);

  await prisma.$transaction([
    prisma.subscriberGrant.create({
      data: {
        subscriberId: user.id,
        tierId: tier.id,
        creatorAddress: profile.user.walletAddress,
        renewsAt,
        onChainTxHash: txHash,
      },
    }),
    prisma.creatorProfile.update({
      where: { id: profile.id },
      data: { subscriberCount: { increment: 1 } },
    }),
    prisma.transaction.create({
      data: {
        userId: profile.userId,
        type: TxType.SUBSCRIPTION_RECEIVED,
        direction: "IN",
        amountApt: tier.priceApt,
        feeApt,
        netApt,
        counterpartyWallet: user.walletAddress || undefined,
        description: `Subscription from @${user.username || "fan"} (${tier.name})`,
        txHash,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        type: TxType.SUBSCRIPTION_PAID,
        direction: "OUT",
        amountApt: tier.priceApt,
        feeApt,
        netApt: tier.priceApt,
        counterpartyWallet: profile.user.walletAddress,
        description: `Subscribed to @${creatorHandle} (${tier.name})`,
        txHash: `${txHash}-paid`,
      },
    }),
  ]);

  await recordAnalyticsEvent({
    creatorId: profile.userId,
    eventType: "SUBSCRIBE",
    walletAddr: user.walletAddress || undefined,
    amountApt: tier.priceApt,
  });

  await createNotification({
    userId: profile.userId,
    type: "SUBSCRIBE",
    title: "New subscriber",
    body: `${user.displayName || user.username || "Someone"} subscribed to ${tier.name}`,
    href: "/dashboard",
  });

  return NextResponse.json({ ok: true, renewsAt });
}
