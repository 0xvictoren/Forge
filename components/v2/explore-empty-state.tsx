import Link from "next/link";
import { Search, Upload } from "lucide-react";

export function ExploreEmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters?: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="card mx-auto mt-6 max-w-md p-10 text-center">
        <Search className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
        <h3 className="mt-4 text-lg font-semibold">No matching assets</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Try broadening your search, removing price filters, or selecting a different asset type.
        </p>
        {onClearFilters && (
          <button onClick={onClearFilters} className="btn-ghost mt-5 text-sm">
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card mx-auto mt-6 max-w-lg p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-3xl">
        📦
      </div>
      <h3 className="mt-5 text-xl font-semibold">Marketplace is warming up</h3>
      <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
        No assets are listed yet. Be the first creator to upload and publish to Explore.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/upload" className="btn-brand inline-flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload your first asset
        </Link>
      </div>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Connect your wallet, upload to Shelby, and enable &quot;Publish to Explore&quot; when publishing.
      </p>
    </div>
  );
}