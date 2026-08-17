import type { Metadata } from 'next';
import { Database } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { WindowTabs } from '@/components/tier-list/window-tabs';
import { getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, relativeTime } from '@/lib/format';
import { hasDatabase } from '@/lib/prisma';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  TIER_ORDER,
  TIER_WINDOWS,
  assignTier,
  getBrawlerStatsForWindow,
  getLastAggregationRun,
  isTierWindow,
  normalizeWinRate,
  type TierWindowKey,
} from '@/lib/stats';
import type { Tier, TierListEntry } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Tier list',
  description:
    'Brawler tier list built from aggregated win and usage rates sampled daily.',
};

/** Reads the aggregate table, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ window?: string }>;
}

export default async function TierListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const windowKey: TierWindowKey = isTierWindow(params.window) ? params.window : '7d';
  const { days } = TIER_WINDOWS[windowKey];

  // Artwork (HTTP) overlaps with the database work, but the two database reads
  // run one after the other so the page never needs more than one connection.
  const [rows, brawlerMeta, lastRun] = await Promise.all([
    getBrawlerStatsForWindow(days),
    getBrawlerMap().catch(() => new Map()),
    getLastAggregationRun(),
  ]);

  const entries: TierListEntry[] = rows.map((row) => {
    const meta = brawlerMeta.get(row.brawlerId);
    const normalizedWinRate = normalizeWinRate(
      row.winRate,
      row.baselineWinRate,
      row.decidedSampleSize,
    );
    return {
      ...row,
      normalizedWinRate,
      tier: assignTier(normalizedWinRate) ?? 'D',
      imageUrl: meta?.imageUrl,
      rarityName: meta?.rarity?.name,
      rarityColor: meta?.rarity?.color,
      className: meta?.class?.name,
    };
  });

  // Anything under the sample floor is shown separately rather than ranked on
  // a win rate that is mostly noise.
  const isRated = (e: TierListEntry) =>
    e.normalizedWinRate !== null && e.decidedSampleSize >= MIN_SAMPLE_FOR_TIER;
  const rated = entries.filter(isRated);
  const unrated = entries.filter((e) => !isRated(e));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="display text-3xl uppercase sm:text-4xl">Brawl Stars tier list</h1>

        <p className="mt-3 max-w-3xl leading-relaxed text-muted">
          The current Brawl Stars tier list, built from win rates and pick rates in the
          recent ranked battles of players on the{' '}
          <Link href="/leaderboard" className="font-medium text-brand hover:underline">
            global leaderboard
          </Link>
          . Rankings refresh several times a day to track the latest meta.
          {lastRun ? ` Updated ${relativeTime(lastRun.startedAt)}.` : ''}
        </p>

        <p className="mt-2 text-sm text-muted">
          Tap or hover a brawler to see their sample size and raw win rate.
        </p>

        <div className="mt-5">
          <WindowTabs active={windowKey} />
        </div>
      </header>

      {rated.length === 0 ? (
        <EmptyState windowLabel={`${TIER_WINDOWS[windowKey].sublabel} window`} />
      ) : (
        <div className="space-y-4">
          {TIER_ORDER.map((tier) => {
            const inTier = rated
              .filter((e) => e.tier === tier)
              .sort((a, b) => (b.normalizedWinRate ?? 0) - (a.normalizedWinRate ?? 0));
            if (inTier.length === 0) return null;
            return <TierRow key={tier} tier={tier} entries={inTier} />;
          })}
        </div>
      )}

      {unrated.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold tracking-tight">Not enough data</h2>
          <p className="mt-1 text-sm text-muted">
            Not played often enough yet to rank.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {unrated.map((entry) => (
              <Link
                key={entry.brawlerId}
                href={`/brawlers/${entry.brawlerId}`}
                className="card card-interactive flex items-center gap-2 px-3 py-2 text-sm"
              >
                {entry.imageUrl ? (
                  <Image
                    src={entry.imageUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7"
                    unoptimized
                  />
                ) : null}
                <span className="capitalize">{entry.brawlerName.toLowerCase()}</span>
                <span className="text-xs text-muted">{entry.decidedSampleSize}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TierRow({ tier, entries }: { tier: Tier; entries: TierListEntry[] }) {
  const color = TIER_COLOR[tier];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div
          className="flex shrink-0 items-center justify-center px-6 py-3 sm:w-24 sm:py-6"
          style={{ background: `color-mix(in srgb, ${color} 22%, transparent)` }}
        >
          <span className="text-3xl font-black" style={{ color }}>
            {tier}
          </span>
        </div>

        <div className="flex flex-1 flex-wrap gap-2 p-3">
          {entries.map((entry) => (
            <Link
              key={entry.brawlerId}
              href={`/brawlers/${entry.brawlerId}`}
              className="group w-[86px] rounded-xl bg-surface-2 p-2 transition-transform hover:-translate-y-0.5"
              title={`${entry.brawlerName} — ${formatPercent(entry.normalizedWinRate)} adjusted (${formatPercent(entry.winRate)} raw) over ${formatNumber(entry.decidedSampleSize)} decided battles`}
            >
              {entry.imageUrl ? (
                <Image
                  src={entry.imageUrl}
                  alt={entry.brawlerName}
                  width={72}
                  height={72}
                  className="mx-auto aspect-square w-full object-contain"
                  unoptimized
                />
              ) : (
                <div className="mx-auto aspect-square w-full rounded-lg bg-surface" />
              )}
              <p className="mt-1 truncate text-center text-[11px] font-semibold capitalize">
                {entry.brawlerName.toLowerCase()}
              </p>
              <p className="text-center text-[11px] font-bold tabular-nums" style={{ color }}>
                {formatPercent(entry.normalizedWinRate)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ windowLabel }: { windowLabel: string }) {
  const configured = hasDatabase();

  return (
    <div className="card card-glow mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-accent">
        <Database className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-bold">
        {configured ? 'No aggregated data yet' : 'Database not configured'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {configured
          ? `Not enough ranked battles sampled in the ${windowLabel} yet. Try a longer window, or check back shortly.`
          : 'Rankings are not available right now.'}
      </p>
      <Link
        href="/brawlers"
        className="mt-6 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
      >
        Browse the brawler database
      </Link>
    </div>
  );
}
