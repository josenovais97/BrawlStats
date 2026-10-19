import { slugify } from '@/lib/slugs';

/** "gemGrab", "Gem Grab", "gem-grab" all to "gemgrab"; likewise map names. */
export const rotationKey = (value: string) => slugify(value).replace(/-/g, '');

/**
 * Below this share of its mode's busiest map, a map counts as a straggler
 * (games that started before a rotation change), not as in rotation.
 */
const STRAGGLER_SHARE = 0.1;

/**
 * A map whose newest battle is this much older than its mode's newest has
 * left the rotation. A rotated-out map stops being played at once, while its
 * 36-hour count stays large for a day and a half -- without this, last
 * season's maps would linger beside the new ones that long after a switch.
 */
const GONE_AFTER_MS = 6 * 3600_000;

/**
 * The Ranked maps in rotation right now, per mode, from what is being played.
 *
 * The battles are the authority, measured over the last 36 hours, because
 * every map in the live pool is played every day (~26,000 sampled battles per
 * map on 2026-10-19). The wiki's published pool was wrong in both directions
 * that day: it listed Beach Ball and Spiraling Out, unplayed for 36 hours,
 * and missed Goldarm Gulch and Flowing Springs in Knockout; and the season
 * start was no cut-off either, since last season's Rustic Arcade, Safe(r)
 * Zone and Pit Stop kept being played into the second day.
 *
 * The pool is used only for a mode with no recent battles at all -- the first
 * hours of a season, before the sampler has met it -- so a mode never shows
 * an empty map list.
 */
export function rotationMaps(input: {
  /** Ranked battles per map over the last 36 hours, and when each was last played. */
  recent: { mode: string; mapName: string; battles: number; lastSeen?: string }[];
  pool: { mode: string; maps: string[] }[];
}): Map<string, string[]> {
  const byMode = new Map<string, { mapName: string; battles: number; last: number }[]>();
  for (const row of input.recent) {
    const key = rotationKey(row.mode);
    const list = byMode.get(key) ?? [];
    const last = row.lastSeen ? Date.parse(row.lastSeen) : Number.POSITIVE_INFINITY;
    const same = list.find((m) => rotationKey(m.mapName) === rotationKey(row.mapName));
    if (same) {
      same.battles += row.battles;
      same.last = Math.max(same.last, last);
    } else list.push({ mapName: row.mapName, battles: row.battles, last });
    byMode.set(key, list);
  }

  const out = new Map<string, string[]>();
  for (const [mode, list] of byMode) {
    const top = Math.max(...list.map((m) => m.battles));
    const newest = Math.max(...list.map((m) => (Number.isFinite(m.last) ? m.last : 0)));
    out.set(
      mode,
      list
        .filter((m) => m.battles >= top * STRAGGLER_SHARE)
        .filter((m) => !Number.isFinite(m.last) || newest - m.last <= GONE_AFTER_MS)
        .map((m) => m.mapName)
        .sort((a, b) => a.localeCompare(b)),
    );
  }
  for (const entry of input.pool) {
    const key = rotationKey(entry.mode);
    if (!out.has(key)) out.set(key, [...entry.maps].sort((a, b) => a.localeCompare(b)));
  }
  return out;
}
