import 'server-only';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getBattleLog, getOfficialBrawlers, getPlayer } from '@/lib/bs-api';
import type { Locale } from '@/lib/i18n';
import { buildFacts, roast, type Roast, type RoastFacts } from '@/lib/roast';
import { getScoredRoster } from '@/lib/stats';
import type { BSPlayer } from '@/types/brawlstars';
import type { Tier } from '@/types/stats';

/**
 * Whether Roast My Account is public: since 2026-11-17 (owner: money first,
 * so launch it rather than wait for an AdSense review that is not running).
 *
 * Built hidden on 2026-10-27 while the review was open. With this on, the
 * landing page is indexable and in the sitemap and the nav and home page link
 * to it; the tag pages stay out of robots.txt (`/roast/` in
 * `CRAWLER_DISALLOW`, like /account-value's), `noindex`, and limited.
 */
export const ROAST_PUBLIC = true;

export interface RoastResult {
  player: BSPlayer;
  facts: RoastFacts;
  roast: Roast;
}

/**
 * The roast for a tag, today, in one language.
 *
 * The player and the log are live fetches, the same as a profile. Everything
 * else is optional colour: without the log the roast loses its form and
 * one-trick lines, without the catalogue the class fallbacks, without the
 * tier list the "your main is D tier" line -- it still gets five lines from
 * the player alone. The seed is tag + UTC day, so the same roast all day.
 */
export async function getRoast(tag: string, locale: Locale): Promise<RoastResult> {
  const player = await getPlayer(tag);
  const [log, official, catalog, scored] = await Promise.all([
    getBattleLog(tag).then((r) => r.items).catch(() => null),
    getOfficialBrawlers().then((r) => r.items).catch(() => []),
    getBrawlerCatalog().catch(() => null),
    getScoredRoster(7, undefined, 'ranked').catch(() => []),
  ]);
  const classOf = new Map((catalog?.all ?? []).map((b) => [b.name.toUpperCase(), b.className]));
  const tierOf = new Map<number, Tier | null>(scored.map((b) => [b.brawlerId, b.tier]));

  const facts = buildFacts(player, log, {
    rosterSize: official.length,
    classOf: (name) => classOf.get(name.toUpperCase()) ?? null,
    tierOf: (id) => tierOf.get(id) ?? null,
  });
  const day = new Date().toISOString().slice(0, 10);
  return { player, facts, roast: roast(facts, locale, `${player.tag}|${day}`) };
}
