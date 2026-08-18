import type { Metadata } from 'next';
import { Database } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MetaMovers } from '@/components/tier-list/meta-movers';
import { ModeFilter } from '@/components/tier-list/mode-filter';
import { WindowTabs } from '@/components/tier-list/window-tabs';
import { getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode, relativeTime } from '@/lib/format';
import { hasDatabase } from '@/lib/prisma';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  TIER_ORDER,
  TIER_WINDOWS,
  assignTierFromScore,
  getBrawlerStatsForWindow,
  getFilterableModes,
  getLastAggregationRun,
  getMetaMovers,
  isTierWindow,
  metaScore,
  normalizeWinRate,
  type TierWindowKey,
} from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { Tier, TierListEntry } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Tier list',
  description:
    'Brawler tier list built from aggregated win and usage rates sampled daily.',
};

/** Reads the aggregate table, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

/** How many meta movers to show on each side. */
const MOVER_LIMIT = 8;

interface PageProps {
  searchParams: Promise<{ window?: string; mode?: string }>;
}

export default async function TierListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const windowKey: TierWindowKey = isTierWindow(params.window) ? params.window : '7d';
  const { days } = TIER_WINDOWS[windowKey];

  const modes = await getFilterableModes();
  // Only honour a mode we actually have data for, so a hand-edited query string
  // cannot produce a permanently empty page.
  const mode = modes.some((m) => m.mode === params.mode) ? params.mode : undefined;

  // Artwork (HTTP) overlaps with the database work, but the two database reads
  // run one after the other so the page never needs more than one connection.
  const [rows, brawlerMeta, lastRun, movers] = await Promise.all([
    getBrawlerStatsForWindow(days, mode),
    getBrawlerMap().catch(() => new Map<number, BABrawler>()),
    getLastAggregationRun(),
    // Snapshot-to-snapshot movement in the same table this page ranks from.
    // Deliberately unfiltered: `brawler_stats` has no mode column, and the
    // section says so rather than pretending to follow the controls above it.
    getMetaMovers(7),
  ]);

  const entries: TierListEntry[] = rows.map((row) => {
    const meta = brawlerMeta.get(row.brawlerId);
    const normalizedWinRate = normalizeWinRate(
      row.winRate,
      row.baselineWinRate,
      row.decidedSampleSize,
    );
    const score = metaScore(normalizedWinRate, row.usageRate);
    return {
      ...row,
      normalizedWinRate,
      metaScore: score,
      tier: assignTierFromScore(score) ?? 'D',
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
          {mode ? `, filtered to ${humanizeMode(mode)}` : ''}. Rankings refresh several
          times a day to track the latest meta.
          {lastRun ? ` Updated ${relativeTime(lastRun.startedAt)}.` : ''}
        </p>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Brawlers are ranked by <strong className="font-semibold text-foreground">meta
          score</strong> out of 10, which combines an adjusted win rate with a
          log-scaled pick rate. Win rate alone would rate a brawler nobody plays the
          same as a staple with identical results, so popularity breaks the ties. Tap
          or hover a brawler for the full breakdown.
        </p>

        <div className="mt-5 space-y-3">
          <WindowTabs active={windowKey} />
          <ModeFilter modes={modes} active={mode} windowKey={windowKey} />
        </div>
      </header>

      {rated.length === 0 ? (
        <EmptyState
          windowLabel={
            mode
              ? `${humanizeMode(mode)} over the ${TIER_WINDOWS[windowKey].sublabel} window`
              : `${TIER_WINDOWS[windowKey].sublabel} window`
          }
        />
      ) : (
        <div className="space-y-4">
          {TIER_ORDER.map((tier) => {
            const inTier = rated
              .filter((e) => e.tier === tier)
              .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
            if (inTier.length === 0) return null;
            return <TierRow key={tier} tier={tier} entries={inTier} />;
          })}
        </div>
      )}

      {unrated.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold tracking-tight">Not enough Ranked data</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
            Win rates come from competitive Ranked battles only, which are a small
            slice of what gets sampled — so plenty of brawlers that see regular
            ladder play still have too few Ranked battles to rank. Each needs{' '}
            {MIN_SAMPLE_FOR_TIER} decided battles in the{' '}
            {TIER_WINDOWS[windowKey].sublabel} window; the count below is how far
            along it is. Closest first.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {/* Sorted by progress toward the floor, so the brawlers about to be
                rated lead and the never-picked ones sit at the end. An
                unsorted wall of names hid both facts. */}
            {[...unrated]
              .sort((a, b) => b.decidedSampleSize - a.decidedSampleSize)
              .map((entry) => (
                <Link
                  key={entry.brawlerId}
                  href={`/brawlers/${entry.brawlerId}`}
                  title={`${entry.brawlerName}: ${entry.decidedSampleSize} of ${MIN_SAMPLE_FOR_TIER} decided Ranked battles needed to be ranked`}
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
                  {/* A bare "18" reads as a stat about the brawler. Showing the
                      denominator makes it a progress bar in text form. */}
                  <span className="text-xs tabular-nums text-muted">
                    {entry.decidedSampleSize}/{MIN_SAMPLE_FOR_TIER}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ) : null}

      {/* Last, because it is the tier list over time rather than the tier list
          itself: you read the tiers, then ask who is moving. */}
      {movers.length > 0 ? (
        <MetaMovers
          movers={movers}
          brawlerMeta={brawlerMeta}
          limit={MOVER_LIMIT}
          modeFiltered={Boolean(mode)}
        />
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
              title={`${entry.brawlerName}: meta score ${entry.metaScore ?? '?'} from ${formatPercent(entry.normalizedWinRate)} adjusted win rate (${formatPercent(entry.winRate)} raw) and ${formatPercent(entry.usageRate)} pick rate, over ${formatNumber(entry.decidedSampleSize)} decided battles`}
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
              {/* Score leads, because it is what the ordering uses. The two
                  inputs sit underneath so the number is never a black box. */}
              <p className="text-center text-sm font-black tabular-nums" style={{ color }}>
                {entry.metaScore?.toFixed(1) ?? '—'}
              </p>
              <p className="text-center text-[10px] tabular-nums text-muted">
                {formatPercent(entry.normalizedWinRate)} · {formatPercent(entry.usageRate)}
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
