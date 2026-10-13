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
import { PendingArea, TierNav } from '@/components/tier-list/tier-nav';
import type { RankBracket } from '@/lib/rank-brackets';
import { TierPodium } from '@/components/tier-list/tier-podium';
import { TIER_COPY, type TierCopy } from '@/components/tier-list/tier-list-copy';
import { LanguageLinks } from '@/components/i18n/language-links';
import { fmtDate, fmtDecimal, fmtNumber, fmtPercent, localePath, rankLabel, spanText, type Locale } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { RankedMapSwitch, type MapRows } from '@/components/tier-list/ranked-map-switch';
import { brawlerIconUrl, getGameModeMap } from '@/lib/brawlapi';
import { isFramedTile } from '@/lib/brawlapi';
import { brawlerPath } from '@/lib/slugs';
import { bracketTierListHref, tierListHref } from '@/lib/tier-list-route';

import {
  formatDate,
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
  getBracketRoster,
  getBracketMapPicks,
  getBrawlerStatsForWindow,
  getFilterableModes,
  getLastAggregationRun,
  getMetaMovers,
  getRankedMapPicks,
  getScoredRoster,
  type TierFormat,
  type TierWindowKey,
} from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { Tier, TierListEntry } from '@/types/stats';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';

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

/** The list's badge in the eyebrow. Its words are in `tier-list-copy`. */
const ICON: Record<TierFormat, (props: { className?: string }) => React.ReactNode> = {
  ranked: RankedIcon,
  trophy: TrophyIcon,
};

/** The window in words: the English tabs' "7d", or "7 días" in a sentence. */
function windowText(windowKey: TierWindowKey, locale: Locale): string {
  const { days, sublabel } = TIER_WINDOWS[windowKey];
  if (locale === 'en') return sublabel;
  if (days === 1) return '24 horas';
  return locale === 'es' ? `${days} días` : `${days} dias`;
}

export async function TierListView({
  format,
  windowKey,
  modeSlug,
  bracket,
  locale = 'en',
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
  /** A Ranked bracket, from the `/tier-list/ranked/rank/<bracket>` routes. */
  bracket?: RankBracket;
  /** The page's language. The `/es` and `/pt` routes set it; see `lib/i18n`. */
  locale?: Locale;
}) {
  const { days } = TIER_WINDOWS[windowKey];
  const t = TIER_COPY[locale];
  const copy = t.format[format];
  const words = await gameWords(locale);
  const pct = (v: number | null | undefined) => fmtPercent(v, locale);
  const num = (v: number | null | undefined) => fmtNumber(v, locale);
  const href = (path: string) => localePath(locale, path);
  const win = windowText(windowKey, locale);

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

  /*
   * A bracket's own list, widened to two weeks when one is thin, or null when
   * even that is too thin -- in which case the page shows every rank and says
   * so above the tiers, rather than a half-empty list labelled as the bracket.
   */
  const bracketData = bracket ? await getBracketRoster(bracket.id, mode).catch(() => null) : null;

  // Artwork (HTTP) overlaps with the database work, but the database reads run
  // one after the other so the page never needs more than one connection.
  const [rows, scored, brawlerMeta, lastRun, movers, mapPicks] = await Promise.all([
    bracketData ? Promise.resolve(bracketData.rows) : getBrawlerStatsForWindow(days, mode, format),
    bracketData ? Promise.resolve(bracketData.scored) : getScoredRoster(days, mode, format),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getLastAggregationRun(),
    // Snapshot-to-snapshot movement. The stored snapshots are competitive-only,
    // so this belongs to the Ranked list and is not rendered on the trophy one
    // — see MetaMovers.
    format === 'ranked' ? getMetaMovers(7) : Promise.resolve([]),
    // The mode's Ranked maps, for the chips under the mode filter. Only on a
    // mode page: the combined list has no map pool, and the trophy ladder has
    // no map-level ranking. Same cached read the Bubble's panel uses.
    // On a rank page, that rank's map picks: every rank's adjusted to the
    // rank, then pulled toward the rank's own battles (getBracketMapPicks).
    format === 'ranked' && mode
      ? (bracket ? getBracketMapPicks(bracket.id, 60) : getRankedMapPicks(60)).catch(() => [])
      : Promise.resolve([]),
  ]);

  const maps: MapRows[] = mapPicks
    .filter((map) => map.mode === mode)
    .sort((a, b) => a.mapName.localeCompare(b.mapName))
    .map((map) => ({
      mapName: locale === 'en' ? map.mapName : words.map(map.mapName),
      // `/maps/<mode>/<map>` uses the same slugs the catalogue does.
      slug: `${slugify(map.mode)}/${slugify(map.mapName)}`,
      picks: map.picks.map((pick) => ({
        brawlerId: pick.brawlerId,
        brawlerName: pick.brawlerName,
        imageUrl:
          brawlerMeta.get(pick.brawlerId)?.imageUrl ?? brawlerIconUrl(pick.brawlerId),
        score: pick.score,
        overallScore: pick.overallScore,
        battles: pick.decidedSampleSize,
        allBattles: pick.allRanksSampleSize,
      })),
      rankLabel: bracket ? rankLabel(bracket, locale) : undefined,
    }));

  /*
   * Movement, indexed by brawler so a chip can carry its own.
   *
   * Suppressed on a mode page: `getMetaMovers` compares stored snapshots,
   * which are sample-wide, so its deltas do not describe the mode being
   * filtered to. `MetaMovers` already caveats this in words at the foot of the
   * page; a badge has no room to caveat anything, so it is simply absent.
   */
  // Also absent on a bracket page, for the same reason: the snapshots are
  // every rank's.
  const changes =
    mode || bracket ? new Map<number, BrawlerChange>() : buildChangeIndex(movers);
  const changeSpan =
    movers.length > 0
      ? locale === 'en'
        ? spanLabel(movers[0].fromDate, movers[0].toDate)
        : spanText(movers[0].fromDate, movers[0].toDate, locale)
      : '';

  // `scoreBrawlers` leaves `tier` null below the sample floor, which is what
  // splits the page: rated brawlers get a row, the rest get the progress list.
  const byId = new Map(rows.map((row) => [row.brawlerId, row]));

  const entries: TierListEntry[] = scored.map((entry) => {
    const meta = brawlerMeta.get(entry.brawlerId);
    return {
      ...byId.get(entry.brawlerId)!,
      normalizedWinRate: entry.normalizedWinRate,
      metaScore: entry.metaScore,
      tier: entry.tier ?? 'F',
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

  const Icon = ICON[format];
  /** The mode as the reader's game names it. */
  const modeName = mode ? words.mode(mode) : undefined;
  const rankName = bracket ? rankLabel(bracket, locale) : undefined;
  const scopeLabel = t.scopeLabel(win, modeName);
  // A mode page is about that mode, so it says so in the heading rather than
  // carrying the generic title with a filter chip lit up below it.
  const heading = t.heading(format, modeName, rankName);

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
  // The game's mode badges for the mode chips, keyed the way `modes` is.
  const modeMeta = await getGameModeMap().catch(() => new Map());
  const modeIcons: Record<string, string> = Object.fromEntries(
    modes
      .map((m) => [m.mode, modeMeta.get(m.mode.toLowerCase())?.imageUrl] as const)
      .filter((pair): pair is readonly [string, string] => Boolean(pair[1])),
  );
  const modeNames: Record<string, string> = Object.fromEntries(modes.map((m) => [m.mode, words.mode(m.mode)]));
  const best = rated.slice().sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
  const scopeName = t.scopeName(format, modeName);
  const name = (i: number) => titleCaseLabel(best[i].brawlerName);

  const faq = [
    {
      question: t.faq.bestQ(format, modeName),
      answer:
        best.length > 0
          ? t.faq.bestA({
              first: name(0),
              second: best.length > 2 ? name(1) : undefined,
              third: best.length > 2 ? name(2) : undefined,
              rate: pct(best[0].normalizedWinRate),
              games: num(best[0].decidedSampleSize),
              battles: copy.battles,
              window: win,
              mode: modeName,
            })
          : t.faq.noneA({ battles: copy.battles, mode: modeName, window: win, floor: MIN_SAMPLE_FOR_TIER }),
    },
    { question: t.faq.howQ, answer: t.faq.howA({ sampled: num(sampled), scope: scopeName, floor: MIN_SAMPLE_FOR_TIER }) },
    { question: t.faq.oftenQ, answer: t.faq.oftenA },
  ];

  return (
    <TierNav>
    <div className="space-y-8">
      {rated.length > 0 ? (
        <JsonLd
          data={itemListSchema(
            heading,
            t.itemList(modeName),
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
          { name: t.breadcrumbRoot, path: locale === 'en' ? '/tier-list' : href(`/tier-list/${format}`) },
          { name: copy.heading, path: href(`/tier-list/${format}`) },
          ...(mode
            ? [
                {
                  name: modeName ?? humanizeMode(mode),
                  path: href(`/tier-list/${format}/${slugify(mode)}`),
                },
              ]
            : []),
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow flex items-center gap-2 text-accent">
            <Icon className="size-3.5" />
            {copy.eyebrow}
          </p>
          <LanguageLinks locale={locale} path={currentPath(format, windowKey, mode, bracket)} />
        </div>
        <h1 className="display mt-2.5 text-3xl uppercase sm:text-4xl">{heading}</h1>

        {/*
          The answer, in one sentence, before anything else.

          The tiers below are the answer for a person looking at them; they are
          not an answer for anything that reads the page as text. Measured in
          Umami on 2026-09-21, ChatGPT was the site's largest outside referrer
          — four times Google — and what an answer engine can quote is a plain
          sentence with names, a number and a date. This is the same fact the
          meta description and the FAQ already state, put where a reader and a
          quoter both meet it first. The date is absolute for the same reason
          (see `formatDate`).
        */}
        {best.length >= 3 ? (
          <p className="mt-3 max-w-3xl text-base leading-relaxed">
            <strong>
              {t.answer({ first: name(0), second: name(1), third: name(2), format, mode: modeName })}
            </strong>
            {lastRun ? ` (${locale === 'en' ? 'as of ' : ''}${locale === 'en' ? formatDate(lastRun.startedAt) : fmtDate(lastRun.startedAt, locale)})` : ''}.{' '}
            {t.lead({ first: name(0), rate: pct(best[0].normalizedWinRate), games: num(best[0].decidedSampleSize) })}
          </p>
        ) : null}

        {/*
          Two sentences, then the controls.
          
          This used to be two full paragraphs of methodology, which on a phone
          put the filters and the first tier below the fold — the reader had to
          scroll past an explanation of the ranking to reach the ranking. What
          the numbers are and where they came from is worth two lines; how they
          are computed is worth a disclosure, and nothing has been dropped from
          it.
        */}
        <TierPodium best={best} brawlerMeta={brawlerMeta} copy={t} locale={locale} />

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
          {t.based({
            sampled: sampled > 0 ? num(sampled) : undefined,
            battles: copy.battles,
            mode: modeName,
            rank: bracketData && bracket ? rankName : undefined,
            days: bracketData && bracket ? bracketData.days : undefined,
            // The English line says how long ago, live; the translations give
            // the date, since `RelativeTime` speaks English.
            asOf: locale !== 'en' && lastRun ? fmtDate(lastRun.startedAt, locale) : undefined,
          })}
          {locale === 'en' && lastRun ? (
            <>
              {' '}
              Sampled{' '}
              <RelativeTime iso={lastRun.startedAt} fallback={relativeTime(lastRun.startedAt)} />.
            </>
          ) : null}{' '}
          {/* The measured list is the one worth disagreeing with, so the place
              to disagree belongs next to it rather than buried in a menu. */}
          <Link href="/tier-list/maker" className="font-medium text-brand hover:underline">
            {t.disagree}
          </Link>
          .
        </p>



        <Disclosure className="mt-2" tone="bare" summary={t.howSummary}>
          <p>{t.how1(format)}</p>
          <p className="mt-2">
            {copy.intro} {t.how2a}{' '}
            <strong className="font-semibold text-foreground">{t.metaScore}</strong> {t.how2b}
          </p>
          <p className="mt-2">{copy.caveat}</p>
          <p className="mt-2">
            {/* The scale is set per format, so the same 7.4 on both pages does
                not mean the same thing. Said plainly, rather than left for a
                reader to discover by comparing. */}
            {t.how3a}{' '}
            <Link
              href={href(format === 'ranked' ? '/tier-list/trophy' : '/tier-list/ranked')}
              className="font-medium text-brand hover:underline"
            >
              {t.otherList(format)}
            </Link>
            {t.how3b(MIN_SAMPLE_FOR_TIER)}{' '}
            <Link href="/meta-score" className="font-medium text-brand hover:underline">
              {t.fullMethod}
            </Link>{' '}
            {t.how3c}
          </p>
        </Disclosure>

        <div className="mt-4">
          <TierListControls
            format={format}
            windowKey={windowKey}
            mode={mode}
            modes={modes}
            modeIcons={modeIcons}
            modeNames={modeNames}
            bracket={bracket ?? null}
            locale={locale}
          />
        </div>

        {/* Said plainly when a bracket could not be shown as itself. */}
        {bracket && !bracketData ? (
          <p className="mt-3 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-sm leading-relaxed">
            <strong>{t.bracketMissingStrong(rankName ?? bracket.label)}</strong> {t.bracketMissingRest}
          </p>
        ) : bracket && bracketData && bracketData.days > TIER_WINDOWS[windowKey].days ? (
          <p className="mt-3 text-sm text-muted">
            {t.bracketWidened(rankName ?? bracket.label, bracketData.days, TIER_WINDOWS[windowKey].days)}
          </p>
        ) : null}
      </header>

      {/* Above the tiers, because "has anything changed?" is the question a
          returning visitor arrives with, and the tiers themselves look the
          same every day. Renders nothing on a quiet day. */}
      {changes.size > 0 ? (
        <WhatChanged movers={movers} changes={changes} brawlerMeta={brawlerMeta} locale={locale} />
      ) : null}

      {/* On a Ranked mode page the tiers sit inside the map switch, so a map
          chip can swap them for that map's ranking without a request. */}
      <PendingArea>
      <RankedMapSwitch maps={maps} locale={locale}>
        {rated.length === 0 ? (
          <EmptyState windowLabel={scopeLabel} copy={t} />
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
                  copy={t}
                  locale={locale}
                />
              );
            })}
          </div>
        )}
      </RankedMapSwitch>
      </PendingArea>

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
          modeLabel={modeName}
          windowLabel={win}
          battlesLabel={copy.battles}
          locale={locale}
        />
      ) : null}

      {/* After Most picked, because it is the answer to the question that one
          raises: popularity and strength diverge, and this is where they
          diverge most. Rated entries only — the claim is about a win rate. */}
      {rated.length > 0 ? (
        <Underrated
          entries={rated}
          limit={UNDERRATED_LIMIT}
          modeLabel={modeName}
          windowLabel={win}
          battlesLabel={copy.battles}
          locale={locale}
        />
      ) : null}

      {unrated.length > 0 ? (
        <section>
          <SectionHeading
            title={copy.unratedHeading}
            subtitle={
              <>
                {copy.unratedBody} {t.unratedSub(MIN_SAMPLE_FOR_TIER, win)}
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
                  title={t.unratedChip(entry.brawlerName, entry.decidedSampleSize, MIN_SAMPLE_FOR_TIER, copy.battles)}
                  className="card card-interactive flex items-center gap-2 px-3 py-2 text-sm"
                >
                  {entry.imageUrl ? (
                    <Image
                      src={entry.imageUrl}
                      alt=""
                      width={28}
                      height={28}
                      className={isFramedTile(entry.imageUrl) ? 'size-7' : 'size-7 rounded-sm bg-[#151515] object-cover'}
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
          locale={locale}
        />
      ) : null}
    </div>
    </TierNav>
  );
}

function TierRow({
  tier,
  entries,
  changes,
  span,
  copy,
  locale,
}: {
  tier: Tier;
  entries: TierListEntry[];
  changes: Map<number, BrawlerChange>;
  span: string;
  copy: TierCopy;
  locale: Locale;
}) {
  const color = TIER_COLOR[tier];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/*
          The tier band carries the weight of the row.

          A flat 22% wash of the tier colour gave S and D the same presence, so
          a list whose whole job is to rank things read as six equal shelves. A
          gradient plus a glow behind the letter makes the band an object with
          a light source, and the count underneath tells you how crowded the
          tier is — which is information the eye otherwise has to gather by
          scanning the row.
        */}
        <div
          className="relative flex shrink-0 items-center justify-center gap-3 px-6 py-3 sm:w-24 sm:flex-col sm:gap-1 sm:py-6"
          style={{
            background: `linear-gradient(155deg, color-mix(in srgb, ${color} 52%, transparent) 0%, color-mix(in srgb, ${color} 14%, transparent) 65%, transparent 100%)`,
            boxShadow: `inset 0 1px 0 color-mix(in srgb, #ffffff 12%, transparent), inset -1px 0 0 color-mix(in srgb, ${color} 45%, transparent)`,
          }}
        >
          <span
            className="text-4xl font-black leading-none"
            style={{
              color,
              textShadow: `0 0 26px color-mix(in srgb, ${color} 60%, transparent)`,
            }}
          >
            {tier}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {entries.length}
          </span>
        </div>

        <div className="flex flex-1 flex-wrap gap-2 p-3">
          {entries.map((entry) => {
            const change = changes.get(entry.brawlerId);
            return (
              <Link
                key={entry.brawlerId}
                href={brawlerPath(entry.brawlerId, entry.brawlerName)}
                style={{ '--tier': color } as React.CSSProperties}
                className="group w-[92px] rounded-xl border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_45%),var(--surface-2)] p-2 transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--tier)_55%,transparent)] hover:shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--tier)_70%,transparent)]"
                title={copy.chipTitle({
                  name: entry.brawlerName,
                  score: String(entry.metaScore ?? '?'),
                  adj: fmtPercent(entry.normalizedWinRate, locale),
                  raw: fmtPercent(entry.winRate, locale),
                  base: fmtPercent(entry.baselineWinRate, locale),
                  pick: fmtPercent(entry.usageRate, locale),
                  games: fmtNumber(entry.decidedSampleSize, locale),
                })}
              >
                {entry.imageUrl ? (
                  <Image
                    src={entry.imageUrl}
                    alt={entry.brawlerName}
                    width={72}
                    height={72}
                    className={
                      isFramedTile(entry.imageUrl)
                        ? 'mx-auto aspect-square w-full object-contain'
                        : // The mirror's frame, drawn by hand for art from anywhere else.
                          'mx-auto aspect-square w-full rounded-md border-[3px] border-[#151515] bg-[#151515] object-cover'
                    }
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
                  {entry.metaScore !== null && entry.metaScore !== undefined ? fmtDecimal(entry.metaScore, locale) : '–'}
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
                  <span className="text-muted" title={copy.winTitle}>
                    {copy.winLetter}
                  </span>
                  <span className="text-right font-semibold text-foreground">
                    {fmtPercent(entry.normalizedWinRate, locale)}
                  </span>
                  <span className="text-muted" title={copy.pickTitle}>
                    {copy.pickLetter}
                  </span>
                  <span className="text-right font-semibold text-foreground">
                    {fmtPercent(entry.usageRate, locale)}
                  </span>
                </p>
                {/* Only when it actually moved. A badge on every chip saying
                  "+0.0" would be noise wearing the costume of information. */}
                {change && isNotableInTier(change, tier) ? (
                  <ChangeBadge change={change} span={span} currentTier={tier} locale={locale} />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ windowLabel, copy }: { windowLabel: string; copy: TierCopy }) {
  const configured = hasDatabase();

  return (
    <div className="card card-glow mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-accent">
        <Database className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-bold">
        {copy.emptyTitle(configured)}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.emptyBody(configured, windowLabel)}</p>
      <Link
        href="/brawlers"
        className="mt-6 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
      >
        {copy.browse}
      </Link>
    </div>
  );
}

/** This page's own path in English, for the language links. */
function currentPath(
  format: TierFormat,
  windowKey: TierWindowKey,
  mode: string | undefined,
  bracket: RankBracket | undefined,
): string {
  return bracket ? bracketTierListHref(bracket, mode) : tierListHref(format, windowKey, mode);
}
