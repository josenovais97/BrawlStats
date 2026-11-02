import icons from '@/data/fankit-icons.json';

/**
 * Square brawler icons cut from Supercell's Fan Kit portraits, and the ranked
 * league badges (2026-11-02; see lib/fankit and scripts/fankit-sync.py).
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
