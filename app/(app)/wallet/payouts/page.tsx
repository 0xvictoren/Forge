import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SiteHeader } from "@/components/layout/site-header";
import { WalletDashboard } from "@/components/wallet/wallet-dashboard";
import { redirect } from "next/navigation";

export default async function PayoutsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  let summary = {
    earned: 0,
    spent: 0,
    fees: 0,
    net: 0,
    invoiceTotal: 0,
    invoicePaid: 0,
    invoicePending: 0,
  };
  let transactions: Awaited<ReturnType<typeof prisma.transaction.findMany>> = [];

  try {
    const [inTx, outTx, txs, invoices] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: user.id, direction: "IN" },
        _sum: { netApt: true, feeApt: true, amountApt: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, direction: "OUT" },
        _sum: { amountApt: true, feeApt: true },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.invoice.findMany({
        where: { issuerId: user.id },
        select: { status: true },
      }),
    ]);
    summary.earned = inTx._sum.amountApt || 0;
    summary.spent = outTx._sum.amountApt || 0;
    summary.fees = inTx._sum.feeApt || 0;
    summary.net = summary.earned - summary.spent;
    summary.invoiceTotal = invoices.length;
    summary.invoicePaid = invoices.filter((i) => i.status === "paid").length;
    summary.invoicePending = invoices.filter((i) => i.status === "pending").length;
    transactions = txs;
  } catch {
    /* db */
  }

  return (
    <>
      <SiteHeader showSearch={false} />
      <WalletDashboard summary={summary} transactions={transactions} />
    </>
  );
}
