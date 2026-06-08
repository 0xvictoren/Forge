"use client";

import { useEffect, useState } from "react";
import { formatApt } from "@/lib/utils";

interface Analytics {
  totals: {
    views: number;
    unlocks: number;
    revenue: number;
    tips: number;
    engagement: number;
    downloads: number;
  };
  contentPerformance: { id: string; title: string; views: number; purchases: number; revenue: number }[];
  daily: { date: string; views: number; revenue: number }[];
}

export function DashboardInsights() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return <p className="text-[var(--text-muted)]">Loading analytics…</p>;
  }

  const maxRevenue = Math.max(...data.daily.map((d) => d.revenue), 1);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Post views", value: data.totals.views },
          { label: "Engagement", value: data.totals.engagement },
          { label: "Downloads / unlocks", value: data.totals.downloads },
          { label: "Revenue", value: formatApt(data.totals.revenue) },
          { label: "Paid unlocks", value: data.totals.unlocks },
          { label: "Tips received", value: formatApt(data.totals.tips) },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-bold">Earnings over time (30 days)</h3>
        <div className="mt-6 flex h-48 items-end gap-1">
          {data.daily.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No activity in the last 30 days.</p>
          ) : (
            data.daily.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full max-w-[20px] rounded-t bg-[var(--brand)]"
                  style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
                  title={`${d.date}: ${formatApt(d.revenue)}`}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <h3 className="border-b border-[var(--border-dim)] p-4 font-bold">Content performance</h3>
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-surface)] text-left text-[var(--text-muted)]">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Views</th>
              <th className="p-3">Purchases</th>
              <th className="p-3">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.contentPerformance.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No content yet</td></tr>
            ) : (
              data.contentPerformance.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border-dim)]">
                  <td className="p-3">{c.title}</td>
                  <td className="p-3">{c.views}</td>
                  <td className="p-3">{c.purchases}</td>
                  <td className="p-3">{formatApt(c.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
