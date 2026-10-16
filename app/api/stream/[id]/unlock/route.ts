import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyAptPayment } from "@/lib/payments";
import { legacyMarketplacePaymentsEnabled } from "@/lib/payment-policy";
import { PLATFORM_FEE_BPS } from "@/lib/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!legacyMarketplacePaymentsEnabled()) {
    return NextResponse.json(
      { error: "Paid streams are paused while Forge migrates settlement to USDC" },
      { status: 503 }
    );
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { txHash } = await request.json();

  const asset = await prisma.asset.findUnique({ where: { id }, include: { owner: true } });
  if (!asset || asset.assetType !== "VIDEO" || !asset.streamPriceApt) {
    return NextResponse.json({ error: "Not a paid stream" }, { status: 400 });
  }

  const creatorWallet = asset.owner.walletAddress || asset.owner.address;
  if (!creatorWallet) return NextResponse.json({ error: "Creator wallet missing" }, { status: 400 });

  const verification = await verifyAptPayment(txHash, {
    sender: user.walletAddress || undefined,
    recipient: creatorWallet,
    minAmountApt: asset.streamPriceApt * 0.99,
  });

  if (!verification.valid) {
    return NextResponse.json({ error: verification.error || "Payment verification failed" }, { status: 400 });
  }

  // Record purchase
  await prisma.purchase.create({
    data: {
      buyerId: user.id,
      sellerId: asset.userId,
      assetId: id,
      amountApt: asset.streamPriceApt,
      feeApt: asset.streamPriceApt * (PLATFORM_FEE_BPS / 10000),
      netApt: asset.streamPriceApt * (1 - PLATFORM_FEE_BPS / 10000),
      txHash,
      purchaseType: "STREAM",
    },
  });

  return NextResponse.json({ success: true });
}
