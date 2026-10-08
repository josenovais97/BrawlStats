import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * The profile's showcase: the brawlers worth looking at first.
 *
 * Built only from the player payload the page already has. Three readings, each
 * a field the API sends on every brawler and the profile was barely using:
 * which brawlers the account is built around, which ones are winning right now,
 * and which are closest to their next prestige.
 */

/**
 * Trophies per prestige level.
 *
 * Measured, not assumed: on 2026-10-08 every one of 107 brawlers on a maxed
 * account had `prestigeLevel === Math.floor(trophies / 1000)`, from 42 trophies
 * at prestige 0 to 3,022 at prestige 3. It follows *current* trophies -- a
 * brawler peaked at 2,000 and now on 1,294 reports prestige 1.
 */
export const TROPHIES_PER_PRESTIGE = 1000;

/**
 * The highest prestige mark the post will point at.
 *
 * Prestige 3 is the highest level seen in the data. Whether a fourth exists at
 * 4,000 is not something the payload answers, so "next prestige" is never
 * offered past this mark rather than promising a level that may not be there.
 */
export const HIGHEST_KNOWN_MARK = 3000;

/** A live streak worth calling out. Two wins in a row is a good evening. */
export const HOT_STREAK = 3;

export interface PrestigeTarget {
  brawler: BSPlayerBrawler;
  /** The trophy mark being approached: 1,000, 2,000 or 3,000. */
  mark: number;
  /** The prestige level that mark grants. */
  level: number;
  toGo: number;
  /** How far through the current 1,000-trophy band, 0-1. */
  progress: number;
}

export function prestigeOf(brawler: BSPlayerBrawler): number {
  return brawler.prestigeLevel ?? Math.floor(brawler.trophies / TROPHIES_PER_PRESTIGE);
}

/** Where a brawler sits against its next mark, or null past the last one. */
export function nextPrestige(brawler: BSPlayerBrawler): PrestigeTarget | null {
  const level = Math.floor(brawler.trophies / TROPHIES_PER_PRESTIGE) + 1;
  const mark = level * TROPHIES_PER_PRESTIGE;
  if (mark > HIGHEST_KNOWN_MARK) return null;
  return {
    brawler,
    mark,
    level,
    toGo: mark - brawler.trophies,
    progress: (brawler.trophies % TROPHIES_PER_PRESTIGE) / TROPHIES_PER_PRESTIGE,
  };
}

/** The account's mains: most trophies, peak breaking ties. */
export function mains(brawlers: BSPlayerBrawler[], count = 3): BSPlayerBrawler[] {
  return [...brawlers]
    .sort((a, b) => b.trophies - a.trophies || b.highestTrophies - a.highestTrophies)
    .slice(0, count);
}

/** Brawlers on a live streak of `HOT_STREAK` or more, longest first. */
export function onFire(brawlers: BSPlayerBrawler[], count = 6): BSPlayerBrawler[] {
  return brawlers
    .filter((b) => (b.currentWinStreak ?? 0) >= HOT_STREAK)
    .sort(
      (a, b) =>
        (b.currentWinStreak ?? 0) - (a.currentWinStreak ?? 0) || b.trophies - a.trophies,
    )
    .slice(0, count);
}

/**
 * The brawlers closest to their next prestige, nearest first.
 *
 * Only ones genuinely close: inside the top quarter of their band. "742 to go"
 * is not a reason to play a brawler tonight, and a list padded with them would
 * bury the one that is 23 away.
 */
export function closestPrestige(brawlers: BSPlayerBrawler[], count = 3): PrestigeTarget[] {
  return brawlers
    .map(nextPrestige)
    .filter((t): t is PrestigeTarget => t !== null && t.toGo <= TROPHIES_PER_PRESTIGE / 4)
    .sort((a, b) => a.toGo - b.toGo || b.brawler.trophies - a.brawler.trophies)
    .slice(0, count);
}

/**
 * The equipped skin's display name, or null for the default skin.
 *
 * The API sends the game's own label in capitals, sometimes over two lines
 * ("SQUAD BUSTER\nSHELLY"), and the default skin is simply the brawler's name.
 */
export function skinLabel(brawler: BSPlayerBrawler): string | null {
  const raw = brawler.skin?.name?.replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  if (raw.toUpperCase() === brawler.name.toUpperCase()) return null;
  return raw;
}
