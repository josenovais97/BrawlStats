import type { Metadata } from 'next';
import { ArrowRight, Target, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BrawlerChooser } from '@/components/draft/brawler-chooser';
import { DraftPicks } from '@/components/draft/draft-picks';
import { MapArt } from '@/components/maps/map-art';
import { RankedIcon } from '@/components/game-icons';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl, getGameModeMap } from '@/lib/brawlapi';
import { formatNumber, humanizeMode } from '@/lib/format';
import { getBrawlerArtMap, getBrawlerCatalog } from '@/lib/brawler-catalog';
import { CompShape } from '@/components/draft/comp-shape';
import { getActiveMaps, type GameMap } from '@/lib/game-maps';
import { MAX_ENEMIES, draftHref, resolveDraftRoute } from '@/lib/draft-route';

/**
 * How many team-mates a draft can name.
 *
 * Two, not three: a 3v3 team is you and two others, and the third slot is the
 * pick this page exists to make. `MAX_ENEMIES` is three because all three of
 * theirs are somebody else's.
 */
const MAX_ALLIES = 2;
import { slugify } from '@/lib/slugs';
import { RANKED_MAP_WINDOW_DAYS, getAllyScores, getBestPicksByMode, getCounterScores, getRankedMapPicks, getRoleCompositions } from '@/lib/stats';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { ModePick, RankedMapPick, RankedMapPicks } from '@/types/stats';

interface PageProps {
  params: Promise<{ state?: string[] }>;
}

/**
 * Only the bare board is a document; every picked state is working state.
 *
 * Self-canonical and `noindex` for anything below `/draft`, which matches what
 * `/compare/[pair]` and `/compare/players/[a]/[b]` already do. `robots.txt`
 * blocks these paths outright and is what actually saves the render — this is
 * the belt to that pair of braces, for a crawler that ignores robots.txt and
 * for anything that reaches a state by other means.
 *
 * `follow: false` as well as `index: false`, unlike the compare routes: those
 * link outward to pages worth discovering, whereas every link on a picked
 * draft state points at another draft state.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state } = await params;
  const picked = (state ?? []).length > 0;

  return {
    title: 'Brawl Stars draft helper. Pick against the enemy team',
    description:
      'Pick a Ranked map, name the brawlers the enemy has drafted, and see which brawlers have the best record on that map against that line-up.',
    alternates: { canonical: '/draft' },
    ...(picked ? { robots: { index: false, follow: false } } : {}),
  };
}

export const revalidate = 3600;

/*
 * Only the bare board is built ahead of time; every picked state renders on
 * first visit and is cached from then on. Returning a param rather than an
 * empty array is what prerenders `/draft` itself, which is the URL that is
 * linked, indexed and crawled.
 */
export async function generateStaticParams() {
  return [{ state: [] as string[] }];
}

/** How many candidates to show. */
const CANDIDATES = 12;

/**
 * How many to *consider* before the line-ups reorder them.
 *
 * Wider than `CANDIDATES` on purpose, and the distinction is the whole feature.
 * Both pick queries cap what they return, so fetching `CANDIDATES` and then
 * slicing to `CANDIDATES` after reordering made that slice a no-op: the counter
 * and ally edges could only permute the map's top twelve. A brawler that hard-
 * counters the enemy comp but sits thirteenth on the map could never appear,
 * which is precisely the recommendation somebody opens this page for.
 *
 * Forty rather than everything because `getRankedMapPicks` publishes only picks
 * above the map's baseline, so this is closer to "all of them" than it looks.
 * With no enemies or allies named, every edge is zero and the order is
 * unchanged from the map's own ranking — widening costs nothing there.
 */
const POOL = 40;

export default async function DraftPage({ params }: PageProps) {
  const { state } = await params;
  const route = resolveDraftRoute(state);
  // A path shape the tool does not have. See `resolveDraftRoute`.
  if (!route) notFound();

  /*
   * The map list is the Ranked pool, not the whole catalogue.
   *
   * It used to be every active map — four hundred of them across forty-one
   * modes, rendered as a wall of text links, for a tool that only works on the
   * six competitive modes. `getRankedMapPicks` already returns exactly the maps
   * in the current rotation with sampled data behind them, which is both the
   * right list and a twelfth of the length.
   */
  const [pool, catalogue, brawlerMeta, modeMeta] = await Promise.all([
    getRankedMapPicks(POOL, RANKED_MAP_WINDOW_DAYS).catch(() => []),
    getActiveMaps().catch(() => []),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
  ]);

  // Only brawlers you can actually field. The artwork mirror still lists
  // withdrawn ones, and offering Buzz Lightyear as an enemy pick is offering a
  // draft nobody can face.
  const catalog = await getBrawlerCatalog();

  const artFor = (map: RankedMapPicks): GameMap | undefined =>
    catalogue.find((entry) => entry.mapSlug === slugify(map.mapName) && entry.scHash === map.mode);

  const selected = route.mapSlug
    ? (pool.find(
        (map) =>
          slugify(map.mapName) === route.mapSlug &&
          (!route.modeSlug || slugify(map.mode) === route.modeSlug),
      ) ?? null)
    : null;

  // A map segment naming no map in the Ranked pool is a URL that does not
  // address anything, the same judgement `/maps/[mode]/[map]` makes.
  if (route.mapSlug && !selected) notFound();

  const enemies = route.enemies;
  const allies = route.allies;

  // Sequential database reads keep the page to a single connection.
  const modePicks = selected
    ? await getBestPicksByMode(POOL)
        .then((byMode) => byMode.get(selected.mode) ?? null)
        .catch(() => null)
    : null;
  // Sequential, like every other read here, so the page holds one connection.
  const counters = await getCounterScores(enemies);
  const synergies = await getAllyScores(allies);
  /*
   * Team shape, at role level. Sequential like the reads above so the page
   * holds one connection, and cached so it costs one query per window rather
   * than one per draft.
   */
  const roleComps = await getRoleCompositions().catch(() => null);

  // The map's own ranking is the starting order; the enemy line-up reorders it.
  // Both halves stay visible on the row, because "good here" and "good against
  // them" are different claims and someone drafting in ninety seconds needs to
  // see which one is carrying the recommendation.
  const basePicks: (ModePick | RankedMapPick)[] =
    (selected?.picks.length ?? 0) > 0 ? selected!.picks : (modePicks?.picks ?? []);

  /*
   * The roster as the picker needs it, with the map's own pick order attached.
   *
   * That rank is what makes the "best here" shortcut possible: it is already
   * computed for the results below, so surfacing the same order at the top of
   * the picker costs nothing and saves the common case — most drafts choose
   * from the handful of brawlers that are actually good on the map in front of
   * you, not from all 109.
   */
  const pickRank = new Map(basePicks.map((pick, index) => [pick.brawlerId, index + 1]));
  const chooserOptions = catalog.current.map((brawler) => ({
    id: brawler.id,
    name: brawler.name,
    imageUrl: brawler.meta?.imageUrl ?? brawler.imageUrl,
    rank: pickRank.get(brawler.id),
  }));

  const ranked = basePicks
    .map((pick) => {
      const counter = counters.get(pick.brawlerId);
      const synergy = synergies.get(pick.brawlerId);
      return {
        pick,
        counter,
        synergy,
        /*
         * Half a point of counter edge is worth about as much as half a point
         * of map score, so they are simply added. Nothing subtler is defensible
         * on samples this size, and the same holds for the ally edge — both are
         * measured the same way, against the brawler's own overall rate, so
         * they are already on one scale.
         */
        total: pick.score + (counter?.edge ?? 0) + (synergy?.edge ?? 0),
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, CANDIDATES);

  const hrefFor = (next: { enemy?: number[]; ally?: number[] }) =>
    draftHref({
      mode: selected?.mode,
      map: selected?.mapName,
      enemies: next.enemy ?? enemies,
      allies: next.ally ?? allies,
    });

  return (
    <div className="space-y-8">
      <JsonLd data={breadcrumbSchema([{ name: 'Draft helper', path: '/draft' }])} />

      <PageHeading
        title="Draft helper"
        subtitle="Pick the map, name what the enemy has taken, and the list reorders around both. Every state is its own URL, so a draft can be shared or kept open on a second screen."
        aside={
          <Link
            href="/ranked"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <RankedIcon className="size-4" />
            Ranked pool
          </Link>
        }
      />

      {pool.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          No Ranked maps have enough sampled battles yet. The sampler works through the leaderboard
          pool continuously, so this fills in over the next day or two.
        </p>
      ) : !selected ? (
        <MapChooser pool={pool} artFor={artFor} modeMeta={modeMeta} />
      ) : (
        <>
          <SelectedMap map={selected} art={artFor(selected)} modeMeta={modeMeta} />

          <section>
            <StepHeading
              step={2}
              title="Enemy team"
              hint={`Up to ${MAX_ENEMIES}. Each one reweighs the list by how candidates actually do against it.`}
            />

            <div className="card p-4">
              {/* Sticky, because the slots are the thing you are filling in and the
                  picker below is long enough to push them off a phone screen. `top-16`
                  clears the site header, which is sticky too. */}
              <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 bg-surface px-4 py-2">
                {Array.from({ length: MAX_ENEMIES }).map((_, slot) => {
                  const id = enemies[slot];
                  const meta = id ? brawlerMeta.get(id) : undefined;

                  // Three fixed slots rather than a growing list: a Ranked
                  // draft has exactly three enemies, and empty slots show how
                  // much of the picture is still missing.
                  return id ? (
                    <Link
                      key={slot}
                      href={hrefFor({
                        enemy: enemies.filter((other) => other !== id),
                      })}
                      rel="nofollow"
                      prefetch={false}
                      title={`Remove ${meta?.name ?? id}`}
                      className="group flex items-center gap-2 rounded-xl border border-defeat/40 bg-defeat/10 px-2.5 py-2 text-sm font-semibold capitalize"
                    >
                      <Image
                        src={meta?.imageUrl ?? brawlerIconUrl(id)}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 rounded-lg"
                        unoptimized
                      />
                      {(meta?.name ?? `#${id}`).toLowerCase()}
                      <X className="size-4 text-muted transition-colors group-hover:text-defeat" />
                    </Link>
                  ) : (
                    <span
                      key={slot}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-border px-2.5 py-2 text-sm text-muted"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-surface-2">
                        <Target className="size-4" />
                      </span>
                      Empty slot
                    </span>
                  );
                })}

                {enemies.length > 0 ? (
                  <Link
                    href={hrefFor({ enemy: [] })}
                    rel="nofollow"
                    prefetch={false}
                    className="ml-auto text-sm font-medium text-muted hover:text-foreground"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>

              {enemies.length < MAX_ENEMIES ? (
                <BrawlerChooser
                  options={chooserOptions}
                  taken={[...enemies, ...allies]}
                  label="Add an enemy brawler"
                  suggestedLabel="Most likely picks here"
                  hrefs={Object.fromEntries(
                    catalog.current.map((b) => [b.id, hrefFor({ enemy: [...enemies, b.id] })]),
                  )}
                />
              ) : null}
            </div>
          </section>

          <section>
            <StepHeading
              step={3}
              title="Your team"
              hint={`Up to ${MAX_ALLIES}. Each one reweighs the list by how candidates actually do *beside* it, which is a different question from countering.`}
            />

            <div className="card p-4">
              {/* Sticky, because the slots are the thing you are filling in and the
                  picker below is long enough to push them off a phone screen. `top-16`
                  clears the site header, which is sticky too. */}
              <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 bg-surface px-4 py-2">
                {Array.from({ length: MAX_ALLIES }).map((_, slot) => {
                  const id = allies[slot];
                  const meta = id ? brawlerMeta.get(id) : undefined;

                  return id ? (
                    <Link
                      key={slot}
                      href={hrefFor({
                        ally: allies.filter((other) => other !== id),
                      })}
                      rel="nofollow"
                      prefetch={false}
                      title={`Remove ${meta?.name ?? id}`}
                      className="group flex items-center gap-2 rounded-xl border border-victory/40 bg-victory/10 px-2.5 py-2 text-sm font-semibold capitalize"
                    >
                      <Image
                        src={meta?.imageUrl ?? brawlerIconUrl(id)}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 rounded-lg"
                        unoptimized
                      />
                      {(meta?.name ?? `#${id}`).toLowerCase()}
                      <X className="size-4 text-muted transition-colors group-hover:text-victory" />
                    </Link>
                  ) : (
                    <span
                      key={slot}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-border px-2.5 py-2 text-sm text-muted"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-surface-2">
                        <Target className="size-4" />
                      </span>
                      Empty slot
                    </span>
                  );
                })}

                {allies.length > 0 ? (
                  <Link
                    href={hrefFor({ ally: [] })}
                    rel="nofollow"
                    prefetch={false}
                    className="ml-auto text-sm font-medium text-muted hover:text-foreground"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>

              {allies.length < MAX_ALLIES ? (
                <BrawlerChooser
                  options={chooserOptions}
                  taken={[...enemies, ...allies]}
                  label="Add a team-mate"
                  suggestedLabel="Best here"
                  hrefs={Object.fromEntries(
                    catalog.current.map((b) => [b.id, hrefFor({ ally: [...allies, b.id] })]),
                  )}
                />
              ) : null}
            </div>
          </section>

          {/* After the team is named and before the recommendations: three
              individually good picks can still be three assassins with no way
              to hold a zone, and that is the one thing the rows below cannot
              say. */}
          {roleComps ? (
            <CompShape
              allies={allies}
              roleOf={new Map(catalog.all.map((b) => [b.id, b.className]))}
              comps={roleComps.comps}
            />
          ) : null}

          <section>
            <StepHeading
              step={4}
              title="Your pick"
              hint={
                enemies.length > 0 && allies.length > 0
                  ? 'Map score, plus how each candidate does against their picks and beside yours.'
                  : enemies.length > 0
                    ? 'Map score plus how each candidate does against the brawlers you named.'
                    : allies.length > 0
                      ? 'Map score plus how each candidate does beside your team-mates.'
                      : 'Ranked by record on this map. Name either team above to reweigh it.'
              }
            />

            {ranked.length === 0 ? (
              <p className="card p-6 text-sm leading-relaxed text-muted">
                No sampled battles for this map or mode yet.
              </p>
            ) : (
              /* Client-side because the "brawlers I own" filter reads a roster
                 kept in the visitor's own browser. Only the fields a row draws
                 cross the boundary. */
              <DraftPicks
                hasEnemies={enemies.length > 0}
                picks={ranked.map(({ pick, counter }) => ({
                  brawlerId: pick.brawlerId,
                  brawlerName: pick.brawlerName,
                  iconUrl:
                    brawlerMeta.get(pick.brawlerId)?.imageUrl ?? brawlerIconUrl(pick.brawlerId),
                  score: pick.score,
                  decidedSampleSize: pick.decidedSampleSize,
                  edge: counter ? counter.edge : null,
                }))}
              />
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted">
              Map score is a brawler&rsquo;s adjusted win rate here, weighed against its overall
              Ranked form. The matchup figure is its win rate when one of the brawlers you named was
              on the other team, minus its own average. So a brawler that simply wins a lot does not
              appear to counter everything.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function StepHeading({
  step,
  title,
  hint,
  aside,
}: {
  step: number;
  title: string;
  hint: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand text-sm font-black text-brand-ink">
          {step}
        </span>
        <div>
          <h2 className="display text-xl uppercase leading-none">{title}</h2>
          <p className="mt-1.5 max-w-xl text-sm text-muted">{hint}</p>
        </div>
      </div>
      {aside}
    </div>
  );
}

/** The chosen map, with its art and what is behind its ranking. */
function SelectedMap({
  map,
  art,
  modeMeta,
}: {
  map: RankedMapPicks;
  art?: GameMap;
  modeMeta: Map<string, BAGameMode>;
}) {
  const mode = modeMeta.get(map.mode.toLowerCase());
  const accent = mode?.color ?? '#8b95b8';

  return (
    <section>
      <StepHeading
        step={1}
        title="Map"
        hint="The Ranked rotation only. Every map here has sampled competitive battles behind it."
        aside={
          <Link href="/draft" className="text-sm font-medium text-muted hover:text-foreground">
            Change map
          </Link>
        }
      />

      <div className="card overflow-hidden">
        <span className="block h-1 w-full" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-4 p-4">
          {art?.map.imageUrl ? (
            <MapArt
              src={art.map.imageUrl}
              alt={`${map.mapName} map layout`}
              height="h-24"
              sizes="140px"
              className="w-32 shrink-0 rounded-xl"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
              {mode?.name ?? humanizeMode(map.mode)}
            </p>
            <h3 className="display mt-1 truncate text-2xl uppercase">{map.mapName}</h3>
            <p className="mt-1 text-sm text-muted">
              {formatNumber(map.sampleSize)} sampled Ranked battles · {map.brawlersSeen} brawlers
              seen
            </p>
          </div>

          {art ? (
            <Link
              href={`/maps/${art.modeSlug}/${art.mapSlug}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
            >
              Map page
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Map picker: the Ranked pool as cards, grouped by mode. */
function MapChooser({
  pool,
  artFor,
  modeMeta,
}: {
  pool: RankedMapPicks[];
  artFor: (map: RankedMapPicks) => GameMap | undefined;
  modeMeta: Map<string, BAGameMode>;
}) {
  const byMode = new Map<string, RankedMapPicks[]>();
  for (const map of pool) {
    const list = byMode.get(map.mode) ?? [];
    list.push(map);
    byMode.set(map.mode, list);
  }

  return (
    <section>
      <StepHeading
        step={1}
        title="Pick the map"
        hint="The current Ranked rotation. Everything after this step follows from it."
      />

      <div className="space-y-6">
        {[...byMode].map(([mode, list]) => {
          const meta = modeMeta.get(mode.toLowerCase());
          const accent = meta?.color ?? '#8b95b8';

          return (
            <div key={mode}>
              <h3
                className="mb-2.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide"
                style={{ color: accent }}
              >
                {meta?.imageUrl ? (
                  <Image
                    src={meta.imageUrl}
                    alt=""
                    width={20}
                    height={20}
                    className="size-5 object-contain"
                    unoptimized
                  />
                ) : null}
                {meta?.name ?? humanizeMode(mode)}
              </h3>

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((map) => {
                  const art = artFor(map);
                  return (
                    <li key={`${map.mode}-${map.mapName}`}>
                      <Link
                        href={draftHref({ mode: map.mode, map: map.mapName })}
                        rel="nofollow"
                        prefetch={false}
                        className="card card-interactive group block h-full overflow-hidden"
                      >
                        <MapArt
                          src={art?.map.imageUrl}
                          alt=""
                          height="h-28"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
                        />
                        <span className="block truncate px-3 pt-2 text-sm font-semibold">
                          {map.mapName}
                        </span>
                        <span className="block px-3 pb-2 text-xs tabular-nums text-muted">
                          {formatNumber(map.sampleSize)} battles
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
