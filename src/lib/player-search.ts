import { isOptedOut } from '@/lib/opted-out';
import { getPrisma } from '@/lib/prisma';

/**
 * Find players by name (2026-10-28).
 *
 * The game's API only looks players up by tag, so this searches the names
 * the site already holds: every profile opened here (player_names), the
 * players the sampler follows (sampled_players) and the brawler leaderboards.
 * A player who has never been looked up is not in it, which the search box
 * says, pointing at the tag. Privacy-excluded players are never returned.
 */

export interface NameMatch {
  tag: string;
  name: string;
  /** Account trophies when known; the leaderboards only give a brawler's. */
  trophies: number | null;
  iconId: number | null;
}

export const MIN_QUERY = 2;
export const MAX_RESULTS = 8;

/** The query as an ILIKE pattern: its own % and _ are literal. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Exact name first, then names starting with it, then the rest; more trophies first within each. */
export function rankMatches(q: string, rows: (NameMatch & { pri: number })[]): NameMatch[] {
  const needle = q.toLowerCase();
  const best = new Map<string, NameMatch & { pri: number }>();
  for (const r of rows) {
    const had = best.get(r.tag);
    if (!had || r.pri < had.pri) best.set(r.tag, r);
  }
  const score = (n: string) => {
    const s = n.toLowerCase();
    return s === needle ? 0 : s.startsWith(needle) ? 1 : 2;
  };
  return [...best.values()]
    .filter((r) => !isOptedOut(r.tag))
    .sort((a, b) => score(a.name) - score(b.name) || (b.trophies ?? -1) - (a.trophies ?? -1))
    .slice(0, MAX_RESULTS)
    .map(({ tag, name, trophies, iconId }) => ({ tag, name, trophies, iconId }));
}

export async function searchPlayersByName(raw: string): Promise<NameMatch[]> {
  const q = raw.trim().slice(0, 30);
  if ([...q].length < MIN_QUERY) return [];
  const prisma = getPrisma();
  if (!prisma) return [];
  const pattern = likePattern(q);
  // pri: a profile opened here is the freshest reading of a name.
  const rows = await prisma.$queryRaw<(NameMatch & { pri: number })[]>`
    (select tag, name, trophies, icon_id as "iconId", 1 as pri from player_names where name ilike ${pattern} limit 100)
    union all
    (select tag, name, trophies, icon_id as "iconId", 2 as pri from sampled_players where name ilike ${pattern} limit 100)
    union all
    (select distinct on (player_tag) player_tag as tag, player_name as name, null::int as trophies, null::int as "iconId", 3 as pri
       from brawler_ranking_entries where player_name ilike ${pattern} limit 100)`;
  return rankMatches(q, rows);
}
