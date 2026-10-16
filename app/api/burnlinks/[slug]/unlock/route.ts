import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PLATFORM_FEE_BPS, TxType } from "@/lib/constants";
import { calcFee } from "@/lib/payments";
import { randomBytes } from "crypto";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { createNotification } from "@/lib/notifications";
import { ensureBurnLinkActive } from "@/lib/shelby-expiry";
import { normalizeAptosAddress } from "@/lib/wallet-access";
import { assertWalletGate } from "@/lib/burnlink-access";
import { completePurchase } from "@/lib/v2/purchase";
import { completePaymentIntent, consumePaymentIntent } from "@/lib/payment-intents";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionWallet = sessionUser.walletAddress || sessionUser.address;
    if (!sessionWallet) {
      return NextResponse.json({ error: "Authenticated wallet required" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    let walletAddress: string;
    try {
      walletAddress = normalizeAptosAddress(sessionWallet);
    } catch {
      return NextResponse.json({ error: "Invalid authenticated wallet" }, { status: 401 });
    }

    const txHash = body.txHash as string | undefined;
    const intentId = body.intentId as string | undefined;

    const burnLink = await prisma.burnLink.findUnique({
      where: { slug },
      include: { owner: true },
    });

    if (!burnLink) {
      return NextResponse.json({ error: "BurnLink not found" }, { status: 404 });
    }

    const active = await ensureBurnLinkActive(burnLink.id);
    if (!active.ok) {
      return NextResponse.json(
        { error: active.expired ? "This link has expired" : "Link unavailable" },
        { status: 410 }
      );
    }

    const ownerWallet = burnLink.owner.walletAddress || burnLink.owner.address || "";
    const isOwner = burnLink.userId === sessionUser.id;

    if (!isOwner) {
      const gate = assertWalletGate(burnLink, walletAddress);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
      }
    }

    const existingGrant = await prisma.accessGrant.findFirst({
      where: { burnLinkId: burnLink.id, userId: sessionUser.id },
    });

    if (existingGrant?.viewToken) {
      const redirect = `/view/${slug}?token=${existingGrant.viewToken}`;
      return NextResponse.json({
        success: true,
        viewToken: existingGrant.viewToken,
        token: existingGrant.viewToken,
        slug,
        redirect,
        reused: true,
      });
    }

    const isPaid = burnLink.priceApt > 0 && !isOwner;

    let verifiedIntent: Awaited<ReturnType<typeof consumePaymentIntent>> | undefined;
    if (isPaid) {
      if (!txHash?.startsWith("0x") || !intentId) {
        return NextResponse.json(
          { error: "Payment intent and transaction hash required" },
          { status: 400 }
        );
      }

      const creatorWallet = burnLink.owner.walletAddress || burnLink.owner.address;
      if (!creatorWallet) {
        return NextResponse.json({ error: "Creator wallet missing" }, { status: 400 });
      }

      verifiedIntent = await consumePaymentIntent({
        intentId,
        buyerId: sessionUser.id,
        walletAddress,
        kind: "BURNLINK",
        targetId: burnLink.id,
        txHash,
      });
    }

    const viewToken = randomBytes(32).toString("hex");
    const { feeApt, netApt } = verifiedIntent
      ? {
          feeApt: Number(BigInt(verifiedIntent.feeAtomic)) / 1e8,
          netApt: Number(BigInt(verifiedIntent.netAtomic)) / 1e8,
        }
      : calcFee(burnLink.priceApt, PLATFORM_FEE_BPS);

    const userId = sessionUser.id;

    const grant = existingGrant
      ? await prisma.accessGrant.update({
          where: { id: existingGrant.id },
          data: { viewToken, userId, walletAddress },
        })
      : await prisma.accessGrant.create({
          data: {
            burnLinkId: burnLink.id,
            userId,
            walletAddress,
            viewToken,
            viewsUsed: 0,
          },
        });

    if (isPaid && txHash) {
      const asset = await prisma.asset.findFirst({
        where: { burnLinkId: burnLink.id },
      });
      try {
        await completePurchase({
          buyerId: userId,
          sellerId: burnLink.userId,
          amountApt: burnLink.priceApt,
          txHash,
          purchaseType: "UNLOCK",
          assetId: asset?.id,
          burnLinkId: burnLink.id,
          title: burnLink.title || slug,
          settlement: verifiedIntent,
        });
      } catch (e) {
        console.error("Purchase record failed:", e);
      }

      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            userId: burnLink.userId,
            burnLinkId: burnLink.id,
            type: TxType.UNLOCK_SALE,
            direction: "IN",
            amountApt: burnLink.priceApt,
            feeApt,
            netApt,
            counterpartyWallet: walletAddress,
            description: `Sale: ${burnLink.title || slug}`,
            txHash,
            settlementTxHash: txHash,
            amountAtomic: verifiedIntent?.amountAtomic,
            feeAtomic: verifiedIntent?.feeAtomic,
            netAtomic: verifiedIntent?.netAtomic,
          },
        }),
        prisma.transaction.create({
          data: {
            userId,
            burnLinkId: burnLink.id,
            type: TxType.UNLOCK_PAYMENT,
            direction: "OUT",
            amountApt: burnLink.priceApt,
            feeApt,
            netApt: -burnLink.priceApt,
            counterpartyWallet: ownerWallet || undefined,
            description: `Unlock: ${burnLink.title || slug}`,
            txHash: `${txHash}-out`,
            settlementTxHash: txHash,
            amountAtomic: verifiedIntent?.amountAtomic,
            feeAtomic: verifiedIntent?.feeAtomic,
            netAtomic: verifiedIntent ? `-${verifiedIntent.amountAtomic}` : undefined,
          },
        }),
      ]);
      if (intentId) await completePaymentIntent(intentId, txHash);
    }

    await prisma.burnLink.update({
      where: { id: burnLink.id },
      data: { viewCount: { increment: 1 } },
    });

    try {
      await recordAnalyticsEvent({
        creatorId: burnLink.userId,
        burnLinkId: burnLink.id,
        eventType: isPaid ? "UNLOCK" : "VIEW",
        walletAddr: walletAddress,
        amountApt: isPaid ? burnLink.priceApt : undefined,
      });
    } catch (e) {
      console.error("Analytics event failed:", e);
    }

    if (isPaid) {
      try {
        await createNotification({
          userId: burnLink.userId,
          type: "PURCHASE",
          title: "BurnLink unlocked",
          body: `Someone unlocked "${burnLink.title || slug}" for ${burnLink.priceApt} APT`,
          href: `/b/${slug}`,
        });
      } catch (e) {
        console.error("Notification failed:", e);
      }
    }

    const redirect = `/view/${slug}?token=${grant.viewToken}`;

    return NextResponse.json({
      success: true,
      viewToken: grant.viewToken,
      token: grant.viewToken,
      slug,
      redirect,
    });
  } catch (error) {
    console.error("Unlock API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
