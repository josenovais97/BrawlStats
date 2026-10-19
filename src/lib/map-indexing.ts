import 'server-only';

import { minutesSince } from '@/lib/format';
import { getRankedMapPicks, mapNameKey, MAP_ROTATION_GRACE_DAYS } from '@/lib/stats';

/**
 * Which map pages are offered to search (2026-10-19).
 *
 * A map page ranks brawlers on the map itself only when the map has its own
 * Ranked picks and is in rotation; otherwise it falls back to the mode's
 * picks, the same list on every map of the mode. On 2026-10-19 that was 372
 * of 445 map pages -- every Showdown, Hockey, Duels... map, since per-map
 * picks come from Ranked only -- near-duplicates of each other, the pattern
 * AdSense's "low value content" review and Google's own thin-content rules
 * both look for. They drew one search visit in 30 days. They stay up for
 * visitors, but noindex and out of the sitemap until the map has its own data.
 */
export function mapIndexKey(mode: string, mapName: string): string {
  return `${mode}\u0000${mapNameKey(mapName)}`;
}

/** Keys of the maps with their own picks, or null when the read failed (index everything, as before). */
export async function indexableMaps(): Promise<Set<string> | null> {
  try {
    // 20 per map: the same cached read as the Bubble panel's.
    const rows = await getRankedMapPicks(20);
    return new Set(
      rows
        .filter((r) => r.picks.length > 0)
        .filter((r) => {
          const since = minutesSince(r.lastSeen);
          return since !== null && since < MAP_ROTATION_GRACE_DAYS * 24 * 60;
        })
        .map((r) => mapIndexKey(r.mode, r.mapName)),
    );
  } catch {
    return null;
  }
}
