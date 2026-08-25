/** Loading placeholders that mirror the real layouts to avoid layout shift. */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="card card-glow p-6">
      <div className="flex flex-wrap items-center gap-5">
        <Skeleton className="size-20 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-12 w-32 rounded-xl" />
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[76px] rounded-2xl" />
      ))}
    </div>
  );
}

export function BattleLogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-xl" />
      ))}
    </div>
  );
}

export function BrawlerGridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Matches the homepage ranked lists, which are one card with divided rows
 * rather than separate cards, so the fallback and the real list occupy the
 * same box and nothing jumps when the data lands.
 */
export function RankedListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-border overflow-hidden">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5">
          <Skeleton className="size-7 rounded-lg sm:size-8" />
          <Skeleton className="size-10 rounded-lg sm:size-11" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <section>
      <Skeleton className="mb-4 h-8 w-40" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </section>
  );
}

/**
 * Mirrors the tier maker: a control row, five tier rows, then the pool grid.
 *
 * Shown while the board decodes, which happens in the browser — the share link
 * *is* the document, and reading it on the server is what used to make that
 * page uncacheable.
 */
export function TierMakerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-36 rounded-xl" />
        <Skeleton className="h-11 w-28 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <BrawlerGridSkeleton count={24} />
    </div>
  );
}
