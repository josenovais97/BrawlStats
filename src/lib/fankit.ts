import data from '@/data/fankit.json';

/**
 * Official art from Supercell's Brawl Stars Fan Kit (2026-11-02), indexed by
 * `scripts/fankit-sync.py` into `src/data/fankit.json`. BrawlZone joined the
 * Supercell Creators program on 2026-10-31; the Fan Kit is Supercell's own
 * library of game art offered for fan content.
 *
 * Two kinds of address come out of here:
 *
 * - Full-body renders are our own trimmed copies under `/fankit/body/`: the
 *   Fan Kit draws them on loose canvases, so they are cut to the figure once
 *   by the sync script rather than shown small and adrift on every podium.
 * - Icons (gadgets, star powers, hypercharges) are the Fan Kit's own files on
 *   Frontify's CDN, which resizes on request and returns WebP, so a 48px icon
 *   costs a few kilobytes instead of a full PNG.
 *
 * Every lookup can miss -- the newest brawlers reach the Fan Kit late, and a
 * few files are named in ways the sync cannot read -- and every caller keeps
 * its previous art for a miss.
 *
 * Kept out of `lib/brawlapi`, which client components import for its URL
 * helpers: the index is ~40KB that no browser needs. That module reaches it
 * through a dynamic import inside a server-only fetch, so it never lands in a
 * client bundle.
 */

const bodies: Record<string, string> = data.bodies;
const accessories: Record<string, string> = data.accessories;
const hypercharges: Record<string, string> = data.hypercharges;

/** The brawler's default skin, full body, trimmed to the figure. */
export function fankitBody(brawlerId: number): string | null {
  return bodies[String(brawlerId)] ?? null;
}

/**
 * A gadget's or star power's icon, in the game's own framed badge.
 * `width` is the pixel width the CDN should deliver -- twice the size it is
 * drawn at covers a phone's screen density.
 */
export function fankitAccessory(id: number, width = 128): string | null {
  const url = accessories[String(id)];
  return url ? `${url}?width=${width}` : null;
}

/** The brawler's hypercharge icon. */
export function fankitHypercharge(brawlerId: number, width = 128): string | null {
  const url = hypercharges[String(brawlerId)];
  return url ? `${url}?width=${width}` : null;
}
