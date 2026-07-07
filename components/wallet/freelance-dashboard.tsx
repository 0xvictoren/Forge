"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  TrendingUp,
  Settings,
  Download,
} from "lucide-react";
import { cn, formatApt } from "@/lib/utils";
import { ConnectWallet } from "@/components/wallet/connect-wallet";

const NAV = [
  { href: "/wallet", label: "Overview", icon: LayoutDashboard },
  { href: "/wallet/invoices", label: "Invoices", icon: FileText },
  { href: "/wallet/payouts", label: "Payouts", icon: Wallet },
  { href: "/wallet/insights", label: "Insights", icon: TrendingUp },
  { href: "/wallet/settings", label: "Settings", icon: Settings },
];

interface Tx {
  id: string;
  type: string;
  description: string;
  direction: string;
  netApt: number;
  createdAt: Date;
}

interface Props {
  summary: { earned: number; spent: number; fees: number; net: number };
  transactions: Tx[];
}

export function FreelanceDashboard({ summary, transactions }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-dim)] bg-white px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <h1 className="text-xl font-bold">Freelance Dashboard</h1>
          <ConnectWallet />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-0 px-4 py-6 lg:px-8">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 pr-8 lg:block">
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
                  pathname === href
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          <p className="text-sm text-[var(--text-secondary)]">Overview</p>
          <h2 className="mt-1 text-2xl font-bold">Your earnings</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total earned", value: summary.earned, positive: true },
              { label: "Total spent", value: summary.spent, positive: false },
              { label: "Net position", value: summary.net, positive: summary.net >= 0 },
              { label: "Platform fees", value: summary.fees, positive: false },
            ].map(({ label, value, positive }) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--border-dim)] bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-[var(--text-muted)]">{label}</p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-bold",
                    positive ? "text-[var(--green)]" : "text-[var(--text-primary)]"
                  )}
                >
                  {positive && value > 0 ? "+" : ""}
                  {formatApt(value)}
                </p>
              </div>
            ))}
          </div>

          {/* Chart placeholder */}
          <div className="mt-6 rounded-lg border border-[var(--border-dim)] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Earnings over time</h3>
              <select className="rounded-md border border-[var(--border-dim)] px-3 py-1.5 text-sm">
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>
            <div className="mt-6 flex h-48 items-end justify-between gap-2 px-4">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                <div
                  key={i}
                  className="w-full max-w-[24px] rounded-t bg-[var(--accent)] opacity-80"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div className="mt-6 overflow-hidden rounded-lg border border-[var(--border-dim)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border-dim)] px-6 py-4">
              <h3 className="font-bold">Recent transactions</h3>
              <button type="button" className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Description</th>
                    <th className="px-6 py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!transactions.length ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[var(--text-muted)]">
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
                          <span className="rounded bg-[var(--bg-subtle)] px-2 py-0.5 text-xs font-semibold">
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">{tx.description}</td>
                        <td
                          className={cn(
                            "px-6 py-4 text-right font-semibold",
                            tx.direction === "IN"
                              ? "text-[var(--green)]"
                              : "text-[var(--text-primary)]"
                          )}
                        >
                          {tx.direction === "IN" ? "+" : "−"}
                          {formatApt(Math.abs(tx.netApt))}
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
