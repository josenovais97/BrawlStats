import 'server-only';

import { getOfficialBrawlers, getPlayer } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { computeProgression } from '@/lib/progression';
import { computeSkillScore } from '@/lib/skill-score';
import { isValidTag, normalizeTag } from '@/lib/tags';
import type { BSPlayer } from '@/types/brawlstars';

/**
 * One side of a player comparison.
 *
 * Everything is derived from the same functions the profile page uses —
 * `computeSkillScore`, `computeProgression` — rather than a second
 * implementation. Two code paths computing "account completion" would drift,
 * and the comparison would eventually disagree with the profile it links to.
 */

export interface PlayerSide {
  player: BSPlayer;
  tag: string;
  skill: number;
  skillTier: string;
  /** 0–1 share of the current roster unlocked. */
  rosterShare: number;
  power11: number;
  hyperCharges: number;
  /** Mean trophies across owned brawlers. */
  averageTrophies: number;
  bestWinStreak: number;
  prestige: number;
}

export type CompareOutcome =
  | { ok: true; side: PlayerSide }
  | { ok: false; reason: 'invalid' | 'notFound' | 'unavailable' };

/**
 * Loads one player for comparison.
 *
 * Failure is a value rather than an exception so one bad tag renders as a
 * clean "unavailable" column beside a working one, instead of taking the whole
 * page down — which is the common case when someone mistypes a single
 * character.
 */
export async function loadPlayerSide(
  rawTag: string,
  rosterSize: number,
): Promise<CompareOutcome> {
  if (!isValidTag(rawTag)) return { ok: false, reason: 'invalid' };

  let player: BSPlayer;
  try {
    player = await getPlayer(rawTag);
  } catch (err) {
    const code = toApiError(err).code;
    return {
      ok: false,
      reason: code === 'notFound' || code === 'invalidTag' ? 'notFound' : 'unavailable',
    };
  }

  const skill = computeSkillScore(player, rosterSize || undefined);
  const owned = player.brawlers.length;

  return {
    ok: true,
    side: {
      player,
      tag: normalizeTag(player.tag),
      skill: skill.score,
      skillTier: skill.tier,
      rosterShare: rosterSize > 0 ? Math.min(owned / rosterSize, 1) : 0,
      power11: player.brawlers.filter((b) => b.power >= 11).length,
      hyperCharges: player.brawlers.reduce(
        (sum, b) => sum + (b.hyperCharges?.length ?? 0),
        0,
      ),
      averageTrophies: owned > 0 ? player.trophies / owned : 0,
      // The API reports a per-brawler streak only; the account's best is the
      // maximum across the roster, which is the closest thing it publishes.
      bestWinStreak: player.brawlers.reduce(
        (best, b) => Math.max(best, b.maxWinStreak ?? 0),
        0,
      ),
      prestige: player.totalPrestigeLevel ?? 0,
    },
  };
}

/**
 * Both sides plus the roster size they are measured against.
 *
 * The two lookups run together — they are independent upstream calls, and a
 * comparison waiting for one before starting the other doubles the time a
 * reader stares at a skeleton for no reason.
 */
export async function loadComparison(tagA: string, tagB: string) {
  const rosterSize = await getOfficialBrawlers()
    .then((r) => r.items.length)
    .catch(() => 0);

  const [a, b] = await Promise.all([
    loadPlayerSide(tagA, rosterSize),
    loadPlayerSide(tagB, rosterSize),
  ]);

  return { a, b, rosterSize };
}

/** Re-exported so the page can build progression rows without a second import. */
export { computeProgression };
