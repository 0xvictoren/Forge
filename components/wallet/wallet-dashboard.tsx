"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Download,
} from "lucide-react";
import { cn, formatApt } from "@/lib/utils";
import { InvoicePanel } from "@/components/wallet/invoice-panel";

const NAV = [
  { href: "/wallet", label: "Overview", icon: LayoutDashboard },
  { href: "/wallet/invoices", label: "Invoices", icon: FileText },
  { href: "/wallet/payouts", label: "Payouts", icon: Wallet },
];

interface Tx {
  id: string;
  type: string;
  description: string;
  direction: string;
  netApt: number;
  amountApt?: number;
  feeApt?: number;
  createdAt: Date | string;
}

interface Props {
  summary: {
    earned: number;
    spent: number;
    fees: number;
    net: number;
    invoiceTotal: number;
    invoicePaid: number;
    invoicePending: number;
  };
  transactions: Tx[];
}

export function WalletDashboard({ summary, transactions }: Props) {
  const pathname = usePathname();
  const isOverview = pathname === "/wallet" || pathname === "/wallet/payouts";

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="border-b border-[var(--border-dim)] bg-[var(--bg-elevated)] px-4 py-4 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <h1 className="text-xl font-bold">Wallet</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Full payment goes to creators · 2% platform fee tracked on sales
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-0 px-4 py-6 lg:px-8">
        <aside className="hidden w-52 shrink-0 pr-8 lg:block">
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
                  pathname === href || (href === "/wallet/payouts" && pathname === "/wallet/payouts")
                    ? "bg-[var(--accent-dim)] text-[var(--brand)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {isOverview && (
            <>
              <p className="text-sm text-[var(--text-secondary)]">Payouts overview</p>
              <h2 className="mt-1 text-2xl font-bold">Your activity</h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Total earned", value: summary.earned, accent: false },
                  { label: "Total spent", value: summary.spent, accent: false },
                  { label: "Net position", value: summary.net, accent: false },
                  { label: "Platform fees", value: summary.fees, accent: true },
                ].map(({ label, value, accent }) => (
                  <div key={label} className="card p-5">
                    <p className="text-sm text-[var(--text-muted)]">{label}</p>
                    <p
                      className={cn(
                        "mt-2 text-2xl font-bold",
                        accent && "text-[var(--brand)]"
                      )}
                    >
                      {formatApt(value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="card p-5">
                  <p className="text-sm text-[var(--text-muted)]">Invoices created</p>
                  <p className="mt-2 text-3xl font-bold">{summary.invoiceTotal}</p>
                </div>
                <div className="card p-5">
                  <p className="text-sm text-[var(--text-muted)]">Invoices paid</p>
                  <p className="mt-2 text-3xl font-bold text-green-600">
                    {summary.invoicePaid}
                  </p>
                </div>
                <div className="card p-5">
                  <p className="text-sm text-[var(--text-muted)]">Invoices pending</p>
                  <p className="mt-2 text-3xl font-bold text-[var(--brand)]">
                    {summary.invoicePending}
                  </p>
                </div>
              </div>

              <InvoicePanel />
            </>
          )}

          <div className="card mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-dim)] px-6 py-4">
              <h3 className="font-bold">Recent transactions</h3>
              <a
                href="/api/wallet/export"
                className="flex items-center gap-2 text-sm font-semibold text-[var(--brand)]"
              >
                <Download className="h-4 w-4" /> Export CSV
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Description</th>
                    <th className="px-6 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!transactions.length ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-[var(--text-muted)]"
                      >
                        No transactions yet
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-[var(--border-dim)]">
                        <td className="px-6 py-4">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="badge badge-paid">{tx.type}</span>
                        </td>
                        <td className="px-6 py-4">{tx.description}</td>
                        <td className="px-6 py-4 text-right font-semibold">
                          {tx.direction === "IN" ? "+" : "−"}
                          {formatApt(
                            Math.abs(
                              tx.direction === "IN"
                                ? tx.amountApt || tx.netApt || 0
                                : tx.amountApt || tx.netApt || 0
                            )
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
