import { Database, Medal, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  JsonLd,
  breadcrumbSchema,
  itemListSchema,
} from '@/components/seo/structured-data';
import { MetaMovers } from '@/components/tier-list/meta-movers';
import { TierListControls } from '@/components/tier-list/tier-list-controls';
import { getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode, relativeTime } from '@/lib/format';
import { hasDatabase } from '@/lib/prisma';
import { slugify } from '@/lib/slugs';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  TIER_ORDER,
  TIER_WINDOWS,
  getBrawlerStatsForWindow,
  getFilterableModes,
  getLastAggregationRun,
  getMetaMovers,
  isTierWindow,
  scoreBrawlers,
  type TierFormat,
  type TierWindowKey,
} from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { Tier, TierListEntry } from '@/types/stats';

/** How many meta movers to show on each side. */
const MOVER_LIMIT = 8;

/**
 * Everything that differs between the two lists, in one place.
 *
 * They are the same page over different battles, and the only thing that must
 * never be shared is the prose: a reader who cannot tell which population they
 * are looking at will read a ladder ranking as a competitive one.
 */
const COPY: Record<
  TierFormat,
  {
    eyebrow: string;
    icon: typeof Medal;
    heading: string;
    /** Names the battles counted, mid-sentence. */
    battles: string;
    intro: string;
    /** Why this list is worth reading on its own. */
    caveat: string;
    unratedHeading: string;
    unratedBody: string;
  }
> = {
  ranked: {
    eyebrow: 'Competitive only',
    icon: Medal,
    heading: 'Ranked tier list',
    battles: 'Ranked battles',
    intro:
      'How brawlers perform in competitive Ranked, where matchmaking pairs comparable opponents. So what is left reflects the brawler rather than who was holding it.',
    caveat:
      'Ranked is 3v3 modes only and a small slice of what gets sampled, so the list is shorter and moves faster than the ladder one.',
    unratedHeading: 'Not enough Ranked data',
    unratedBody:
      'Competitive Ranked is a small slice of what gets sampled, so plenty of brawlers that see regular ladder play still have too few Ranked battles to rank.',
  },
  trophy: {
    eyebrow: 'Trophy ladder',
    icon: Trophy,
    heading: 'Trophy tier list',
    battles: 'trophy-ladder battles',
    intro:
      'How brawlers perform on the trophy ladder. The games most people actually play, showdown included, where you pick what you own rather than what the draft leaves you.',
    caveat:
      'Ladder matchmaking is looser than Ranked, so some of a brawler’s record here is the lobby rather than the brawler. Each mode is scored against its own average to keep that from deciding the list.',
    unratedHeading: 'Not enough ladder data',
    unratedBody:
      'Newly released brawlers, and anything barely played on ladder, need more battles before a win rate means anything.',
  },
};

export async function TierListView({
  format,
  searchParams,
  modeSlug,
}: {
  format: TierFormat;
  searchParams: Promise<{ window?: string; mode?: string }>;
  /**
   * Set by the `/tier-list/[format]/[mode]` routes. A mode in the path is a
   * page in its own right — "best brawlers for gem grab" is the search, and a
   * query parameter is one URL to a crawler however many values it takes.
   */
  modeSlug?: string;
}) {
  const params = await searchParams;
  const windowKey: TierWindowKey = isTierWindow(params.window) ? params.window : '7d';
  const { days } = TIER_WINDOWS[windowKey];
  const copy = COPY[format];

  const modes = await getFilterableModes(30, 150, format);
  // Only honour a mode we actually have data for, so neither a hand-edited
  // query string nor a stale link can produce a permanently empty page.
  const mode = modeSlug
    ? modes.find((m) => slugify(m.mode) === slugify(modeSlug))?.mode
    : modes.some((m) => m.mode === params.mode)
      ? params.mode
      : undefined;

  // A mode path that resolves to nothing is a 404, not an empty tier list: it
  // is a URL that does not name anything, and soft-404ing it would put an
  // indexable empty page behind every typo.
  if (modeSlug && !mode) notFound();

  // Artwork (HTTP) overlaps with the database work, but the database reads run
  // one after the other so the page never needs more than one connection.
  const [rows, brawlerMeta, lastRun, movers] = await Promise.all([
    getBrawlerStatsForWindow(days, mode, format),
    getBrawlerMap().catch(() => new Map<number, BABrawler>()),
    getLastAggregationRun(),
    // Snapshot-to-snapshot movement. The stored snapshots are competitive-only,
    // so this belongs to the Ranked list and is not rendered on the trophy one
    // — see MetaMovers.
    format === 'ranked' ? getMetaMovers(7) : Promise.resolve([]),
  ]);

  // `scoreBrawlers` leaves `tier` null below the sample floor, which is what
  // splits the page: rated brawlers get a row, the rest get the progress list.
  const scored = scoreBrawlers(rows, format);
  const byId = new Map(rows.map((row) => [row.brawlerId, row]));

  const entries: TierListEntry[] = scored.map((entry) => {
    const meta = brawlerMeta.get(entry.brawlerId);
    return {
      ...byId.get(entry.brawlerId)!,
      normalizedWinRate: entry.normalizedWinRate,
      metaScore: entry.metaScore,
      tier: entry.tier ?? 'D',
      imageUrl: meta?.imageUrl,
      rarityName: meta?.rarity?.name,
      rarityColor: meta?.rarity?.color,
      className: meta?.class?.name,
    };
  });

  const ratedIds = new Set(
    scored.filter((e) => e.tier !== null).map((e) => e.brawlerId),
  );
  const rated = entries.filter((e) => ratedIds.has(e.brawlerId));
  const unrated = entries.filter((e) => !ratedIds.has(e.brawlerId));
  const sampled = entries.reduce((sum, e) => sum + e.sampleSize, 0);

  const Icon = copy.icon;
  const scopeLabel = mode
    ? `${humanizeMode(mode)} over the ${TIER_WINDOWS[windowKey].sublabel} window`
    : `${TIER_WINDOWS[windowKey].sublabel} window`;
  // A mode page is about that mode, so it says so in the heading rather than
  // carrying the generic title with a filter chip lit up below it.
  const heading = mode ? `${humanizeMode(mode)} ${copy.heading.toLowerCase()}` : copy.heading;

  return (
    <div className="space-y-8">
      {rated.length > 0 ? (
        <JsonLd
          data={itemListSchema(
            heading,
            `Brawl Stars brawlers ranked by meta score${mode ? ` in ${humanizeMode(mode)}` : ''}.`,
            rated
              .slice()
              .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
              .map((entry) => ({
                name: entry.brawlerName,
                path: `/brawlers/${entry.brawlerId}`,
              })),
          )}
        />
      ) : null}
      {mode ? (
        <JsonLd
          data={breadcrumbSchema([
            { name: copy.heading, path: `/tier-list/${format}` },
            {
              name: humanizeMode(mode),
              path: `/tier-list/${format}/${slugify(mode)}`,
            },
          ])}
        />
      ) : null}

      <header>
        <p className="eyebrow flex items-center gap-2 text-accent">
          <Icon className="size-3.5" />
          {copy.eyebrow}
        </p>
        <h1 className="display mt-2.5 text-3xl uppercase sm:text-4xl">{heading}</h1>

        <p className="mt-3 max-w-3xl leading-relaxed text-muted">
          {copy.intro} Built from{' '}
          {sampled > 0 ? `${formatNumber(sampled)} sampled ` : 'sampled '}
          {copy.battles}
          {mode ? ` in ${humanizeMode(mode)}` : ''} played by people on the{' '}
          <Link href="/leaderboard" className="font-medium text-brand hover:underline">
            global leaderboard
          </Link>
          .{lastRun ? ` Updated ${relativeTime(lastRun.startedAt)}.` : ''}
        </p>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Brawlers are ranked by <strong className="font-semibold text-foreground">meta
          score</strong> out of 10, which combines an adjusted win rate with a
          log-scaled pick rate. Win rate alone would rate a brawler nobody plays the
          same as a staple with identical results, so popularity breaks the ties.{' '}
          {copy.caveat}{' '}
          {/* The scale is set per format, so the same 7.4 on both pages does not
              mean the same thing. Said plainly, rather than left for a reader to
              discover by comparing. */}
          The scale is calibrated within this list, so scores rank brawlers against
          each other here and are not comparable to the{' '}
          <Link
            href={format === 'ranked' ? '/tier-list/trophy' : '/tier-list/ranked'}
            className="font-medium text-brand hover:underline"
          >
            {format === 'ranked' ? 'trophy list' : 'Ranked list'}
          </Link>
          . Tap or hover a brawler for the full breakdown.
        </p>

        <div className="mt-5">
          <TierListControls
            format={format}
            windowKey={windowKey}
            mode={mode}
            modes={modes}
          />
        </div>
      </header>

      {rated.length === 0 ? (
        <EmptyState windowLabel={scopeLabel} />
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
          <h2 className="text-xl font-bold tracking-tight">{copy.unratedHeading}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
            {copy.unratedBody} Each needs {MIN_SAMPLE_FOR_TIER} decided battles in the{' '}
            {TIER_WINDOWS[windowKey].sublabel} window; the count below is how far along
            it is. Closest first.
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
                  title={`${entry.brawlerName}: ${entry.decidedSampleSize} of ${MIN_SAMPLE_FOR_TIER} decided ${copy.battles} needed to be ranked`}
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
              title={`${entry.brawlerName}: meta score ${entry.metaScore ?? '?'} from ${formatPercent(entry.normalizedWinRate)} adjusted win rate (${formatPercent(entry.winRate)} raw, against a ${formatPercent(entry.baselineWinRate)} average for the modes it is played in) and ${formatPercent(entry.usageRate)} pick rate, over ${formatNumber(entry.decidedSampleSize)} decided battles`}
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
                {entry.metaScore?.toFixed(1) ?? '–'}
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
          ? `Not enough battles sampled in the ${windowLabel} yet. Try a longer window, or check back shortly.`
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
