import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function invoiceNumber() {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

function paymentToken() {
  return randomBytes(16).toString("hex");
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: { issuerId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      ...inv,
      paymentUrl: inv.paymentToken ? `${baseUrl}/pay/invoice/${inv.paymentToken}` : null,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { clientName, clientEmail, description, amountApt, notes, status } = body;

  if (!clientName || !description || !amountApt) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: invoiceNumber(),
      issuerId: user.id,
      clientName,
      clientEmail: clientEmail || null,
      description,
      amountApt: Number(amountApt),
      notes: notes || null,
      status: status === "draft" ? "pending" : status || "pending",
      paymentToken: paymentToken(),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return NextResponse.json({
    invoice: {
      ...invoice,
      paymentUrl: `${baseUrl}/pay/invoice/${invoice.paymentToken}`,
    },
  });
}
