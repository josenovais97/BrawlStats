import 'server-only';

import { unstable_cache } from 'next/cache';

import { USER_AGENT } from '@/lib/site';

/**
 * Movement, range and reload for the whole roster, in one place.
 *
 * The wiki infobox spells each of these as a number and a named tier —
 * `800 (Fast)`, `7.67 (Long)`, `1.5 seconds (Normal)`. The tier is what a
 * player reasons with, and it is an ordinal scale, so it makes a far better
 * clue than the raw figure: nobody knows whether 855 is fast, and everybody
 * knows "Very Fast" is above "Fast".
 *
 * Fetched in BATCHES. `getBrawlerWiki` reads one page at a time, which is
 * right for a brawler page but would be 107 requests to answer a single guess
 * in the daily challenge. MediaWiki accepts up to 50 titles per query, so the
 * whole roster costs three requests, cached for a day. These values change
 * only when Supercell rebalances.
 */

const API = 'https://brawlstars.fandom.com/api.php';

/** Ordered weakest to strongest, which is what makes the arrows mean something. */
export const MOVEMENT_ORDER = ['Very Slow', 'Slow', 'Normal', 'Fast', 'Very Fast'] as const;
export const RANGE_ORDER = ['Very Short', 'Short', 'Normal', 'Long', 'Very Long'] as const;
/**
 * Reload, ordered by SPEED rather than by seconds.
 *
 * The infobox writes reload as a duration, where a smaller number is better,
 * and then names it on a speed scale where a later word is better. Ordering by
 * the word keeps every arrow on this board meaning the same thing: up is more
 * of the named quality, never "a bigger number".
 */
export const RELOAD_ORDER = ['Very Slow', 'Slow', 'Normal', 'Fast', 'Very Fast'] as const;

export interface CombatTiers {
  movement: string | null;
  range: string | null;
  reload: string | null;
}

/**
 * The first parenthetical on the first line.
 *
 * Values carry variants — `855 (Very Fast)<br>3000 (Super dash)` — and only the
 * base one is a property of the brawler. Taking the first also rejects the
 * variant labels, which are descriptions rather than tiers.
 */
function tierOf(raw: string | undefined, allowed: readonly string[]): string | null {
  if (!raw) return null;
  const first = raw.split(/<br\s*\/?>/i)[0];
  const match = /\(([^)]+)\)/.exec(first);
  if (!match) return null;
  const word = match[1].trim();
  return allowed.includes(word) ? word : null;
}

function field(wikitext: string, key: string): string | undefined {
  const m = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|}]*)`).exec(wikitext);
  return m?.[1]?.trim();
}

async function fetchBatch(titles: string[]): Promise<Map<string, CombatTiers>> {
  const out = new Map<string, CombatTiers>();
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'revisions');
  url.searchParams.set('rvprop', 'content');
  url.searchParams.set('rvslots', 'main');
  url.searchParams.set('titles', titles.join('|'));
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('redirects', '1');

  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return out;

  const body = (await res.json()) as {
    query?: {
      pages?: { title: string; revisions?: { slots?: { main?: { content?: string } } }[] }[];
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
    };
  };

  /*
   * MediaWiki answers under the CANONICAL title, so a redirect or a case fix
   * means the key coming back is not the name we asked for. Following the
   * mapping is what stops a brawler silently losing three clues.
   */
  const backToAsked = new Map<string, string>();
  for (const hop of [...(body.query?.normalized ?? []), ...(body.query?.redirects ?? [])]) {
    backToAsked.set(hop.to, backToAsked.get(hop.from) ?? hop.from);
  }

  for (const page of body.query?.pages ?? []) {
    const text = page.revisions?.[0]?.slots?.main?.content;
    if (!text) continue;
    const tiers: CombatTiers = {
      movement: tierOf(field(text, 'MovementSpeed'), MOVEMENT_ORDER),
      range: tierOf(field(text, 'AttackRange'), RANGE_ORDER),
      reload: tierOf(field(text, 'Reload'), RELOAD_ORDER),
    };
    out.set((backToAsked.get(page.title) ?? page.title).toLowerCase(), tiers);
  }
  return out;
}

async function compute(names: string[]): Promise<[string, CombatTiers][]> {
  const out = new Map<string, CombatTiers>();
  // 50 is MediaWiki's limit for an anonymous client. Sequential rather than
  // parallel: three polite requests a day is not worth hammering a free wiki.
  for (let i = 0; i < names.length; i += 50) {
    try {
      const batch = await fetchBatch(names.slice(i, i + 50));
      for (const [k, v] of batch) out.set(k, v);
    } catch {
      // A failed batch costs those brawlers their three clues for the day.
      // The puzzle still plays on the ones that resolved.
    }
  }
  return [...out];
}

/**
 * Cached for a day, keyed on the roster.
 *
 * `unstable_cache` rather than a bare fetch cache because the work is the loop,
 * not any single request, and because the result has to survive a rebuild —
 * see AGENTS.md trap 2 on a route's revalidate being the shortest cache inside
 * it. A day is safe: these values move on balance patches, and the tier list
 * beside them already moves hourly.
 */
const cached = unstable_cache(compute, ['brawler-combat-tiers'], { revalidate: 86_400 });

export async function getCombatTiers(names: string[]): Promise<Map<string, CombatTiers>> {
  try {
    return new Map(await cached([...names].sort()));
  } catch {
    return new Map();
  }
}
