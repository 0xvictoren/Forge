"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatApt } from "@/lib/utils";
import { toast } from "sonner";
import { Upload, TrendingUp, Package, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardAsset = {
  id: string;
  title: string;
  priceApt: number;
  isListed: boolean;
  purchaseCount: number;
  viewCount: number;
  assetType: string;
  createdAt: string;
};

type DashboardSale = {
  id: string;
  amountApt: number;
  createdAt: string;
  asset?: { title: string } | null;
  product?: { title: string } | null;
  buyer?: { displayName?: string | null; username?: string | null };
};

type DashboardData = {
  assets: DashboardAsset[];
  sales: DashboardSale[];
  stats: {
    totalRevenue: number;
    totalSales: number;
    listedCount: number;
    totalAssets: number;
  };
};

export function CreatorDashboard({ userName }: { userName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/creator")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const toggleListing = async (assetId: string, isListed: boolean) => {
    setToggling(assetId);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isListed: !isListed }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update");

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === assetId ? { ...a, isListed: !isListed } : a
          ),
          stats: {
            ...prev.stats,
            listedCount: prev.stats.listedCount + (isListed ? -1 : 1),
          },
        };
      });
      toast.success(!isListed ? "Listed on Explore" : "Removed from Explore");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[var(--text-secondary)]">Could not load dashboard data.</p>
        <button onClick={() => window.location.reload()} className="btn-ghost mt-4">Retry</button>
      </div>
    );
  }

  const { assets, sales, stats } = data;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Creator Dashboard</h1>
          <p className="mt-1 text-[15px] text-[var(--text-secondary)]">
            Welcome back, {userName}. Manage your catalog and track sales.
          </p>
        </div>
        <Link href="/upload" className="btn-brand inline-flex items-center gap-2 self-start">
          <Upload className="h-4 w-4" />
          Upload new asset
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Revenue", value: formatApt(stats.totalRevenue), icon: DollarSign, hint: "all time" },
          { label: "Sales", value: String(stats.totalSales), icon: TrendingUp, hint: "completed" },
          { label: "Listed", value: String(stats.listedCount), icon: Package, hint: "on Explore" },
          { label: "Total assets", value: String(stats.totalAssets), icon: Upload, hint: "uploaded" },
        ].map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="card-terminal p-4">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[var(--brand)]" />
              <span className="font-display text-xs font-bold uppercase tracking-widest text-[var(--text-cream)]/60">{label}</span>
            </div>
            <p className="stat-mono mt-2 text-2xl font-semibold text-[var(--green)]">{value}</p>
            <p className="text-[10px] text-[var(--text-cream)]/50">{hint}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">My uploaded assets</h2>
          <Link href="/bundles" className="text-sm text-[var(--accent)]">Bundles &amp; Vaults →</Link>
        </div>

        {assets.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <p className="text-[var(--text-secondary)]">No assets uploaded yet.</p>
            <Link href="/upload" className="btn-primary mt-4 inline-flex">Upload your first asset</Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {assets.map((a) => (
              <li key={a.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/assets/${a.id}`} className="font-medium hover:text-[var(--brand)]">
                    {a.title}
                  </Link>
                  <p className="text-xs text-[var(--text-muted)]">
                    {a.assetType} · {formatApt(a.priceApt)} APT · {a.purchaseCount} sold · {a.viewCount} views
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`badge text-xs ${a.isListed ? "badge-paid" : "badge-free"}`}>
                    {a.isListed ? "Listed" : "Unlisted"}
                  </span>
                  <button
                    onClick={() => toggleListing(a.id, a.isListed)}
                    disabled={toggling === a.id}
                    className="btn-accent-ghost text-xs"
                  >
                    {toggling === a.id ? "…" : a.isListed ? "Delist" : "List on Explore"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-semibold">Recent sales</h2>
        {sales.length === 0 ? (
          <p className="card mt-4 p-4 text-sm text-[var(--text-muted)]">
            No sales yet. List assets on Explore to start earning.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {sales.map((s) => (
              <li key={s.id} className="card flex items-center justify-between p-3 text-sm">
                <div>
                  <span className="font-medium">{s.asset?.title || s.product?.title || "Sale"}</span>
                  <span className="text-[var(--text-muted)]">
                    {" "}→ {s.buyer?.displayName || s.buyer?.username || "buyer"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-[var(--green)]">+{formatApt(s.amountApt)}</span>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}