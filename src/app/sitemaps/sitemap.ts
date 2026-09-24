import type { MetadataRoute } from 'next';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { INDEXABLE_PLAYER_TAGS } from '@/generated/indexable-players';
import { getActiveMaps, groupByMode } from '@/lib/game-maps';
import { SITE_URL } from '@/lib/site';
import { SECTIONS, type Section } from '@/lib/sitemap-sections';
import { slugify } from '@/lib/slugs';
import { PAIR_SEPARATOR } from '@/lib/compare';
import {
  getFilterableModes,
  getIndexablePairs,
  getNewestDayByMap,
  getTeamComps,
  listDailyReports,
} from '@/lib/stats';
import { getGameModeMap, modeLabel } from '@/lib/brawlapi';

/**
 * The sitemap, in four files behind an index at `/sitemap.xml`.
 *
 * Split rather than one list, after reading three months of Search Console on
 * 2026-09-21. Brawler pages were 9% of the URLs and 53% of the impressions;
 * compare pairs and maps were 77% of the URLs and 15%. Googlebot was fetching
 * about forty things a day and had ~800 sitemap URLs it had discovered and
 * never visited. One file gives it no way to tell the two apart, and Search
 * Console no way to report them apart. `core` is what earns the visits; the
 * rest is the long tail, listed because it is bounded, not because it is
 * urgent.
 *
 * `lastModified` is the other half of the same fix. Every URL used to carry
 * the build timestamp, which told Google that 1,177 pages changed on every
 * deploy — and Google documents that it stops trusting `lastmod` once it
 * proves unreliable, which forfeits the one signal that could have directed
 * the crawl it does spend. Now a page's date is the newest sampled day behind
 * its data: identical across the brawlers, because all of them changed today,
 * and genuinely different across maps, because a map out of rotation stopped
 * changing when its last battle was played. Pages with no data behind them
 * carry no date rather than a made-up one.
 *
 * Every dynamic source is wrapped so a failing upstream costs its own section
 * rather than the whole file: a sitemap that 500s is worse than one missing a
 * few hundred URLs.
 */
export const revalidate = 86400;

export async function generateSitemaps(): Promise<{ id: Section }[]> {
  return SECTIONS.map((id) => ({ id }));
}

type Entry = MetadataRoute.Sitemap[number];
type Frequency = Entry['changeFrequency'];

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = (await props.id) as Section;

  const byMap = await getNewestDayByMap().catch(() => new Map<string, string>());
  /** The newest sampled day anywhere, which is when every data page changed. */
  const newest = [...byMap.values()].sort().at(-1);
  const dataDay = newest ? new Date(`${newest}T00:00:00Z`) : null;

  const entries: MetadataRoute.Sitemap = [];
  const add = (
    path: string,
    changeFrequency: Frequency,
    priority: number,
    lastModified: Date | null = dataDay ?? null,
  ) => {
    entries.push({
      url: `${SITE_URL}${path}`,
      changeFrequency,
      priority,
      ...(lastModified ? { lastModified } : {}),
    });
  };

  switch (id) {
    case 'core':
      await core(add, dataDay);
      break;
    case 'maps':
      await maps(add, byMap);
      break;
    case 'compare':
      await compare(add);
      break;
    case 'players':
      for (const tag of INDEXABLE_PLAYER_TAGS) add(`/player/${tag}`, 'daily', 0.5);
      break;
  }

  return entries;
}

type Add = (path: string, f: Frequency, p: number, lastModified?: Date | null) => void;

/**
 * No date at all: these change when someone edits them, which nothing here
 * tracks. `null`, not `undefined` — an `undefined` argument selects the
 * default parameter, which is today's date, and that is exactly what the
 * first deploy of this shipped: 363 maps "changed today" where 258 had data.
 */
const EVERGREEN = null;

async function core(add: Add, dataDay: Date | null) {
  // Ordered by what the search data says earns the visit, not by site
  // structure. Order is not something Google promises to honour, but a crawler
  // that reads the file top-down and stops early — which is what a small
  // budget looks like — gets the important half first.
  add('', 'daily', 1);
  add('/tier-list/ranked', 'daily', 0.9);
  add('/tier-list/trophy', 'daily', 0.9);
  add('/brawlers', 'weekly', 0.8);

  /*
   * Bounded (~106) and stable, so worth listing individually — and listed by
   * slug, which is the canonical form. The numeric paths permanently redirect,
   * and a sitemap full of redirects wastes the crawl it is meant to direct.
   */
  const catalog = await getBrawlerCatalog().catch(() => null);
  for (const brawler of catalog?.current ?? []) {
    add(`/brawlers/${slugify(brawler.name)}`, 'daily', 0.8);
  }

  // Per-mode tier lists, listed only for the modes that actually have enough
  // sampled battles to rank — the routes 404 otherwise.
  for (const format of ['ranked', 'trophy'] as const) {
    const modes = await getFilterableModes(30, 150, format).catch(() => []);
    for (const mode of modes) {
      add(`/tier-list/${format}/${slugify(mode.mode)}`, 'daily', 0.75);
    }
  }

  add('/ranked', 'daily', 0.8);
  add('/daily', 'daily', 0.9);
  add('/meta', 'daily', 0.8);
  // Monthly, but its numbers settle as each after-window fills.
  add('/patches', 'weekly', 0.7);
  // The method behind the tier lists. Changes when the method does, which is
  // rarely — but it is the page that makes the lists worth citing.
  add('/meta-score', 'monthly', 0.75, EVERGREEN);
  add('/comps', 'daily', 0.8);
  add('/starr-drops', 'weekly', 0.8, EVERGREEN);
  add('/draft', 'weekly', 0.8);
  add('/events', 'hourly', 0.7);
  add('/leaderboard', 'daily', 0.7);
  /*
   * The other three boards, listed because they are separate answers rather
   * than the same page filtered: two mirror the game's own rankings, two are
   * built from our own sample. The Ranked board exists nowhere else — the
   * game API has no Ranked leaderboard endpoint at all.
   *
   * The per-region variants are deliberately absent and carry `noindex`:
   * over a hundred URLs of one board over a smaller population.
   */
  add('/leaderboard/clubs', 'daily', 0.65);
  add('/leaderboard/ranked', 'daily', 0.65);
  add('/leaderboard/cosmetics', 'weekly', 0.6);

  // One per mode that actually has comps clearing the sample floor. Listed off
  // the same source the route resolves against, so the sitemap cannot advertise
  // a mode whose page would 404.
  const comps = await getTeamComps().catch(() => []);
  const modeNames = await getGameModeMap().catch(() => new Map());
  for (const mode of comps) {
    if (mode.comps.length === 0) continue;
    add(`/comps/${slugify(modeLabel(modeNames, mode.mode))}`, 'daily', 0.7);
  }

  /*
   * Archived daily reports, but only the ones worth a crawl.
   *
   * The floor matches the `noindex` the dated route applies to a thin day, so
   * the sitemap and the page directive cannot disagree — listing a URL while
   * asking not to have it indexed is the contradiction that put ~98 profiles
   * through Google's crawler for nothing.
   *
   * Dated on the day they report, which is the one kind of page here whose
   * content genuinely never changes afterwards.
   */
  add('/daily/archive', 'daily', 0.6);
  const daily = await listDailyReports(400, 4).catch(() => []);
  for (const report of daily) {
    add(`/daily/${report.day}`, 'yearly', 0.5, new Date(`${report.day}T00:00:00Z`));
  }

  add('/cosmetics', 'weekly', 0.6);
  add('/cosmetics/skins', 'weekly', 0.6);
  add('/cosmetics/icons', 'weekly', 0.5);
  add('/tier-list/maker', 'monthly', 0.75, EVERGREEN);
  add('/news', 'daily', 0.6, dataDay);
  add('/release-notes', 'weekly', 0.5, EVERGREEN);
  // The app's download page. Its panel at /bubble/panel is deliberately
  // absent and carries `noindex`: one URL of data that already has an
  // indexable home on /tier-list/ranked.
  add('/bubble', 'monthly', 0.5, EVERGREEN);
  add('/about', 'monthly', 0.3, EVERGREEN);
  add('/privacy', 'yearly', 0.2, EVERGREEN);
}

async function maps(add: Add, byMap: Map<string, string>) {
  add('/maps', 'weekly', 0.85);
  const maps = await getActiveMaps().catch(() => []);
  for (const group of groupByMode(maps)) {
    add(`/maps/${group.mode}`, 'weekly', 0.7);
  }
  // The largest indexable surface on the site, and every one of them answers
  // a real query ("<map> best brawlers"). Dated per map: the newest battle
  // sampled on it, or nothing at all for a map nobody has been able to play.
  for (const entry of maps) {
    const day = entry.scHash ? byMap.get(`${entry.scHash}\u0000${entry.map.name}`) : undefined;
    add(
      `/maps/${entry.modeSlug}/${entry.mapSlug}`,
      'daily',
      0.7,
      day ? new Date(`${day}T00:00:00Z`) : EVERGREEN,
    );
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
async function compare(add: Add) {
  add('/compare', 'weekly', 0.7);
  const catalog = await getBrawlerCatalog().catch(() => null);
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
}

/*
 * Player and club pages beyond the indexable set are deliberately absent.
 *
 * They carry `noindex, follow` — there is one URL per tag in existence, they
 * cannot be enumerated, and each costs an upstream API call to render, so they
 * are a tool rather than a document set. The bounded set that IS listed is the
 * current global top boards: those are the profiles people search by name,
 * they are already cached, and the list re-narrows itself every day as the
 * boards move. See scripts/gen-indexable-players.ts for why the set is baked
 * rather than queried, and why an empty one is the safe failure.
 */
