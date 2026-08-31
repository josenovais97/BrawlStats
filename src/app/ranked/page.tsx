import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { MapPreview } from '@/components/ranked/map-preview';
import { SeasonPanel } from '@/components/ranked/season-panel';
import { RankedIcon } from '@/components/game-icons';
import { Disclosure } from '@/components/ui/disclosure';
import { RelativeTime } from '@/components/ui/relative-time';
import { currentMonth } from '@/lib/site';
import { brawlerPath } from '@/lib/slugs';
import { brawlerIconUrl, getBrawlerMap, getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode, relativeTime } from '@/lib/format';
import { getActiveMaps } from '@/lib/game-maps';
import { getSeasonState, type SeasonState } from '@/lib/ranked-seasons';
import { getRankedMapLastSeen } from '@/lib/stats';
import { slugify } from '@/lib/slugs';
import { getLastAggregationRun, getRankedMapPicks } from '@/lib/stats';
import type { BABrawler, BAGameMode, BAMap } from '@/types/brawlapi';
import type { MapConfidence, RankedMapPicks } from '@/types/stats';

/* A function, so the month is the month the page was last regenerated. */
export function generateMetadata(): Metadata {
  return {
    alternates: { canonical: '/ranked' },
    title: `Brawl Stars Ranked maps and best brawlers (${currentMonth()})`,
    description: `The best brawlers for every map in the current Ranked rotation, ${currentMonth()}. From sampled competitive battles, updated every few hours.`,
  };
}

/** Own aggregate plus artwork, so an hour is plenty. */
export const revalidate = 3600;

const CONFIDENCE_LABEL: Record<MapConfidence, string> = {
  low: 'Thin sample',
  medium: 'Building',
  high: 'Well sampled',
};

export default async function RankedPage() {
  const [maps, lastSeenRows, mapMeta, modeMeta, brawlerMeta, season, lastRun] = await Promise.all([
    getRankedMapPicks(3),
    getRankedMapLastSeen().catch(() => []),
    getMapMap().catch(() => new Map<number, BAMap>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    getBrawlerMap().catch(() => new Map<number, BABrawler>()),
    getSeasonState().catch(
      (): SeasonState => ({
        current: null,
        next: null,
        latest: null,
        nextStartsOn: null,
        daysUntilNext: null,
        mapPool: [],
        mapPoolSeason: null,
        source: 'fallback',
      }),
    ),
    getLastAggregationRun(),
  ]);

  // Sampled maps are matched to the catalogue by name and mode, so a map that
  // has since left rotation simply loses its link rather than 404ing.
  const activeMaps = await getActiveMaps().catch(() => []);

  /*
   * The board is the season's published map pool, not the set of maps we
   * happen to have battles for.
   *
   * Those two drift apart at every season turnover, in both directions, and
   * for the same reason: a map only enters our data once someone we sample has
   * played it, and only leaves after four days without a sighting. So for the
   * first days of a season the board showed last season's retired maps and was
   * missing the new ones — a page titled "the current Ranked rotation" that
   * disagreed with the game.
   *
   * The wiki publishes the pool the day it changes, and this page already
   * fetches it for the season panel, so it costs nothing to make it the
   * authority on membership. Our own samples stay the authority on everything
   * else: which brawlers are strong, and how much evidence is behind that.
   */
  const key = (mode: string, map: string) => `${slugify(mode)}/${slugify(map)}`;
  const sampled = new Map(maps.map((m) => [key(m.mode, m.mapName), m]));

  /*
   * When each map was last played, including maps the rotation cut-off has
   * already dropped. This is what separates "not sampled yet" from "the game
   * rotated this out days ago" — see `getRankedMapLastSeen`.
   */
  const lastSeen = new Map(
    lastSeenRows.map((r) => [key(r.mode, r.mapName), r.lastSeen] as const),
  );

  /*
   * Only trusted when it overlaps what we have sampled. A wiki table that has
   * been restructured, or whose map names have diverged from the API's, would
   * otherwise filter the board down to nothing — an empty page is a worse
   * failure than a slightly stale one.
   */
  const poolMatches = season.mapPool.reduce(
    (n, entry) => n + entry.maps.filter((m) => sampled.has(key(entry.mode, m))).length,
    0,
  );
  const usePool = poolMatches > 0;

  /** One mode's row on the board, in the order the pool lists them. */
  const board = (
    usePool
      ? season.mapPool.map((entry) => ({
          modeSlug: slugify(entry.mode),
          names: entry.maps,
        }))
      : // No usable pool: fall back to grouping whatever has been sampled.
        [...new Set(maps.map((m) => slugify(m.mode)))].map((modeSlug) => ({
          modeSlug,
          names: maps
            .filter((m) => slugify(m.mode) === modeSlug)
            .map((m) => m.mapName),
        }))
  ).map(({ modeSlug, names }) => {
    // The mode id our samples use, taken from a sampled map where there is one
    // and from the map catalogue otherwise — a mode can be in the pool with
    // nothing sampled in it yet.
    const modeId =
      maps.find((m) => slugify(m.mode) === modeSlug)?.mode ??
      activeMaps.find((a) => a.modeSlug === modeSlug)?.scHash ??
      modeSlug;
    const meta = modeMeta.get(modeId.toLowerCase());

    return {
      modeSlug,
      label: meta?.name ?? humanizeMode(modeId),
      icon: meta?.imageUrl,
      accent: meta?.color ?? '#8b95b8',
      maps: names.map((name) => {
        const catalogue = activeMaps.find(
          (a) => a.modeSlug === modeSlug && a.mapSlug === slugify(name),
        );
        const picks = sampled.get(key(modeSlug, name)) ?? null;
        return {
          name: picks?.mapName ?? name,
          picks,
          // Prefer the id recorded on our own battles; fall back to the
          // catalogue, which is the only source for a map with no battles yet.
          art: picks?.eventId ? mapMeta.get(picks.eventId) : catalogue?.map,
          href: catalogue ? `/maps/${catalogue.modeSlug}/${catalogue.mapSlug}` : null,
          lastSeen: lastSeen.get(key(modeSlug, name)) ?? null,
        };
      }),
    };
  });

  const onBoard = board.flatMap((row) => row.maps);
  const totalSamples = onBoard.reduce((sum, m) => sum + (m.picks?.sampleSize ?? 0), 0);
  const baseline = maps[0]?.baselineWinRate ?? 0;
  const rated = onBoard.filter((m) => (m.picks?.picks.length ?? 0) > 0).length;
  // In-page navigation, so a visitor after one mode does not scroll past five.
  const modeNav = board.map((row) => ({
    mode: row.modeSlug,
    label: row.label,
    icon: row.icon,
    color: row.accent,
    count: row.maps.length,
  }));

  return (
    <div className="space-y-10">
      {/*
        Answer first.
        
        The page opened with two paragraphs of scoring methodology and then a
        full-height season panel, so on a phone the first actual recommendation
        was three screens down. Everything is still here — the sentence, the
        counts, the season, the methodology — but in the order the visit
        happens: what this is, how much evidence is behind it, which mode, then
        the picks.
      */}
      <header>
        <p className="eyebrow flex items-center gap-2 text-accent">
          <RankedIcon className="size-4" />
          Competitive only
        </p>
        <h1 className="display mt-2.5 text-3xl uppercase sm:text-4xl">Ranked maps</h1>
        <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">
          The strongest brawlers on each map in the current Ranked rotation, from
          sampled competitive battles only.
        </p>

        {/* Everything needed to judge the numbers below, on one line. */}
        <ul className="mt-4 flex flex-wrap items-center gap-1.5">
          <Fact tone="brand">{formatNumber(totalSamples)} Ranked battles</Fact>
          {lastRun ? (
            <Fact>
              Sampled{' '}
              <RelativeTime
                iso={lastRun.startedAt}
                fallback={relativeTime(lastRun.startedAt)}
              />
            </Fact>
          ) : null}
          {onBoard.length > 0 ? (
            <Fact>
              {rated} of {onBoard.length} maps with a pick
            </Fact>
          ) : null}
        </ul>
      </header>

      {/* Which season it is decides which maps are in the pool at all, so it
          leads. Compressed to a summary row with the detail folded, which is
          what lets it sit here without costing a screen: the old full-height
          panel in this position pushed the first recommendation below the fold
          on a phone. */}
      <SeasonPanel
        state={season}
        mapHref={(mode, map) => {
          // Wiki names are the game's display names, which slug to the same
          // segments our own map routes use — but only link the ones we can
          // actually resolve, so a renamed or retired map is plain text rather
          // than a 404.
          const match = activeMaps.find(
            (entry) =>
              entry.mapSlug === slugify(map) && entry.modeSlug === slugify(mode),
          );
          return match ? `/maps/${match.modeSlug}/${match.mapSlug}` : null;
        }}
      />

      {modeNav.length > 1 ? (
        <nav aria-label="Jump to a mode" className="-mx-4 px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {modeNav.map(({ mode, label, icon, count, color }) => (
              <li key={mode}>
                <a
                  href={`#mode-${mode}`}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition-colors hover:border-brand/50"
                >
                  {icon ? (
                    <Image
                      src={icon}
                      alt=""
                      width={20}
                      height={20}
                      className="size-5 shrink-0 object-contain"
                      unoptimized
                    />
                  ) : null}
                  <span style={{ color }}>{label}</span>
                  <span className="text-xs tabular-nums text-muted">{count}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {onBoard.length === 0 ? (
        <div className="card card-glow mx-auto max-w-xl p-8 text-center">
          <h2 className="display text-xl uppercase">Collecting map data</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Map names are recorded on newly sampled battles only, and the battle log
            reaches back about 25 matches, so this fills in over the next day or two as
            the sampler works through the pool.
          </p>
          <Link
            href="/tier-list/ranked"
            className="mt-6 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >
            See the Ranked tier list
          </Link>
        </div>
      ) : (
        board.map((row) => (
          <section
            key={row.modeSlug}
            aria-labelledby={`mode-${row.modeSlug}`}
            id={`mode-${row.modeSlug}`}
            className="scroll-anchor"
          >
            <h2
              id={`mode-${row.modeSlug}-heading`}
              className="display mb-4 flex items-center gap-2.5 text-2xl uppercase sm:text-3xl"
            >
              {row.icon ? (
                <Image
                  src={row.icon}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 object-contain"
                  unoptimized
                />
              ) : null}
              <span style={{ color: row.accent }}>{row.label}</span>
            </h2>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {row.maps.map((entry) => (
                <li key={`${row.modeSlug}-${entry.name}`}>
                  {entry.picks ? (
                    <MapCard
                      map={entry.picks}
                      art={entry.art}
                      modeLabel={row.label}
                      accent={row.accent}
                      brawlerMeta={brawlerMeta}
                      mapHref={entry.href}
                    />
                  ) : (
                    /* In the pool, not yet in our data. Shown rather than
                       omitted: the board claims to be the current rotation,
                       and a map missing from it reads as "not in Ranked"
                       rather than as "no battles sampled here yet". */
                    <PendingMapCard
                      mapName={entry.name}
                      art={entry.art}
                      modeLabel={row.label}
                      accent={row.accent}
                      mapHref={entry.href}
                      lastSeen={entry.lastSeen}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Disclosure summary="How these picks are chosen">
        <p>
          Trophy-ladder games are excluded entirely. Ranked matchmaking pairs
          comparable opponents, so what is left reflects the brawler rather than who
          was holding it, and Ranked has carried no modifiers since the February 2025
          rework &mdash; every battle counted here is the plain mode on the plain map.
        </p>
        {onBoard.length > 0 ? (
          <p className="mt-2">
            Every map is scored against the same {formatPercent(baseline)} sample-wide
            Ranked average, and each brawler&rsquo;s handful of battles on one map is
            weighed against its overall Ranked form. A map needs real evidence to move
            a brawler off that.
            {rated < onBoard.length
              ? ` ${onBoard.length - rated} of ${onBoard.length} maps cannot support a pick yet, and naming one anyway would be worse than naming none.`
              : ''}
          </p>
        ) : null}
        <p className="mt-2">
          Which maps appear is taken from the season&rsquo;s published pool rather than
          from our own samples, so the board matches the rotation the day it changes.
          Map names are recorded on newly sampled battles only and a battle log reaches
          back about 25 matches, so a map that has just entered the pool carries no
          picks for a day or two after it does.
        </p>
      </Disclosure>
    </div>
  );
}

/** One fact from the data row under the title. */
function Fact({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'brand';
}) {
  return (
    <li
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
        tone === 'brand'
          ? 'bg-brand/15 text-brand'
          : 'border border-border bg-surface-2/60 text-muted'
      }`}
    >
      {children}
    </li>
  );
}

/**
 * A map that is in the season's pool but has no sampled battles yet.
 *
 * Deliberately quiet — no confidence chip, no placeholder numbers, no bars
 * drawn at zero. The card exists to say the map is live and that we have
 * nothing to say about it yet, which is a different statement from the
 * thin-sample cards and should not look like one.
 */
function PendingMapCard({
  mapName,
  art,
  modeLabel,
  accent,
  mapHref,
  lastSeen,
}: {
  mapName: string;
  art?: BAMap;
  modeLabel: string;
  accent: string;
  mapHref: string | null;
  /** ISO timestamp of the last sampled battle here, or null if never seen. */
  lastSeen: string | null;
}) {
  /*
   * Two different situations, and only one of them is going to change.
   *
   * A map with no sighting at all is genuinely waiting for data. A map that
   * was played and then stopped has been rotated out by the game — the season
   * pool this board is built from lists every map of the season, and Brawl
   * Stars plays a subset of it at a time. Saying "yet" about the second kind
   * promises data that is not coming.
   */
  const rotatedOut = lastSeen !== null;
  const since = lastSeen
    ? new Date(lastSeen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;
  return (
    <article className="card flex h-full flex-col overflow-hidden opacity-80">
      <MapPreview
        imageUrl={art?.imageUrl}
        mapName={mapName}
        modeLabel={modeLabel}
        accent={accent}
      />

      <div className="border-y border-border px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="display min-w-0 flex-1 truncate text-base leading-tight">
            {mapHref ? (
              <Link href={mapHref} className="hover:text-brand">
                {mapName}
              </Link>
            ) : (
              mapName
            )}
          </h3>
          <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted">
            New this season
          </span>
        </div>
        <p className="mt-1.5 text-xs uppercase tracking-wide text-muted">
          {rotatedOut ? `Out of rotation · last played ${since}` : 'No sampled battles yet'}
        </p>
      </div>

      <p className="flex-1 px-3.5 py-4 text-xs leading-relaxed text-muted">
        In the season pool, but nobody we sample has played it yet. A battle log
        reaches back about 25 matches, so this fills in over the next day or two.
      </p>
    </article>
  );
}

function MapCard({
  map,
  art,
  modeLabel,
  accent,
  brawlerMeta,
  mapHref,
}: {
  map: RankedMapPicks;
  art?: BAMap;
  modeLabel: string;
  accent: string;
  brawlerMeta: Map<number, BABrawler>;
  mapHref: string | null;
}) {
  return (
    <article className="card flex h-full flex-col overflow-hidden">
      {/* The map itself gets the top of the card, drawn whole rather than
          cropped: a Brawl Stars map is read by its layout, and the old
          faded-and-cropped banner made every card look alike. */}
      <MapPreview
        imageUrl={art?.imageUrl}
        mapName={map.mapName}
        modeLabel={modeLabel}
        accent={accent}
      />

      <div className="border-y border-border px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="display min-w-0 flex-1 truncate text-base leading-tight">
            {/* The card is a summary; the map's own page is the full ranking,
                the layout at size and the answer to the search that brings
                people here. Absent when the map is out of rotation, since
                there is no page to send them to. */}
            {mapHref ? (
              <Link href={mapHref} className="hover:text-brand">
                {map.mapName}
              </Link>
            ) : (
              map.mapName
            )}
          </h3>
          {/* Deliberately quiet at "low": a caveat should not be the brightest
              thing on the card, and right now every map carries one. It picks
              up the mode colour once the map has earned it. */}
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={
              map.confidence === 'low'
                ? { color: 'var(--muted)', background: 'var(--surface-2)' }
                : { color: accent, background: `color-mix(in srgb, ${accent} 16%, transparent)` }
            }
          >
            {CONFIDENCE_LABEL[map.confidence]}
          </span>
        </div>
        <p className="mt-1.5 text-xs uppercase tracking-wide text-muted">
          {formatNumber(map.sampleSize)} ranked battles · {map.brawlersSeen} brawlers
          seen
        </p>
      </div>

      {map.picks.length === 0 ? (
        /* Naming a "best pick" the sample cannot support is worse than naming
           none, so a thin map says so instead of ranking noise. */
        <p className="flex-1 px-3.5 py-4 text-xs leading-relaxed text-muted">
          No brawler is clearly above average here yet. The map has been sampled{' '}
          {formatNumber(map.sampleSize)} times, spread across {map.brawlersSeen}{' '}
          brawlers. Not enough for any one of them to separate from the pack.
        </p>
      ) : (
        <ol className="flex-1 divide-y divide-border">
          {map.picks.map((pick, index) => {
            const meta = brawlerMeta.get(pick.brawlerId);
            // Positive means the brawler does better here than it does in
            // Ranked overall, which is the only genuinely map-specific claim
            // on the card.
            const edge = pick.score - pick.overallScore;

            return (
              <li key={pick.brawlerId}>
                <Link
                  href={brawlerPath(pick.brawlerId, pick.brawlerName)}
                  title={`${pick.brawlerName}: ${formatPercent(pick.winRate)} raw win rate over ${pick.decidedSampleSize} sampled Ranked battles on this map, against ${formatPercent(pick.overallScore)} adjusted form over ${formatNumber(pick.overallSampleSize)} Ranked battles overall`}
                  className="row-interactive flex items-center gap-2.5 px-3.5 py-2"
                >
                  <span className="w-3 shrink-0 text-center text-xs font-black tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <Image
                    src={meta?.imageUrl ?? brawlerIconUrl(pick.brawlerId)}
                    alt=""
                    width={30}
                    height={30}
                    className="size-[30px] shrink-0 rounded-md bg-surface-2"
                    loading="lazy"
                    unoptimized
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold capitalize">
                      {pick.brawlerName.toLowerCase()}
                    </span>
                    {/* Sample size is never hidden: on a per-map split it is
                        the difference between a signal and a coin flip. */}
                    <span className="block text-xs tabular-nums text-muted">
                      {pick.decidedSampleSize} battles here
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {/* The adjusted score, not the raw rate: ranking is by
                        adjusted score, and printing the raw one makes the
                        column read as mis-sorted whenever a five-battle
                        sample had a flattering record. */}
                    <span className="block text-xs font-bold tabular-nums text-victory">
                      {formatPercent(pick.score)}
                    </span>
                    {/* Signed both ways. A pick can still be worth listing
                        while doing slightly worse here than it does in Ranked
                        generally, and hiding that half of the comparison was
                        what made the column unreadable. */}
                    <span
                      className={`block text-xs tabular-nums ${
                        edge >= 0.005 ? 'text-victory/80' : 'text-muted'
                      }`}
                    >
                      {edge >= 0.005 ? '+' : edge <= -0.005 ? '−' : '±'}
                      {Math.abs(edge * 100).toFixed(1)} vs usual
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
