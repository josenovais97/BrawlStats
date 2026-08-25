import type { Metadata } from 'next';
import { ArrowRight, Target, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DraftPicks } from '@/components/draft/draft-picks';
import { MapArt } from '@/components/maps/map-art';
import { RankedIcon } from '@/components/game-icons';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl, getBrawlerMap, getGameModeMap } from '@/lib/brawlapi';
import { formatNumber, humanizeMode } from '@/lib/format';
import { getBrawlerCatalog, type CatalogBrawler } from '@/lib/brawler-catalog';
import { getActiveMaps, type GameMap } from '@/lib/game-maps';
import { MAX_ENEMIES, draftHref, resolveDraftRoute } from '@/lib/draft-route';
import { slugify } from '@/lib/slugs';
import {
  RANKED_MAP_WINDOW_DAYS,
  getBestPicksByMode,
  getCounterScores,
  getRankedMapPicks,
} from '@/lib/stats';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { ModePick, RankedMapPick, RankedMapPicks } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Brawl Stars draft helper. Pick against the enemy team',
  description:
    'Pick a Ranked map, name the brawlers the enemy has drafted, and see which brawlers have the best record on that map against that line-up.',
  // Self-canonical, and deliberately so: every map and enemy combination is
  // its own URL — that is the point of the tool — but only the empty state is
  // worth indexing. The rest are a tool's working state, not documents.
  alternates: { canonical: '/draft' },
};

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

/** How many candidates to rank. */
const CANDIDATES = 12;

interface PageProps {
  params: Promise<{ state?: string[] }>;
}

export default async function DraftPage({ params }: PageProps) {
  const { state } = await params;
  const route = resolveDraftRoute(state);

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
    getRankedMapPicks(CANDIDATES, RANKED_MAP_WINDOW_DAYS).catch(() => []),
    getActiveMaps().catch(() => []),
    getBrawlerMap().catch(() => new Map<number, BABrawler>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
  ]);

  // Only brawlers you can actually field. The artwork mirror still lists
  // withdrawn ones, and offering Buzz Lightyear as an enemy pick is offering a
  // draft nobody can face.
  const catalog = await getBrawlerCatalog();

  const artFor = (map: RankedMapPicks): GameMap | undefined =>
    catalogue.find(
      (entry) => entry.mapSlug === slugify(map.mapName) && entry.scHash === map.mode,
    );

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

  // Sequential database reads keep the page to a single connection.
  const modePicks = selected
    ? await getBestPicksByMode(CANDIDATES)
        .then((byMode) => byMode.get(selected.mode) ?? null)
        .catch(() => null)
    : null;
  const counters = await getCounterScores(enemies);

  // The map's own ranking is the starting order; the enemy line-up reorders it.
  // Both halves stay visible on the row, because "good here" and "good against
  // them" are different claims and someone drafting in ninety seconds needs to
  // see which one is carrying the recommendation.
  const basePicks: (ModePick | RankedMapPick)[] =
    (selected?.picks.length ?? 0) > 0 ? selected!.picks : (modePicks?.picks ?? []);

  const ranked = basePicks
    .map((pick) => {
      const counter = counters.get(pick.brawlerId);
      return {
        pick,
        counter,
        // Half a point of counter edge is worth about as much as half a point
        // of map score, so they are simply added. Nothing subtler is defensible
        // on samples this size.
        total: pick.score + (counter?.edge ?? 0),
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, CANDIDATES);

  const hrefFor = (next: { enemy?: number[] }) =>
    draftHref({
      mode: selected?.mode,
      map: selected?.mapName,
      enemies: next.enemy ?? enemies,
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
          No Ranked maps have enough sampled battles yet. The sampler works through the
          leaderboard pool continuously, so this fills in over the next day or two.
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
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: MAX_ENEMIES }).map((_, slot) => {
                  const id = enemies[slot];
                  const meta = id ? brawlerMeta.get(id) : undefined;

                  // Three fixed slots rather than a growing list: a Ranked
                  // draft has exactly three enemies, and empty slots show how
                  // much of the picture is still missing.
                  return id ? (
                    <Link
                      key={slot}
                      href={hrefFor({ enemy: enemies.filter((other) => other !== id) })}
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
                    className="ml-auto text-sm font-medium text-muted hover:text-foreground"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>

              {enemies.length < MAX_ENEMIES ? (
                <EnemyChooser
                  options={catalog.current}
                  enemies={enemies}
                  hrefFor={hrefFor}
                />
              ) : null}
            </div>
          </section>

          <section>
            <StepHeading
              step={3}
              title="Your pick"
              hint={
                enemies.length > 0
                  ? 'Map score plus how each candidate does against the brawlers you named.'
                  : 'Ranked by record on this map. Add enemy picks above to reweigh it.'
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
                    brawlerMeta.get(pick.brawlerId)?.imageUrl ??
                    brawlerIconUrl(pick.brawlerId),
                  score: pick.score,
                  decidedSampleSize: pick.decidedSampleSize,
                  edge: counter ? counter.edge : null,
                }))}
              />
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted">
              Map score is a brawler&rsquo;s adjusted win rate here, weighed against its
              overall Ranked form. The matchup figure is its win rate when one of the
              brawlers you named was on the other team, minus its own average. So a
              brawler that simply wins a lot does not appear to counter everything.
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
          <Link
            href="/draft"
            className="text-sm font-medium text-muted hover:text-foreground"
          >
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
              {formatNumber(map.sampleSize)} sampled Ranked battles ·{' '}
              {map.brawlersSeen} brawlers seen
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
                        <span className="block px-3 pb-2 text-[0.625rem] tabular-nums text-muted">
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

/**
 * Enemy picker: the roster as a labelled grid.
 *
 * Named tiles rather than a bare wall of portraits — a hundred unlabelled
 * icons is a memory test, and the whole point of this step is finding one
 * specific brawler quickly. Capped in height so it never buries the result
 * list underneath it.
 */
function EnemyChooser({
  options: pool,
  enemies,
  hrefFor,
}: {
  options: CatalogBrawler[];
  enemies: number[];
  hrefFor: (next: { enemy?: number[] }) => string;
}) {
  const options = pool
    .filter((brawler) => !enemies.includes(brawler.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">
        Add an enemy brawler
      </p>
      <ul className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-8">
        {options.map((brawler) => (
          <li key={brawler.id}>
            <Link
              href={hrefFor({ enemy: [...enemies, brawler.id] })}
              className="flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
            >
              <Image
                src={brawler.meta?.imageUrl ?? brawlerIconUrl(brawler.id)}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0"
                loading="lazy"
                unoptimized
              />
              <span className="w-full truncate text-center text-[0.625rem] font-medium capitalize text-muted">
                {brawler.name.toLowerCase()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
