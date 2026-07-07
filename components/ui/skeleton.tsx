export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--bg-subtle)] ${className}`}
      aria-hidden
    />
  );
}

export function AssetCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-dim)] bg-white">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}