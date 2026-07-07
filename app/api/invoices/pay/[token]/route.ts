import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyAptPayment, calcFee } from "@/lib/payments";
import { PLATFORM_FEE_BPS, TxType } from "@/lib/constants";
import { createNotification } from "@/lib/notifications";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { getPusherServer, userChannel } from "@/lib/pusher";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getSessionUser();
  if (!user?.walletAddress) {
    return NextResponse.json({ error: "Wallet required" }, { status: 401 });
  }

  const { token } = await params;
  const { txHash } = await request.json();

  if (!txHash?.startsWith("0x")) {
    return NextResponse.json({ error: "Transaction hash required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken: token },
    include: { issuer: true },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "paid") {
    return NextResponse.json({ ok: true, status: "paid", invoice });
  }

  if (!invoice.issuer.walletAddress) {
    return NextResponse.json({ error: "Issuer wallet not configured" }, { status: 400 });
  }

  const existing = await prisma.transaction.findUnique({ where: { txHash } });
  if (existing) {
    return NextResponse.json({ error: "Transaction already used" }, { status: 409 });
  }

  const verification = await verifyAptPayment(txHash, {
    sender: user.walletAddress,
    recipient: invoice.issuer.walletAddress,
    minAmountApt: invoice.amountApt * 0.99,
  });

  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error || "Payment verification failed" },
      { status: 400 }
    );
  }

  const { feeApt, netApt } = calcFee(invoice.amountApt, PLATFORM_FEE_BPS);
  const paidAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        txHash,
        paidAt,
        payerId: user.id,
        recipientId: invoice.recipientId || user.id,
      },
    });

    await tx.transaction.create({
      data: {
        userId: invoice.issuerId,
        type: TxType.CONTENT_SALE,
        direction: "IN",
        amountApt: invoice.amountApt,
        feeApt,
        netApt,
        counterpartyWallet: user.walletAddress,
        description: `Invoice ${invoice.invoiceNumber} paid`,
        txHash,
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: TxType.CONTENT_PURCHASE,
        direction: "OUT",
        amountApt: invoice.amountApt,
        feeApt,
        netApt: -invoice.amountApt,
        counterpartyWallet: invoice.issuer.walletAddress || undefined,
        description: `Paid invoice ${invoice.invoiceNumber}`,
        txHash: `${txHash}-out`,
      },
    });

    return inv;
  });

  await recordAnalyticsEvent({
    creatorId: invoice.issuerId,
    eventType: "PURCHASE",
    walletAddr: user.walletAddress,
    amountApt: invoice.amountApt,
  });

  await createNotification({
    userId: invoice.issuerId,
    type: "INVOICE_PAID",
    title: "Invoice paid",
    body: `${invoice.clientName} paid ${invoice.amountApt} APT for ${invoice.invoiceNumber}`,
    href: "/wallet/invoices",
  });

  await createNotification({
    userId: user.id,
    type: "INVOICE_PAID",
    title: "Payment confirmed",
    body: `You paid ${invoice.amountApt} APT for ${invoice.invoiceNumber}`,
    href: "/wallet/invoices",
  });

  const pusher = getPusherServer();
  if (pusher) {
    const payload = { invoiceId: updated.id, status: "paid", paidAt, txHash };
    await pusher.trigger(userChannel(invoice.issuerId), "invoice-paid", payload);
    await pusher.trigger(userChannel(user.id), "invoice-paid", payload);
  }

  return NextResponse.json({ ok: true, invoice: updated });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken: token },
    include: {
      issuer: { select: { displayName: true, username: true, walletAddress: true, verified: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      description: invoice.description,
      amountApt: invoice.amountApt,
      currency: invoice.currency,
      status: invoice.status,
      notes: invoice.notes,
      paidAt: invoice.paidAt,
      issuer: invoice.issuer,
    },
  });
}
