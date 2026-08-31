import { Database } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  JsonLd,
  breadcrumbSchema,
  faqSchema,
  itemListSchema,
} from '@/components/seo/structured-data';
import { RankedIcon, TrophyIcon } from '@/components/game-icons';
import {
  type BrawlerChange,
  ChangeBadge,
  WhatChanged,
  buildChangeIndex,
  isNotableInTier,
  spanLabel,
} from '@/components/tier-list/meta-changes';
import { MetaMovers } from '@/components/tier-list/meta-movers';
import { MostPicked } from '@/components/tier-list/most-picked';
import { Underrated } from '@/components/tier-list/underrated';
import { Disclosure } from '@/components/ui/disclosure';
import { SectionHeading } from '@/components/ui/section-heading';
import { RelativeTime } from '@/components/ui/relative-time';
import { TierListControls } from '@/components/tier-list/tier-list-controls';
import { brawlerPath } from '@/lib/slugs';
import { getBrawlerMap } from '@/lib/brawlapi';
import {
  formatNumber,
  formatPercent,
  humanizeMode,
  relativeTime,
  titleCaseLabel,
} from '@/lib/format';
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
  scoreBrawlers,
  type TierFormat,
  type TierWindowKey,
} from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { Tier, TierListEntry } from '@/types/stats';

/** How many meta movers to show on each side. */
const MOVER_LIMIT = 8;

/**
 * How many brawlers the most-picked list names.
 *
 * Ten, laid out two-up, so the section is five rows on a phone and does not
 * push the tier list it belongs to off the screen. Past about ten the pick
 * rates flatten into a long indistinguishable tail anyway.
 */
const MOST_PICKED_LIMIT = 10;

/**
 * How many under-picked winners to name.
 *
 * Six rather than ten: the point is a short list of picks worth trying, and a
 * longer one runs down into brawlers whose win rate is barely above the
 * cohort mean, where the claim stops being interesting.
 */
const UNDERRATED_LIMIT = 6;

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
    icon: (props: { className?: string }) => React.ReactNode;
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
    icon: RankedIcon,
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
    icon: TrophyIcon,
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
  windowKey,
  modeSlug,
}: {
  format: TierFormat;
  /**
   * Already resolved from the path by `resolveTierRoute`. Taken as a prop
   * rather than read here, because reading `searchParams` — which is where
   * this used to come from — makes the whole route dynamic, and these pages
   * are the site's most crawled.
   */
  windowKey: TierWindowKey;
  /**
   * Set by the `/tier-list/[format]/[mode]` routes. A mode in the path is a
   * page in its own right — "best brawlers for gem grab" is the search, and a
   * query parameter is one URL to a crawler however many values it takes.
   */
  modeSlug?: string;
}) {
  const { days } = TIER_WINDOWS[windowKey];
  const copy = COPY[format];

  const modes = await getFilterableModes(30, 150, format);
  // Only honour a mode we actually have data for, so a stale link cannot
  // produce a permanently empty page.
  const mode = modeSlug
    ? modes.find((m) => slugify(m.mode) === slugify(modeSlug))?.mode
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

  /*
   * Movement, indexed by brawler so a chip can carry its own.
   *
   * Suppressed on a mode page: `getMetaMovers` compares stored snapshots,
   * which are sample-wide, so its deltas do not describe the mode being
   * filtered to. `MetaMovers` already caveats this in words at the foot of the
   * page; a badge has no room to caveat anything, so it is simply absent.
   */
  const changes = mode ? new Map<number, BrawlerChange>() : buildChangeIndex(movers);
  const changeSpan = movers.length > 0 ? spanLabel(movers[0].fromDate, movers[0].toDate) : '';

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

  const ratedIds = new Set(scored.filter((e) => e.tier !== null).map((e) => e.brawlerId));
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

  /*
   * Answers to what people actually type, in the words they type them.
   *
   * These two pages are the highest-priority entries in the sitemap and had the
   * least structured data on the site — an ItemList and, on mode pages only, a
   * breadcrumb. Brawler and map pages already carry an FAQPage; this is the
   * query ("what is the best brawler in brawl stars") those pages do not answer
   * and this one is built to.
   *
   * Every figure is measured and degrades honestly: no rated brawlers means the
   * question is answered with why, rather than omitted or invented.
   */
  const best = rated.slice().sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
  const scopeName = mode ? `${humanizeMode(mode)} in ${copy.eyebrow.toLowerCase()}` : copy.battles;

  const faq = [
    {
      question: mode
        ? `What is the best brawler for ${humanizeMode(mode)} in Brawl Stars?`
        : `What is the best brawler in Brawl Stars ${format === 'ranked' ? 'Ranked' : 'on the trophy ladder'}?`,
      answer:
        best.length > 0
          ? `${titleCaseLabel(best[0].brawlerName)} ranks highest${mode ? ` in ${humanizeMode(mode)}` : ''}, with an adjusted win rate of ${formatPercent(best[0].normalizedWinRate)} across ${formatNumber(best[0].decidedSampleSize)} decided ${copy.battles} over the last ${TIER_WINDOWS[windowKey].sublabel}.${best.length > 2 ? ` ${titleCaseLabel(best[1].brawlerName)} and ${titleCaseLabel(best[2].brawlerName)} follow.` : ''}`
          : `Not enough ${copy.battles} have been sampled${mode ? ` in ${humanizeMode(mode)}` : ''} over the last ${TIER_WINDOWS[windowKey].sublabel} to rank brawlers yet. A brawler needs ${MIN_SAMPLE_FOR_TIER} decided battles before it is placed.`,
    },
    {
      question: 'How is this tier list made?',
      answer: `From ${formatNumber(sampled)} ${scopeName} sampled from real matches, not from votes or opinion. Win rate is adjusted against the average of the same sample, because the sampled pool wins more than half its games regardless of brawler — so a tier reflects the brawler rather than who was holding it. A brawler needs ${MIN_SAMPLE_FOR_TIER} decided battles in the window before it is rated at all.`,
    },
    {
      question: 'How often is the tier list updated?',
      answer: `The sampler collects new battles every few hours and this page is rebuilt from the latest aggregate, so it never trails the data by more than a few hours.`,
    },
  ];

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
                path: brawlerPath(entry.brawlerId, entry.brawlerName),
              })),
          )}
        />
      ) : null}
      {/* On the index too, not only mode pages: the index is the entry the
          sitemap ranks highest, and a breadcrumb is what puts /tier-list above
          it in a result rather than a bare URL. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Tier list', path: '/tier-list' },
          { name: copy.heading, path: `/tier-list/${format}` },
          ...(mode
            ? [
                {
                  name: humanizeMode(mode),
                  path: `/tier-list/${format}/${slugify(mode)}`,
                },
              ]
            : []),
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <header>
        <p className="eyebrow flex items-center gap-2 text-accent">
          <Icon className="size-3.5" />
          {copy.eyebrow}
        </p>
        <h1 className="display mt-2.5 text-3xl uppercase sm:text-4xl">{heading}</h1>

        {/*
          Two sentences, then the controls.
          
          This used to be two full paragraphs of methodology, which on a phone
          put the filters and the first tier below the fold — the reader had to
          scroll past an explanation of the ranking to reach the ranking. What
          the numbers are and where they came from is worth two lines; how they
          are computed is worth a disclosure, and nothing has been dropped from
          it.
        */}
        <p className="mt-3 max-w-3xl leading-relaxed text-muted">
          Based on {sampled > 0 ? `${formatNumber(sampled)} sampled ` : 'sampled '}
          {copy.battles}
          {mode ? ` in ${humanizeMode(mode)}` : ''} from{' '}
          <Link href="/leaderboard" className="font-medium text-brand hover:underline">
            global-leaderboard
          </Link>{' '}
          players.
          {lastRun ? (
            <>
              {' '}
              Sampled{' '}
              <RelativeTime iso={lastRun.startedAt} fallback={relativeTime(lastRun.startedAt)} />.
            </>
          ) : null}
        </p>

        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
          Meta score combines adjusted win rate and pick rate. Scores are relative to this{' '}
          {format === 'ranked' ? 'Ranked' : 'trophy'} list, not the{' '}
          <Link
            href={format === 'ranked' ? '/tier-list/trophy' : '/tier-list/ranked'}
            className="font-medium text-brand hover:underline"
          >
            {format === 'ranked' ? 'trophy tier list' : 'Ranked tier list'}
          </Link>
          .{' '}
          {/* The measured list is the one worth disagreeing with, so the place
              to disagree belongs next to it rather than buried in a menu. */}
          <Link href="/tier-list/maker" className="font-medium text-brand hover:underline">
            Disagree? Build your own
          </Link>
          .
        </p>

        <Disclosure className="mt-2" tone="bare" summary="How the meta score works">
          <p>
            {copy.intro} Brawlers are ranked by{' '}
            <strong className="font-semibold text-foreground">meta score</strong> out of 10, which
            combines an adjusted win rate with a log-scaled pick rate. Win rate alone would rate a
            brawler nobody plays the same as a staple with identical results, so popularity breaks
            the ties.
          </p>
          <p className="mt-2">{copy.caveat}</p>
          <p className="mt-2">
            {/* The scale is set per format, so the same 7.4 on both pages does
                not mean the same thing. Said plainly, rather than left for a
                reader to discover by comparing. */}
            The scale is calibrated within this list, so scores rank brawlers against each other
            here and cannot be compared with the{' '}
            <Link
              href={format === 'ranked' ? '/tier-list/trophy' : '/tier-list/ranked'}
              className="font-medium text-brand hover:underline"
            >
              {format === 'ranked' ? 'trophy list' : 'Ranked list'}
            </Link>
            . A brawler needs {MIN_SAMPLE_FOR_TIER} decided battles in the window before it is rated
            at all. Tap or hover a brawler for the full breakdown.
          </p>
        </Disclosure>

        <div className="mt-4">
          <TierListControls format={format} windowKey={windowKey} mode={mode} modes={modes} />
        </div>
      </header>

      {/* Above the tiers, because "has anything changed?" is the question a
          returning visitor arrives with, and the tiers themselves look the
          same every day. Renders nothing on a quiet day. */}
      {changes.size > 0 ? (
        <WhatChanged movers={movers} changes={changes} brawlerMeta={brawlerMeta} />
      ) : null}

      {rated.length === 0 ? (
        <EmptyState windowLabel={scopeLabel} />
      ) : (
        <div className="space-y-4">
          {TIER_ORDER.map((tier) => {
            const inTier = rated
              .filter((e) => e.tier === tier)
              .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
            if (inTier.length === 0) return null;
            return (
              <TierRow
                key={tier}
                tier={tier}
                entries={inTier}
                changes={changes}
                span={changeSpan}
              />
            );
          })}
        </div>
      )}

      {/*
        Placed under the tiers rather than above them: the ranking is what the
        page is for and what the URL promises, and popularity is the follow-up
        question. Above, it would be the first thing read and would be mistaken
        for the ranking itself.
      */}
      {rated.length > 0 ? (
        <MostPicked
          entries={entries}
          limit={MOST_PICKED_LIMIT}
          mode={mode}
          windowLabel={TIER_WINDOWS[windowKey].sublabel}
          battlesLabel={copy.battles}
        />
      ) : null}

      {/* After Most picked, because it is the answer to the question that one
          raises: popularity and strength diverge, and this is where they
          diverge most. Rated entries only — the claim is about a win rate. */}
      {rated.length > 0 ? (
        <Underrated
          entries={rated}
          limit={UNDERRATED_LIMIT}
          mode={mode}
          windowLabel={TIER_WINDOWS[windowKey].sublabel}
          battlesLabel={copy.battles}
        />
      ) : null}

      {unrated.length > 0 ? (
        <section>
          <SectionHeading
            title={copy.unratedHeading}
            subtitle={
              <>
                {copy.unratedBody} Each needs {MIN_SAMPLE_FOR_TIER} decided battles in the{' '}
                {TIER_WINDOWS[windowKey].sublabel} window; the count below is how far along it is.
                Closest first.
              </>
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {/* Sorted by progress toward the floor, so the brawlers about to be
                rated lead and the never-picked ones sit at the end. An
                unsorted wall of names hid both facts. */}
            {[...unrated]
              .sort((a, b) => b.decidedSampleSize - a.decidedSampleSize)
              .map((entry) => (
                <Link
                  key={entry.brawlerId}
                  href={brawlerPath(entry.brawlerId, entry.brawlerName)}
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

function TierRow({
  tier,
  entries,
  changes,
  span,
}: {
  tier: Tier;
  entries: TierListEntry[];
  changes: Map<number, BrawlerChange>;
  span: string;
}) {
  const color = TIER_COLOR[tier];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div
          className="flex shrink-0 items-center justify-center px-6 py-3 sm:w-24 sm:py-6"
          style={{
            background: `color-mix(in srgb, ${color} 22%, transparent)`,
          }}
        >
          <span className="text-3xl font-black" style={{ color }}>
            {tier}
          </span>
        </div>

        <div className="flex flex-1 flex-wrap gap-2 p-3">
          {entries.map((entry) => {
            const change = changes.get(entry.brawlerId);
            return (
              <Link
                key={entry.brawlerId}
                href={brawlerPath(entry.brawlerId, entry.brawlerName)}
                className="group w-[92px] rounded-xl bg-surface-2 p-2 transition-transform hover:-translate-y-0.5"
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
                <p className="mt-1 truncate text-center text-xs font-semibold capitalize">
                  {entry.brawlerName.toLowerCase()}
                </p>
                {/* Score leads, because it is what the ordering uses. The two
                  inputs sit underneath so the number is never a black box. */}
                <p className="text-center text-sm font-black tabular-nums" style={{ color }}>
                  {entry.metaScore?.toFixed(1) ?? '–'}
                </p>
                {/*
                Labelled and spaced rather than "55.1% · 2.0%".

                At 12px the period between two digits all but disappears in this
                face — "53.9%" reads as 539% — and two bare percentages a middot
                apart give no clue which is which. A one-letter label each
                solves both at once.

                Stacked rather than side by side, because the two of them do not
                fit on one line at a readable size: the card is 92px wide, and
                inline they had to drop to 11px with the labels dimmed to 60%
                opacity to fit — which is 3.2:1 against this surface, under the
                4.5:1 AA needs. Two rows buy the size and the contrast back for
                a line of height, and let the digits align in a column, so the
                numbers can be compared down a tier rather than only read.
              */}
                <p className="mx-auto mt-0.5 grid w-fit grid-cols-[auto_auto] items-baseline gap-x-1.5 text-xs tabular-nums">
                  <span className="text-muted" title="Adjusted win rate">
                    W
                  </span>
                  <span className="text-right font-semibold text-foreground">
                    {formatPercent(entry.normalizedWinRate)}
                  </span>
                  <span className="text-muted" title="Pick rate">
                    P
                  </span>
                  <span className="text-right font-semibold text-foreground">
                    {formatPercent(entry.usageRate)}
                  </span>
                </p>
                {/* Only when it actually moved. A badge on every chip saying
                  "+0.0" would be noise wearing the costume of information. */}
                {change && isNotableInTier(change, tier) ? (
                  <ChangeBadge change={change} span={span} currentTier={tier} />
                ) : null}
              </Link>
            );
          })}
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
