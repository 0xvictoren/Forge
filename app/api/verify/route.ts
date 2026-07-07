import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyAptPayment, normalizeAddress } from "@/lib/payments";
import { PLATFORM_ADDRESS, TxType, VERIFICATION_COST_APT } from "@/lib/constants";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = user.walletAddress || user.address;
  if (!wallet) {
    return NextResponse.json({ error: "Wallet required" }, { status: 401 });
  }

  if (user.verified) {
    return NextResponse.json({ success: true, verified: true });
  }

  const treasury = PLATFORM_ADDRESS;
  if (!treasury) {
    return NextResponse.json(
      { error: "Treasury wallet not configured (set NEXT_PUBLIC_PLATFORM_ADDRESS)" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const txHash = body.txHash as string;
  const senderWallet = (body.walletAddress as string) || wallet;

  if (!txHash?.startsWith("0x")) {
    return NextResponse.json({ error: "Transaction hash required" }, { status: 400 });
  }

  try {
    if (
      normalizeAddress(senderWallet) !== normalizeAddress(wallet)
    ) {
      return NextResponse.json({ error: "Wallet mismatch with session" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { verificationTxHash: txHash },
  });
  if (existing) {
    return NextResponse.json({ error: "Transaction already used" }, { status: 409 });
  }

  const verification = await verifyAptPayment(txHash, {
    sender: senderWallet,
    recipient: treasury,
    minAmountApt: VERIFICATION_COST_APT * 0.99,
  });

  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error || "Payment verification failed" },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verificationTxHash: txHash,
        verificationTx: txHash,
        verifiedAt: new Date(),
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: TxType.VERIFICATION,
        direction: "OUT",
        amountApt: VERIFICATION_COST_APT,
        feeApt: 0,
        netApt: -VERIFICATION_COST_APT,
        counterpartyWallet: treasury,
        description: "Profile verification badge",
        txHash,
      },
    });

    return u;
  });

  await createNotification({
    userId: user.id,
    type: "VERIFIED",
    title: "Verification complete",
    body: "Your profile is now verified on Forge.",
    href: user.username ? `/${user.username}` : "/home",
  });

  return NextResponse.json({ success: true, user: updated });
}

export async function GET() {
  return NextResponse.json({
    costApt: VERIFICATION_COST_APT,
    treasury: PLATFORM_ADDRESS || null,
    configured: !!PLATFORM_ADDRESS,
  });
}
