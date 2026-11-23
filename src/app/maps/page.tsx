import type { Metadata } from 'next';

import Link from 'next/link';

import { MapArt } from '@/components/maps/map-art';
import { MapCatalogue } from '@/components/maps/map-catalogue';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { PageNotes } from '@/components/ui/page-notes';
import { formatPercent, titleCaseLabel } from '@/lib/format';
import { getRankedMapPicks } from '@/lib/stats';
import type { RankedMapPicks } from '@/types/stats';
import { getEventRotation } from '@/lib/bs-api';
import { MapsIcon } from '@/components/game-icons';
import { getActiveMaps, groupByMode, type GameMap } from '@/lib/game-maps';
import { getSeasonState } from '@/lib/ranked-seasons';
import { currentMonth } from '@/lib/site';
import { slugify } from '@/lib/slugs';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { gameWords, mapNamer } from '@/lib/i18n-game';

/* Generated rather than static, for the month — see the brawler index. */
export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    title: t('Brawl Stars maps and best brawlers ({v})', { v: currentMonth() }),
    description: t('Every active Brawl Stars map, grouped by game mode, with the strongest brawlers on each one ranked from sampled battles, {v}.', { v: currentMonth() }),
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
  const nm = await mapNamer();
  const t = getT(requestLocale());
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
  const [rotation, season, mapPicks, words] = await Promise.all([
    getEventRotation(ROTATION_REVALIDATE).catch(() => []),
    getSeasonState().catch(() => null),
    getRankedMapPicks(3).catch(() => [] as RankedMapPicks[]),
    gameWords(requestLocale()),
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

  /*
   * The maps in words (2026-11-23, AdSense "low value content"): what is
   * live, the busiest Ranked map and its best pick, the strongest top pick
   * anywhere in the pool, and how a map page decides. Sentences whose numbers
   * are missing are left out.
   */
  const withPicks = mapPicks.filter((m) => m.picks.length > 0);
  const busiest = [...withPicks].sort((a, b) => b.sampleSize - a.sampleSize)[0];
  const strongest = withPicks
    .filter((m) => m.confidence === 'high')
    .sort((a, b) => b.picks[0].score - a.picks[0].score)[0];
  const notes = [
    live.length > 0 && rankedPool.length > 0
      ? t('{live} maps are in the event rotation right now, and {pool} make up the Ranked pool.', { live: live.length, pool: rankedPool.length })
      : '',
    busiest && strongest
      ? t('The Ranked map with the most games in our sample is {map} in {mode}, where {pick} is the strongest pick. The best record of any top pick belongs to {best} on {bestMap}, with an adjusted win rate of {rate}.', {
          map: nm(busiest.mapName),
          mode: words.mode(busiest.mode),
          pick: titleCaseLabel(busiest.picks[0].brawlerName),
          best: titleCaseLabel(strongest.picks[0].brawlerName),
          bestMap: nm(strongest.mapName),
          rate: formatPercent(strongest.picks[0].score),
        })
      : '',
    t("Each map page ranks brawlers from battles played on that map only. When a map has too few battles to say anything, it shows its mode's best picks instead and says so, and every map is labelled by how much evidence is behind it."),
  ];

  return (
    <div className="space-y-10">
      <JsonLd data={breadcrumbSchema([{ name: 'Maps', path: '/maps' }])} />

      <PageHeading
        title={t('Maps')}
        subtitle={t('What is live right now, this season\'s Ranked pool, and the full catalogue of maps still in the game. Each map page ranks the brawlers with the best records on it, from sampled battles.')}
        aside={
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <MapsIcon className="size-4" />{t('{length} maps', { length: maps.length })}</span>
        }
      />

      {live.length > 0 ? (
        <MapStrip
          id="live"
          title={t('Live now')}
          subtitle={t('In the event rotation this minute, straight from the game API.')}
          maps={live}
        />
      ) : null}

      {rankedPool.length > 0 ? (
        <MapStrip
          id="ranked-pool"
          title={t('Ranked pool{v}', { v: season?.mapPoolSeason ? ` · ${t('Season {n}', { n: season.mapPoolSeason })}` : '' })}
          subtitle={t('The competitive map pool for the current Ranked season. Fixed until the season turns over.')}
          maps={rankedPool}
        />
      ) : null}

      {groups.length === 0 ? (
        <p className="card p-6 text-sm text-muted">{t('The map catalogue is unavailable right now.')}</p>
      ) : (
        <div>
          <SectionHeading
            title={t('Full catalogue')}
            subtitle={t('Every map still in the game, by mode. Search by name or open a mode. For what is live today, see the two sections above.')}
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
                name: nm(entry.map.name),
                modeSlug: entry.modeSlug,
                mapSlug: entry.mapSlug,
                imageUrl: entry.map.imageUrl,
              })),
            }))}
          />
        </div>
      )}

      <PageNotes title={t('About these maps')} paragraphs={notes} />
    </div>
  );
}

/** A flat, horizontally-scrolling row of maps, for the two real rotations. */
async function MapStrip({
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
  const nm = await mapNamer();
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  return (
    <section aria-labelledby={id}>
      <div id={id}>
        <SectionHeading title={t(title)} subtitle={t(subtitle)} aside={t('{length} maps', { length: maps.length })} />
      </div>
      {/* Scrolls rather than wraps: these are short, ordered lists and a grid
          of eight would push the catalogue below the fold on a phone. */}
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {maps.map((entry) => (
          <li key={`${entry.modeSlug}-${entry.mapSlug}`} className="w-36 shrink-0 snap-start">
            <Link
              href={lp(`/maps/${entry.modeSlug}/${entry.mapSlug}`)}
              className="card card-interactive group block h-full overflow-hidden"
            >
              <MapArt src={entry.map.imageUrl} alt="" height="h-28" sizes="144px" />
              <span className="block truncate px-3 pt-2 text-sm font-semibold">
                {nm(entry.map.name)}
              </span>
              <span className="label-game block truncate px-3 pb-2 text-xs text-muted">
                {entry.mode?.name ?? entry.map.gameMode.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
