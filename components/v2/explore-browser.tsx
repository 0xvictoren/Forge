"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { AssetCard, type AssetCardData } from "./asset-card";
import { ProductCard, type ProductCardData } from "./product-card";
import { EXPLORE_CATEGORIES, EXPLORE_ASSET_TYPES, EXPLORE_SORT_OPTIONS } from "@/lib/v2/constants";
import { useI18n } from "@/components/providers/i18n-provider";
import { AssetCardSkeleton } from "@/components/ui/skeleton";
import { ExploreEmptyState } from "./explore-empty-state";

export function ExploreBrowser() {
  const { t } = useI18n();
  const [assets, setAssets] = useState<AssetCardData[]>([]);
  const [trending, setTrending] = useState<AssetCardData[]>([]);
  const [featured, setFeatured] = useState<AssetCardData[]>([]);
  const [bundles, setBundles] = useState<ProductCardData[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [assetType, setAssetType] = useState("all");
  const [sort, setSort] = useState("recent");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const skipRef = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const hasFilters = !!(q || minPrice || maxPrice || category !== "all" || assetType !== "all");

  const buildParams = (currentSkip: number) => {
    const params = new URLSearchParams({ sort, category });
    if (q) params.set("q", q);
    if (assetType !== "all") params.set("type", assetType);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (currentSkip > 0) params.set("skip", String(currentSkip));
    return params;
  };

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
      skipRef.current = 0;
    }

    try {
      const currentSkip = append ? skipRef.current : 0;
      const params = buildParams(currentSkip);
      const [assetsRes, prodsRes] = await Promise.all([
        fetch(`/api/explore/assets?${params}`),
        fetch("/api/products"),
      ]);

      if (!assetsRes.ok) throw new Error("Failed to load assets");

      const data = await assetsRes.json();
      const prods = await prodsRes.json();

      const newAssets: AssetCardData[] = data.assets || [];
      if (append) {
        setAssets((prev) => [...prev, ...newAssets]);
        skipRef.current = currentSkip + newAssets.length;
        setHasMore(newAssets.length >= 20);
      } else {
        setAssets(newAssets);
        setTrending(data.trending || []);
        setFeatured(data.featured || []);
        setBundles(
          (prods.products || [])
            .filter((p: ProductCardData & { isListed?: boolean }) => p.isListed && p.productType === "BUNDLE")
            .slice(0, 8)
        );
        skipRef.current = newAssets.length;
        setHasMore(newAssets.length >= 20);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load marketplace");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q, category, assetType, sort, minPrice, maxPrice]);

  useEffect(() => {
    const timer = setTimeout(() => load(false), q ? 280 : 10);
    return () => clearTimeout(timer);
  }, [load, q, category, assetType, sort, minPrice, maxPrice]);

  const clearFilters = () => {
    setQ("");
    setCategory("all");
    setAssetType("all");
    setSort("recent");
    setMinPrice("");
    setMaxPrice("");
  };

  const renderSkeletonGrid = (count = 4) => (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <AssetCardSkeleton key={i} />
      ))}
    </div>
  );

  const filterSidebar = (
    <aside className="w-full shrink-0 lg:sticky lg:top-[52px] lg:w-64 lg:self-start lg:max-h-[calc(100vh-52px)] lg:overflow-y-auto">
      <div className="space-y-4 rounded-xl border border-[var(--border-dim)] bg-[var(--bg-elevated)] p-4 lg:rounded-none lg:border-0 lg:border-r lg:bg-transparent lg:pr-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
          Filters
        </h2>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
            Search
          </label>
          <input
            type="search"
            placeholder={t("search_assets") || "Search assets…"}
            className="input w-full"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
            Asset type
          </label>
          <select
            className="input w-full"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            aria-label="Asset type"
          >
            {EXPLORE_ASSET_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
            Category
          </label>
          <select className="input w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPLORE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All categories" : c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
            Sort
          </label>
          <select className="input w-full" value={sort} onChange={(e) => setSort(e.target.value)}>
            {EXPLORE_SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
            Price range (APT)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              className="input w-full text-sm"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              min={0}
              step="0.1"
            />
            <span className="text-xs text-[var(--text-muted)]">to</span>
            <input
              type="number"
              placeholder="Max"
              className="input w-full text-sm"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              min={0}
              step="0.1"
            />
          </div>
        </div>

        <button onClick={clearFilters} className="btn-accent-ghost w-full text-sm">
          Clear filters
        </button>

        <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
          Search by title, description, or tags. 5% platform fee on paid assets.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {filterSidebar}

        <div className="min-w-0 flex-1">
      {error && (
        <div className="card mt-6 border-[var(--red)] p-4 text-sm text-[var(--red)]">
          {error}
          <button onClick={() => load(false)} className="ml-3 underline">Retry</button>
        </div>
      )}

      {!hasFilters && (
        <>
          <section className="mt-10">
            <h2 className="text-xl font-bold">{t("trending_now") || "Trending now"}</h2>
            {loading ? renderSkeletonGrid() : trending.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">No trending assets yet.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {trending.map((a) => <AssetCard key={a.id} asset={a} />)}
              </div>
            )}
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold">{t("featured_paid_assets") || "Featured paid assets"}</h2>
            {loading ? renderSkeletonGrid() : featured.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">No paid assets listed yet.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {featured.map((a) => <AssetCard key={`f-${a.id}`} asset={a} />)}
              </div>
            )}
          </section>

          {!loading && bundles.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Bundles &amp; Packs</h2>
                <Link href="/bundles" className="text-sm text-[var(--accent)]">Create or manage →</Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {bundles.map((b) => <ProductCard key={b.id} product={b} />)}
              </div>
            </section>
          )}
        </>
      )}

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">
            {hasFilters ? (t("results") || "Results") : (t("recently_added") || "Recently added")}
          </h2>
          {!loading && <span className="text-xs text-[var(--text-muted)]">{assets.length} shown</span>}
        </div>

        {loading ? (
          renderSkeletonGrid(8)
        ) : assets.length === 0 ? (
          <ExploreEmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {assets.map((a) => <AssetCard key={a.id} asset={a} />)}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button onClick={() => load(true)} disabled={loadingMore} className="btn-ghost">
                  {loadingMore ? "Loading more…" : "Load more assets"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
        </div>
      </div>
    </div>
  );
}
