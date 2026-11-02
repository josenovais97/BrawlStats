import data from '@/data/fankit.json';

/**
 * Official art from Supercell's Brawl Stars Fan Kit (2026-11-02), indexed by
 * `scripts/fankit-sync.py` into `src/data/fankit.json`. BrawlZone joined the
 * Supercell Creators program on 2026-10-31; the Fan Kit is Supercell's own
 * library of game art offered for fan content.
 *
 * Two kinds of address come out of here:
 *
 * - Full-body renders, default and skins, are our own trimmed copies under
 *   `/fankit/body/` and `/fankit/skin/`: the Fan Kit draws them on loose
 *   canvases, so they are cut to the figure once by the sync script rather
 *   than shown small and adrift in every card.
 * - Icons (gadgets, star powers, hypercharges, modes) are the Fan Kit's own files on
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
const skins: Record<string, string> = data.skins;
const accessories: Record<string, string> = data.accessories;
const hypercharges: Record<string, string> = data.hypercharges;
const modes: Record<string, string> = data.modes;

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

/** Lowercase letters and digits only, as the sync script keys skins. */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

/**
 * A skin's full-body render, by the game API's names for the brawler and the
 * skin ("Amber", "Starr Patrol Amber"). The key is the skin's words with the
 * brawler's name taken off either end, exactly as the sync script builds it
 * from the Fan Kit's file names, so the two meet in the middle.
 */
export function fankitSkin(brawlerId: number, brawlerName: string, skinName: string): string | null {
  const brawler = norm(brawlerName);
  let variant = norm(skinName);
  if (variant.startsWith(brawler)) variant = variant.slice(brawler.length);
  if (variant.endsWith(brawler)) variant = variant.slice(0, -brawler.length);
  return variant ? (skins[`${brawlerId}|${variant}`] ?? null) : null;
}

/** A game mode's icon, by its name ("Gem Grab", "Solo Showdown"). */
export function fankitMode(modeName: string, width = 96): string | null {
  const url = modes[norm(modeName)];
  return url ? `${url}?width=${width}` : null;
}
