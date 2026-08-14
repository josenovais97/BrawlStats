import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl, getBrawlerMap } from '@/lib/brawlapi';
import { formatPercent } from '@/lib/format';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  assignTier,
  getLatestBrawlerStats,
  normalizeWinRate,
} from '@/lib/stats';

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
    .map((row) => ({
      ...row,
      normalized: normalizeWinRate(row.winRate, row.baselineWinRate),
    }))
    .filter((row) => row.normalized !== null)
    .sort((a, b) => (b.normalized ?? 0) - (a.normalized ?? 0))
    .slice(0, 5);

  if (ranked.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        Rankings are still being collected. Check back shortly.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {ranked.map((row, index) => {
        const tier = assignTier(row.normalized) ?? 'D';
        const meta = brawlerMeta.get(row.brawlerId);

        return (
          <li key={row.brawlerId}>
            <Link
              href={`/brawlers/${row.brawlerId}`}
              className="card card-interactive flex items-center gap-3 p-3"
            >
              <span className="w-6 shrink-0 text-center text-sm font-black tabular-nums text-muted">
                {index + 1}
              </span>
              <Image
                src={meta?.imageUrl ?? brawlerIconUrl(row.brawlerId)}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0"
                unoptimized
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold capitalize">
                  {row.brawlerName.toLowerCase()}
                </p>
                <p className="truncate text-xs text-muted">
                  {formatPercent(row.usageRate)} pick rate
                </p>
              </div>
              <span
                className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums"
                style={{
                  background: `color-mix(in srgb, ${TIER_COLOR[tier]} 18%, transparent)`,
                  color: TIER_COLOR[tier],
                }}
              >
                {formatPercent(row.normalized)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
