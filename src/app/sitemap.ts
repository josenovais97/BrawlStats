import type { MetadataRoute } from 'next';

import { getClubRankings, getOfficialBrawlers, getPlayerRankings } from '@/lib/bs-api';
import { getActiveMaps, groupByMode } from '@/lib/game-maps';
import { SITE_URL } from '@/lib/site';
import { slugify } from '@/lib/slugs';
import { getFilterableModes } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';

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

/** Ranks worth listing. The boards themselves are capped at 200 by the API. */
const TOP_PLAYERS = 200;
const TOP_CLUBS = 100;

/** Matches this route's own revalidate, so neither call shortens it. */
const SITEMAP_TTL = 86_400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: [string, MetadataRoute.Sitemap[number]['changeFrequency'], number][] = [
    ['', 'daily', 1],
    ['/tier-list/ranked', 'daily', 0.9],
    ['/tier-list/trophy', 'daily', 0.9],
    ['/maps', 'weekly', 0.85],
    ['/ranked', 'daily', 0.8],
    ['/brawlers', 'weekly', 0.8],
    ['/draft', 'weekly', 0.8],
    ['/compare', 'weekly', 0.7],
    ['/events', 'hourly', 0.7],
    ['/leaderboard', 'daily', 0.7],
    ['/news', 'daily', 0.6],
    ['/release-notes', 'weekly', 0.5],
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

  // Bounded (~106) and stable, so worth listing individually.
  const brawlers = await getOfficialBrawlers()
    .then((r) => r.items)
    .catch(() => []);
  for (const brawler of brawlers) {
    add(`/brawlers/${brawler.id}`, 'weekly', 0.7);
  }

  // Maps and their mode indexes: the largest indexable surface on the site,
  // and every one of them answers a real query ("<map> best brawlers").
  const maps = await getActiveMaps().catch(() => []);
  for (const group of groupByMode(maps)) {
    add(`/maps/${group.mode}`, 'weekly', 0.7);
  }
  for (const entry of maps) {
    add(`/maps/${entry.modeSlug}/${entry.mapSlug}`, 'daily', 0.7);
  }

  // Per-mode tier lists, listed only for the modes that actually have enough
  // sampled battles to rank — the routes 404 otherwise.
  for (const format of ['ranked', 'trophy'] as const) {
    const modes = await getFilterableModes(30, 150, format).catch(() => []);
    for (const mode of modes) {
      add(`/tier-list/${format}/${slugify(mode.mode)}`, 'daily', 0.75);
    }
  }

  const players = await getPlayerRankings('global', TOP_PLAYERS, SITEMAP_TTL)
    .then((r) => r.items)
    .catch(() => []);
  for (const player of players) {
    add(`/player/${normalizeTag(player.tag)}`, 'daily', 0.5);
  }

  const clubs = await getClubRankings('global', TOP_CLUBS, SITEMAP_TTL)
    .then((r) => r.items)
    .catch(() => []);
  for (const club of clubs) {
    add(`/club/${normalizeTag(club.tag)}`, 'daily', 0.4);
  }

  return entries;
}
