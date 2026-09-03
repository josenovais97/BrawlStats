import type { MetadataRoute } from 'next';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { INDEXABLE_PLAYER_TAGS } from '@/generated/indexable-players';
import { getActiveMaps, groupByMode } from '@/lib/game-maps';
import { SITE_URL } from '@/lib/site';
import { slugify } from '@/lib/slugs';
import { PAIR_SEPARATOR } from '@/lib/compare';
import {
  getFilterableModes,
  getIndexablePairs,
  getTeamComps,
  listDailyReports,
} from '@/lib/stats';
import { getGameModeMap, modeLabel } from '@/lib/brawlapi';

/**
 * The site's fixed routes, plus a page per brawler, map, mode and top-ranked
 * player or club.
 *
 * Every dynamic source is wrapped so a failing upstream costs its own section
 * rather than the whole file: a sitemap that 500s is worse than one missing a
 * few hundred URLs.
 *
 * Player and club pages are bounded here on purpose. There is one per tag in
 * the game and they cannot be enumerated, so only the current global top
 * boards are listed — those are the profiles people search by name, they are
 * already cached, and the list re-narrows itself every day as the boards move.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: [string, MetadataRoute.Sitemap[number]['changeFrequency'], number][] = [
    ['', 'daily', 1],
    ['/tier-list/ranked', 'daily', 0.9],
    ['/tier-list/trophy', 'daily', 0.9],
    ['/maps', 'weekly', 0.85],
    ['/cosmetics', 'weekly', 0.6],
    ['/cosmetics/skins', 'weekly', 0.6],
    ['/cosmetics/icons', 'weekly', 0.5],
    ['/starr-drops', 'weekly', 0.8],
    ['/tier-list/maker', 'monthly', 0.75],
    ['/ranked', 'daily', 0.8],
    ['/brawlers', 'weekly', 0.8],
    ['/draft', 'weekly', 0.8],
    ['/daily', 'daily', 0.9],
    ['/daily/archive', 'daily', 0.6],
    ['/comps', 'daily', 0.8],
    ['/meta', 'daily', 0.8],
    ['/compare', 'weekly', 0.7],
    ['/events', 'hourly', 0.7],
    ['/leaderboard', 'daily', 0.7],
    /*
     * The other three boards, listed because they are separate answers rather
     * than the same page filtered: two mirror the game's own rankings, two are
     * built from our own sample. The Ranked board exists nowhere else — the
     * game API has no Ranked leaderboard endpoint at all.
     *
     * The per-region variants are deliberately absent and carry `noindex`:
     * over a hundred URLs of one board over a smaller population.
     */
    ['/leaderboard/clubs', 'daily', 0.65],
    ['/leaderboard/ranked', 'daily', 0.65],
    ['/leaderboard/cosmetics', 'weekly', 0.6],
    ['/news', 'daily', 0.6],
    ['/release-notes', 'weekly', 0.5],
    // The app's download page. Its panel at /bubble/panel is deliberately
    // absent and carries `noindex`: one URL of data that already has an
    // indexable home on /tier-list/ranked.
    ['/bubble', 'monthly', 0.5],
    ['/about', 'monthly', 0.3],
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map(
    ([path, changeFrequency, priority]) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }),
  );

  const add = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: number,
  ) => {
    entries.push({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority });
  };

  /*
   * Bounded (~106) and stable, so worth listing individually — and listed by
   * slug, which is the canonical form. The numeric paths permanently redirect,
   * and a sitemap full of redirects wastes the crawl it is meant to direct.
   */
  const catalog = await getBrawlerCatalog().catch(() => null);
  for (const brawler of catalog?.current ?? []) {
    add(`/brawlers/${slugify(brawler.name)}`, 'weekly', 0.8);
  }

  // Maps and their mode indexes: the largest indexable surface on the site,
  // and every one of them answers a real query ("<map> best brawlers").
  // The bounded set of player pages a crawler is allowed to fetch. Listing
  // them is the point: they are the second most-visited content on the site
  // and were invisible to search until 2026-08-27. See
  // scripts/gen-indexable-players.ts for why the set is baked rather than
  // queried, and why an empty one is the safe failure.
  for (const tag of INDEXABLE_PLAYER_TAGS) {
    add(`/player/${tag}`, 'daily', 0.5);
  }

  const maps = await getActiveMaps().catch(() => []);
  for (const group of groupByMode(maps)) {
    add(`/maps/${group.mode}`, 'weekly', 0.7);
  }

  for (const entry of maps) {
    add(`/maps/${entry.modeSlug}/${entry.mapSlug}`, 'daily', 0.7);
  }

  /*
   * Archived daily reports, but only the ones worth a crawl.
   *
   * The floor matches the `noindex` the dated route applies to a thin day, so
   * the sitemap and the page directive cannot disagree — listing a URL while
   * asking not to have it indexed is the contradiction that put ~98 profiles
   * through Google's crawler for nothing.
   */
  const daily = await listDailyReports(400, 4).catch(() => []);
  for (const report of daily) {
    add(`/daily/${report.day}`, 'yearly', 0.5);
  }

  // One per mode that actually has comps clearing the sample floor. Listed off
  // the same source the route resolves against, so the sitemap cannot advertise
  // a mode whose page would 404.
  const comps = await getTeamComps().catch(() => []);
  const modeNames = await getGameModeMap().catch(() => new Map());
  for (const mode of comps) {
    if (mode.comps.length === 0) continue;
    add(`/comps/${slugify(modeLabel(modeNames, mode.mode))}`, 'daily', 0.7);
  }

  // Per-mode tier lists, listed only for the modes that actually have enough
  // sampled battles to rank — the routes 404 otherwise.
  for (const format of ['ranked', 'trophy'] as const) {
    const modes = await getFilterableModes(30, 150, format).catch(() => []);
    for (const mode of modes) {
      add(`/tier-list/${format}/${slugify(mode.mode)}`, 'daily', 0.75);
    }
  }

  /*
   * Head-to-head comparisons, for the bounded set that is worth indexing.
   *
   * Listed from the same `getIndexablePairs` the route marks `index` with, so
   * the sitemap and the robots directive cannot disagree — a listed page that
   * says `noindex` is a contradiction a crawler pays to resolve. Bounded by
   * brawler popularity rather than by evidence: every one of the 5,565
   * possible pairings has been sampled, so evidence alone excludes almost
   * nothing.
   */
  const catalogById = new Map(
    (catalog?.current ?? []).map((brawler) => [brawler.id, brawler.name]),
  );
  const pairs = await getIndexablePairs().catch(() => []);
  for (const [a, b] of pairs) {
    const nameA = catalogById.get(a);
    const nameB = catalogById.get(b);
    // Skip a pairing whose brawlers are not in the catalogue: the URL is built
    // from names, so without both there is no address to list.
    if (!nameA || !nameB) continue;
    add(`/compare/${slugify(nameA)}${PAIR_SEPARATOR}${slugify(nameB)}`, 'weekly', 0.5);
  }

  /*
   * Player and club pages are deliberately absent.
   *
   * They now carry `noindex, follow` — there is one URL per tag in existence,
   * they cannot be enumerated, and each costs an upstream API call to render,
   * so they are a tool rather than a document set. Listing pages in a sitemap
   * while asking search engines not to index them is a contradiction, so the
   * listing goes rather than the directive.
   */

  return entries;
}
