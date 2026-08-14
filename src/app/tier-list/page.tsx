import type { Metadata } from 'next';
import { Database, Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, relativeTime } from '@/lib/format';
import { hasDatabase } from '@/lib/prisma';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  TIER_ORDER,
  assignTier,
  getLastAggregationRun,
  getLatestBrawlerStats,
  normalizeWinRate,
} from '@/lib/stats';
import type { Tier, TierListEntry } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Tier list',
  description:
    'Brawler tier list built from aggregated win and usage rates sampled daily.',
};

/** Reads the aggregate table, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

export default async function TierListPage() {
  // Artwork (HTTP) overlaps with the database work, but the two database reads
  // run one after the other so the page never needs more than one connection.
  const [rows, brawlerMeta] = await Promise.all([
    getLatestBrawlerStats(),
    getBrawlerMap().catch(() => new Map()),
  ]);
  const lastRun = await getLastAggregationRun();

  const entries: TierListEntry[] = rows.map((row) => {
    const meta = brawlerMeta.get(row.brawlerId);
    const normalizedWinRate = normalizeWinRate(row.winRate, row.baselineWinRate);
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

  const totalBattles = rows.reduce((sum, r) => sum + r.sampleSize, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Tier list</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Built from battle logs sampled daily across a rotating pool of players, aggregated
          into win and usage rates. Reads from the database, not the live API.
        </p>
      </header>

      <MethodologyNote
        lastRunAt={lastRun?.finishedAt ?? lastRun?.startedAt ?? null}
        totalBattles={totalBattles}
        windowDays={rows[0]?.windowDays ?? 7}
        snapshotDate={rows[0]?.snapshotDate ?? null}
        baselineWinRate={rows[0]?.baselineWinRate ?? null}
      />

      {rated.length === 0 ? (
        <EmptyState />
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
            Fewer than {MIN_SAMPLE_FOR_TIER} decided battles sampled — no tier assigned yet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {unrated.map((entry) => (
              <Link
                key={entry.brawlerId}
                href={`/brawlers/${entry.brawlerId}`}
                className="card flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:border-brand/40"
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

function MethodologyNote({
  lastRunAt,
  totalBattles,
  windowDays,
  snapshotDate,
  baselineWinRate,
}: {
  lastRunAt: string | null;
  totalBattles: number;
  windowDays: number;
  snapshotDate: string | null;
  baselineWinRate: number | null;
}) {
  return (
    <div className="card flex gap-3 p-4 text-sm">
      <Info className="mt-0.5 size-5 shrink-0 text-accent" />
      <div className="space-y-1 text-muted">
        <p>
          <span className="font-semibold text-foreground">How this is built:</span> a daily
          cron job samples battle logs from a rotating pool of players and aggregates the
          last {windowDays} days. Win rate counts only modes that report a win or loss;
          showdown placements count toward usage only.
        </p>
        <p>
          <span className="font-semibold text-foreground">Percentages are adjusted.</span>{' '}
          The pool is seeded from top ladder and club rosters, and those players win{' '}
          {baselineWinRate !== null ? formatPercent(baselineWinRate) : 'well above 50%'} of
          their games with any brawler. Each rate is re-centred on that baseline, so 50%
          means &quot;average within this sample&quot;, not average across all players.
        </p>
        <p>
          {snapshotDate ? (
            <>
              Snapshot {snapshotDate} · {formatNumber(totalBattles)} sampled battles
              {lastRunAt ? ` · last refreshed ${relativeTime(lastRunAt)}` : ''}
            </>
          ) : (
            'No snapshot has been generated yet.'
          )}
        </p>
        <p className="text-xs">
          Re-centring removes the cohort&apos;s skill bias, not its taste: which brawlers
          top players choose to run is still baked in. Treat this as directional until the
          sample is broadened.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
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
        {configured ? (
          <>
            The tier list fills in after the first aggregation run. Trigger it manually with{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              curl -H &quot;Authorization: Bearer $CRON_SECRET&quot;
              .../api/cron/refresh-stats
            </code>
            , or wait for the daily cron job.
          </>
        ) : (
          <>
            Provision Neon Postgres through the Vercel Marketplace, set{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              DATABASE_URL
            </code>
            , and run the migrations. See the README for the full sequence.
          </>
        )}
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
