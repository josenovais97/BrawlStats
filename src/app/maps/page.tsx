import type { Metadata } from 'next';

import Link from 'next/link';

import { MapArt } from '@/components/maps/map-art';
import { MapCatalogue } from '@/components/maps/map-catalogue';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { getEventRotation } from '@/lib/bs-api';
import { MapsIcon } from '@/components/game-icons';
import { getActiveMaps, groupByMode, type GameMap } from '@/lib/game-maps';
import { getSeasonState } from '@/lib/ranked-seasons';
import { currentMonth } from '@/lib/site';
import { slugify } from '@/lib/slugs';

/* Generated rather than static, for the month — see the brawler index. */
export function generateMetadata(): Metadata {
  return {
    title: `Brawl Stars maps and best brawlers (${currentMonth()})`,
    description: `Every active Brawl Stars map, grouped by game mode, with the strongest brawlers on each one ranked from sampled battles, ${currentMonth()}.`,
    alternates: { canonical: '/maps' },
  };
}

/*
 * One hour, and it says one hour because that is what it is.
 *
 * This declared 86400 while `ROTATION_REVALIDATE` below held the route to
 * 3600 — the comment there already knew the rotation call decides the page,
 * but the declaration was never brought into line, so the file claimed a day
 * and delivered an hour. Harmless in cost (this is one URL) and misleading to
 * read, which is the failure mode the whole trap is about: a declaration is
 * not evidence, and one that disagrees with the served `s-maxage` is worse
 * than none.
 *
 * An hour is the right number. The artwork is static and the per-map figures
 * live on the map pages, but the catalogue also marks what is live right now,
 * and that is worth an hour rather than a day.
 */
export const revalidate = 3600;

/** Must match `revalidate` above: this is the call that decides the route. */
const ROTATION_REVALIDATE = 3600;

export default async function MapsIndexPage() {
  const maps = await getActiveMaps().catch(() => []);

  /*
   * Three genuinely different things, kept apart because they were previously
   * conflated into one false claim.
   *
   * - live: what the official rotation says is playable this minute.
   * - ranked: the wiki's published pool for the current Ranked season.
   * - catalogue: every non-retired map. NOT "in rotation" — brawlapi reports
   *   `lastActive: 0` for all four hundred of them, so nothing in that feed
   *   distinguishes a map in today's rotation from one that has not appeared
   *   in months.
   */
  const [rotation, season] = await Promise.all([
    getEventRotation(ROTATION_REVALIDATE).catch(() => []),
    getSeasonState().catch(() => null),
  ]);

  const byRoute = new Map(maps.map((entry) => [`${entry.modeSlug}/${entry.mapSlug}`, entry]));
  const pick = (mode: string, map: string) => byRoute.get(`${slugify(mode)}/${slugify(map)}`);

  const live: GameMap[] = [];
  const liveSeen = new Set<string>();
  for (const slot of rotation) {
    if (!slot.event.map || !slot.event.mode) continue;
    const entry = pick(slot.event.mode, slot.event.map);
    if (!entry || liveSeen.has(entry.mapSlug + entry.modeSlug)) continue;
    liveSeen.add(entry.mapSlug + entry.modeSlug);
    live.push(entry);
  }

  const rankedPool: GameMap[] = [];
  for (const group of season?.mapPool ?? []) {
    for (const map of group.maps) {
      const entry = pick(group.mode, map);
      if (entry) rankedPool.push(entry);
    }
  }

  const groups = groupByMode(maps);

  return (
    <div className="space-y-10">
      <JsonLd data={breadcrumbSchema([{ name: 'Maps', path: '/maps' }])} />

      <PageHeading
        title="Maps"
        subtitle="What is live right now, this season's Ranked pool, and the full catalogue of maps still in the game. Each map page ranks the brawlers with the best records on it, from sampled battles."
        aside={
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <MapsIcon className="size-4" />
            {maps.length} maps
          </span>
        }
      />

      {live.length > 0 ? (
        <MapStrip
          id="live"
          title="Live now"
          subtitle="In the event rotation this minute, straight from the game API."
          maps={live}
        />
      ) : null}

      {rankedPool.length > 0 ? (
        <MapStrip
          id="ranked-pool"
          title={`Ranked pool${season?.current ? ` · season ${season.current.number}` : ''}`}
          subtitle="The competitive map pool for the current Ranked season. Fixed until the season turns over."
          maps={rankedPool}
        />
      ) : null}

      {groups.length === 0 ? (
        <p className="card p-6 text-sm text-muted">The map catalogue is unavailable right now.</p>
      ) : (
        <div>
          <SectionHeading
            title="Full catalogue"
            subtitle="Every map still in the game, by mode. Search by name, or open a mode to see its maps. Not a rotation: the artwork source publishes no last-played date, so this cannot say which of these are live today. The two sections above can."
          />
          {/*
            Only the fields a card draws cross to the client. The full BAMap
            payload is a few hundred bytes per map and there are four hundred
            of them, which would have been the largest thing on the page.
          */}
          <MapCatalogue
            groups={groups.map((group) => ({
              mode: group.mode,
              label: group.label,
              maps: group.maps.map((entry) => ({
                id: entry.map.id,
                name: entry.map.name,
                modeSlug: entry.modeSlug,
                mapSlug: entry.mapSlug,
                imageUrl: entry.map.imageUrl,
              })),
            }))}
          />
        </div>
      )}
    </div>
  );
}

/** A flat, horizontally-scrolling row of maps, for the two real rotations. */
function MapStrip({
  id,
  title,
  subtitle,
  maps,
}: {
  id: string;
  title: string;
  subtitle: string;
  maps: GameMap[];
}) {
  return (
    <section aria-labelledby={id}>
      <div id={id}>
        <SectionHeading title={title} subtitle={subtitle} aside={`${maps.length} maps`} />
      </div>
      {/* Scrolls rather than wraps: these are short, ordered lists and a grid
          of eight would push the catalogue below the fold on a phone. */}
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {maps.map((entry) => (
          <li key={`${entry.modeSlug}-${entry.mapSlug}`} className="w-36 shrink-0 snap-start">
            <Link
              href={`/maps/${entry.modeSlug}/${entry.mapSlug}`}
              className="card card-interactive group block h-full overflow-hidden"
            >
              <MapArt src={entry.map.imageUrl} alt="" height="h-28" sizes="144px" />
              <span className="block truncate px-3 pt-2 text-sm font-semibold">
                {entry.map.name}
              </span>
              <span className="block truncate px-3 pb-2 text-[0.6875rem] uppercase tracking-wide text-muted">
                {entry.mode?.name ?? entry.map.gameMode.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
