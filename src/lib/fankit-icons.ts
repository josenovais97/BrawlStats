import icons from '@/data/fankit-icons.json';

/**
 * Square brawler icons cut from Supercell's Fan Kit portraits, the ranked
 * league and tier badges, and which player icons the Fan Kit has (2026-11-02;
 * see lib/fankit and scripts/fankit-sync.py).
 *
 * Apart from lib/fankit because client components draw these -- every list,
 * the draft, the search -- and this index is a few kilobytes where the full
 * one is forty.
 */
const byId: Record<string, string> = icons;

export function fankitIcon(brawlerId: number): string | null {
  return byId[String(brawlerId)] ?? null;
}

/**
 * A ranked league's badge ("Bronze", "MASTERS I" -> masters), from the Fan
 * Kit's CDN. Kept in the same small index under `league:` keys, because the
 * rank chips and the ranked ladder that draw them run in the browser too.
 */
/** The generic gadget, star power or gear mark drawn beside a heading. */
export function fankitGeneric(kind: 'gadget' | 'starpower' | 'gear'): string | null {
  return byId[`generic:${kind}`] ?? null;
}

export function fankitLeague(rankName: string): string | null {
  const league = rankName.trim().split(/\s+/)[0]?.toLowerCase();
  return league ? (byId[`league:${league}`] ?? null) : null;
}

/**
 * A numbered ranked tier's badge, by the API's 1-based `rankedRank` (Bronze I
 * is 1, Pro is 22): the Fan Kit's rank head with the game's numeral under it.
 */
export function fankitRank(rank: number): string | null {
  return byId[`rank:${rank}`] ?? null;
}

/**
 * The ids in a range list -- offsets from `base`, "0-2,5,9-40" -- as a set.
 * The player icons and club badges the Fan Kit has are listed this way: a
 * thousand ids in a few hundred characters, because every search box and
 * leaderboard row draws one in the browser.
 */
function idSet(ranges: string | undefined, base: number): Set<number> {
  const out = new Set<number>();
  for (const part of (ranges ?? '').split(',')) {
    if (!part) continue;
    const [from, to = from] = part.split('-').map(Number);
    for (let o = from; o <= to; o += 1) out.add(base + o);
  }
  return out;
}
const playerIcons = idSet(byId.players, 28000000);
const clubBadges = idSet(byId.clubs, 8000000);

/** A club badge from the Fan Kit, by the game's badge id -- the kit has a handful. */
export function fankitClubBadge(badgeId: number): string | null {
  return clubBadges.has(badgeId) ? `/fankit/club/${badgeId}.webp` : null;
}

/** A player icon from the Fan Kit, by the game's icon id. */
export function fankitPlayerIcon(iconId: number): string | null {
  return playerIcons.has(iconId) ? `/fankit/player/${iconId}.webp` : null;
}
