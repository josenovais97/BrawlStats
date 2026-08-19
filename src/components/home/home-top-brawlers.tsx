import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl, getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  assignTierFromScore,
  getLatestBrawlerStats,
  metaScore,
  normalizeWinRate,
} from '@/lib/stats';

/** Podium colours for the first three rows. Everything below is neutral. */
const PODIUM = ['#ffc53d', '#c9d3ee', '#e08a4a'];

/**
 * Top five brawlers by win rate. Renders nothing until the aggregation has
 * enough data, so the homepage never shows an empty shell.
 */
export async function HomeTopBrawlers() {
  const [rows, brawlerMeta] = await Promise.all([
    getLatestBrawlerStats(),
    getBrawlerMap().catch(() => new Map()),
  ]);

  const ranked = rows
    .filter((row) => row.decidedSampleSize >= MIN_SAMPLE_FOR_TIER)
    .map((row) => {
      const normalized = normalizeWinRate(
        row.winRate,
        row.baselineWinRate,
        row.decidedSampleSize,
      );
      // Same ordering as the tier list, so the two pages never disagree.
      return { ...row, normalized, score: metaScore(normalized, row.usageRate) };
    })
    .filter((row) => row.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);

  if (ranked.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        Rankings are still being collected. Check back shortly.
      </p>
    );
  }

  return (
    <ol className="card divide-y divide-border overflow-hidden">
      {ranked.map((row, index) => {
        const tier = assignTierFromScore(row.score) ?? 'D';
        const meta = brawlerMeta.get(row.brawlerId);
        const podium = PODIUM[index];

        return (
          <li key={row.brawlerId}>
            <Link
              href={`/brawlers/${row.brawlerId}`}
              title={`${row.brawlerName}: meta score ${row.score ?? '?'} from ${formatPercent(row.normalized)} adjusted win rate and ${formatPercent(row.usageRate)} pick rate, over ${formatNumber(row.decidedSampleSize)} decided battles`}
              className="row-interactive flex items-center gap-3 border-l-2 border-transparent p-3 sm:gap-4 sm:p-3.5"
            >
              {/*
                Rank first, and weighted: the top three carry a filled chip in
                podium colours, the rest just a number. That single difference
                does the whole hierarchy job without changing row heights.
              */}
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg text-sm font-black tabular-nums sm:size-8"
                style={
                  podium
                    ? {
                        background: `color-mix(in srgb, ${podium} 18%, transparent)`,
                        color: podium,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${podium} 35%, transparent)`,
                      }
                    : { color: 'var(--muted)' }
                }
              >
                {index + 1}
              </span>

              <Image
                src={meta?.imageUrl ?? brawlerIconUrl(row.brawlerId)}
                alt=""
                width={44}
                height={44}
                className="size-10 shrink-0 rounded-lg sm:size-11"
                loading="lazy"
                unoptimized
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold capitalize leading-tight">
                  {row.brawlerName.toLowerCase()}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span
                    className="rounded px-1.5 py-0.5 text-[0.625rem] font-black leading-none"
                    style={{
                      background: `color-mix(in srgb, ${TIER_COLOR[tier]} 16%, transparent)`,
                      color: TIER_COLOR[tier],
                    }}
                  >
                    {tier}
                  </span>
                  <span className="truncate tabular-nums">
                    {formatPercent(row.usageRate)} pick
                  </span>
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className="display text-lg leading-none tabular-nums sm:text-xl"
                  style={{ color: TIER_COLOR[tier] }}
                >
                  {row.score?.toFixed(1) ?? '–'}
                </p>
                <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-wider text-muted">
                  Meta score
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
