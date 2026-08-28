import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/stats';
import { formatNumber, formatPercent } from '@/lib/format';
import type { BABrawler } from '@/types/brawlapi';
import type { MetaMover } from '@/types/stats';

/**
 * Which brawlers gained or lost ground since the last comparable snapshot.
 *
 * Rendered on the Ranked list only. The stored `brawler_stats` snapshots this
 * reads take their win rate from competitive battles alone, so there is no
 * trophy-ladder equivalent to show — putting this under the ladder list would
 * caption Ranked movement as ladder movement.
 *
 * It does *not* follow the window or mode controls above it, and says so.
 * Those recompute rates live from `battle_samples` over a trailing window;
 * this compares two stored daily snapshots, which are written at a fixed
 * 7-day window with no mode dimension at all. Silently ignoring the filters
 * would be the worse failure, so the caption states the span it actually used.
 *
 * For the same reason the deltas are self-contained: both sides come from the
 * snapshot table and are scored identically, so the *change* is exact, but the
 * absolute scores are not the ones the tiers above are drawn on and the
 * caption does not claim they are.
 */
export function MetaMovers({
  movers,
  brawlerMeta,
  limit,
  modeFiltered,
}: {
  movers: MetaMover[];
  brawlerMeta: Map<number, BABrawler>;
  limit: number;
  /** True when a mode filter is active on the page around this section. */
  modeFiltered: boolean;
}) {
  const rising = movers.filter((m) => m.metaScoreDelta > 0).slice(0, limit);
  const falling = movers
    .filter((m) => m.metaScoreDelta < 0)
    .slice(0, limit)
    .reverse();

  const iconFor = (id: number) => brawlerMeta.get(id)?.imageUrl;

  // The span is read off the data rather than assumed: `getMetaMovers` falls
  // back to the oldest snapshot it has when the full lookback is not available,
  // so a hardcoded "last 7 days" would be wrong on a young dataset.
  const span = movers[0];
  const days = span
    ? Math.max(
        1,
        Math.round(
          (Date.parse(span.toDate) - Date.parse(span.fromDate)) / 86_400_000,
        ),
      )
    : 0;

  return (
    <section aria-labelledby="meta-movers">
      <h2 id="meta-movers" className="display text-2xl uppercase">
        Meta movers
      </h2>
      <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
        Change in <strong className="font-semibold text-foreground">meta score</strong>{' '}
. The same 0&ndash;10 scale the tiers above use, measured on the stored
        daily snapshots, so a mover is a brawler visibly climbing or sliding the
        Ranked meta.{' '}
        {span
          ? `Measured over the last ${days} ${days === 1 ? 'day' : 'days'}, comparing the ${span.fromDate} and ${span.toDate} snapshots.`
          : 'Measured between the two most recent snapshots.'}{' '}
        Both sides clear the same sample floor as the tier list, and snapshots
        computed under different methodologies are never compared.
        {modeFiltered ? (
          <>
            {' '}
            <strong className="font-semibold text-foreground">
              Across all modes
            </strong>{' '}
. The daily snapshots this compares are not split by mode, so the
            filter above does not apply here.
          </>
        ) : null}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <MoverList
          title="Trending up"
          tone="text-victory"
          movers={rising}
          iconFor={iconFor}
          emptyLabel="Nothing gained ground over this span."
        />
        <MoverList
          title="Trending down"
          tone="text-defeat"
          movers={falling}
          iconFor={iconFor}
          emptyLabel="Nothing lost ground over this span."
        />
      </div>
    </section>
  );
}

function MoverList({
  title,
  tone,
  movers,
  iconFor,
  emptyLabel,
}: {
  title: string;
  tone: string;
  movers: MetaMover[];
  iconFor: (id: number) => string | undefined;
  emptyLabel: string;
}) {
  return (
    <div className="card p-4">
      {/* The unit lives in the header rather than on every row: "+1.3" next to
          a percentage reads as percentage points unless something says
          otherwise, and this column is meta score. */}
      <h3 className={`mb-3 flex items-center gap-2 font-bold ${tone}`}>
        {tone.includes('victory') ? (
          <ArrowUpRight className="size-4" />
        ) : (
          <ArrowDownRight className="size-4" />
        )}
        {title}
        <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-muted">
          Meta score /10
        </span>
      </h3>

      {movers.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {movers.map((mover) => {
            const url = iconFor(mover.brawlerId);
            const up = mover.metaScoreDelta > 0;
            const changedTier = mover.tierNow !== mover.tierBefore;
            return (
              <li key={mover.brawlerId}>
                <Link
                  href={brawlerPath(mover.brawlerId, mover.brawlerName)}
                  className="row-interactive flex items-center gap-3 rounded-lg p-2"
                >
                  {url ? (
                    <Image
                      src={url}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0"
                      unoptimized
                    />
                  ) : (
                    <span className="size-8 shrink-0 rounded bg-surface-2" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold capitalize">
                        {mover.brawlerName.toLowerCase()}
                      </span>
                      {/* A move that crossed a tier boundary is the most
                          concrete thing that can be said about it. */}
                      {changedTier ? (
                        <span className="shrink-0 text-xs font-bold tabular-nums">
                          <span style={{ color: TIER_COLOR[mover.tierBefore] }}>
                            {mover.tierBefore}
                          </span>
                          <span className="text-muted">→</span>
                          <span style={{ color: TIER_COLOR[mover.tierNow] }}>
                            {mover.tierNow}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    {/* The two inputs to the score, so the move is explained
                        rather than asserted. */}
                    <span className="block truncate text-xs text-muted">
                      {formatPercent(mover.winRateBefore)} →{' '}
                      {formatPercent(mover.winRateNow)} win ·{' '}
                      {formatPercent(mover.usageBefore)} →{' '}
                      {formatPercent(mover.usageNow)} pick
                    </span>
                    <span className="block truncate text-xs tabular-nums text-muted">
                      {formatNumber(mover.sampleSize)} decided battles
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-sm font-bold tabular-nums ${
                        up ? 'text-victory' : 'text-defeat'
                      }`}
                    >
                      {up ? '+' : '−'}
                      {Math.abs(mover.metaScoreDelta).toFixed(1)}
                    </span>
                    {/* Not smaller than this: at 10px the decimal point in
                        "8.4 → 7.3" disappears and it reads as "84 → 73". */}
                    <span className="block text-xs tabular-nums text-muted">
                      {mover.metaScoreBefore.toFixed(1)} →{' '}
                      {mover.metaScoreNow.toFixed(1)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
