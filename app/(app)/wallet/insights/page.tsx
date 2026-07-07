"use client";

import { useEffect, useState } from "react";
import { formatApt } from "@/lib/utils";

type Dashboard = {
  summary: { views: number; unlocks: number; revenue: number; conversionRate: string };
  topAssets: Array<{
    id: string;
    title: string;
    purchaseCount: number;
    viewCount: number;
    priceApt: number;
  }>;
  vaults: Array<{ id: string; name: string; assets: number; views: number }>;
  referral?: { code: string; visits: number; purchases: number; revenueApt: number } | null;
};

export default function InsightsPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch("/api/analytics/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <p className="text-[var(--text-muted)]">Loading analytics…</p>;
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold">Analytics</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Business intelligence for your assets and vaults (last 30 days).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Views", value: String(data.summary.views) },
          { label: "Unlocks", value: String(data.summary.unlocks) },
          { label: "Revenue", value: formatApt(data.summary.revenue) },
          { label: "Conversion", value: `${data.summary.conversionRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-semibold">Top assets</h2>
        <ul className="mt-4 space-y-2">
          {data.topAssets.map((a) => (
            <li key={a.id} className="card flex justify-between p-4 text-sm">
              <span>{a.title}</span>
              <span className="text-[var(--text-muted)]">
                {a.purchaseCount} sales · {a.viewCount} views
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.referral && (
        <section className="mt-10 card p-6">
          <h2 className="font-semibold">Referral program</h2>
          <p className="mt-2 font-mono text-sm">
            {appUrl}/?ref={data.referral.code}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {data.referral.visits} visits · {data.referral.purchases} purchases ·{" "}
            {formatApt(data.referral.revenueApt)} revenue
          </p>
        </section>
      )}
    </div>
  );
}
