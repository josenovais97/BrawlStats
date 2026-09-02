import type { BSBrawler, BSPlayer } from '@/types/brawlstars';

/**
 * Account progression: how much of the game a player has unlocked, and roughly
 * what it cost them.
 *
 * ---------------------------------------------------------------------------
 * These are ESTIMATES against a hard-coded economy table. Supercell changes
 * upgrade costs between updates, and this file is the single place to fix when
 * they do. The per-level values below were checked against two independently
 * published totals: 3,740 power points and 7,765 coins to take one brawler
 * from power 1 to 11, and 310 / 560 to reach power 6.
 * ---------------------------------------------------------------------------
 */

/** Coins to go from power N to power N+1, indexed from level 1. */
const COIN_COST_PER_LEVEL = [20, 35, 75, 140, 290, 480, 800, 1250, 1875, 2800];

/** Power points to go from power N to power N+1, indexed from level 1. */
const POWER_POINT_COST_PER_LEVEL = [20, 30, 50, 80, 130, 210, 340, 550, 890, 1440];

export const MAX_POWER_LEVEL = 11;

/**
 * Coins to take one brawler from `level` to power 11.
 *
 * Exported so callers that talk about a subset of the roster — the stranded
 * hypercharges on the profile, say — price it from the same economy table as
 * `coinsToMaxOwned` rather than keeping a second copy of it.
 */
export function coinsToMaxFrom(level: number): number {
  return coinsToReachLevel(MAX_POWER_LEVEL) - coinsToReachLevel(level);
}

/**
 * Coins to take one brawler from `from` to `to`.
 *
 * Separate from `coinsToMaxFrom` because "what would make this brawler
 * playable" is a different question from "what would finish it". Power 9 is
 * where a brawler becomes usable in Ranked, and quoting the price of power 11
 * when 9 is the goal overstates the ask by more than half.
 */
export function coinsBetweenLevels(from: number, to: number): number {
  return Math.max(0, coinsToReachLevel(to) - coinsToReachLevel(from));
}

/** Coin prices for unlockable abilities. */
const STAR_POWER_COINS = 2000;
const GADGET_COINS = 1000;
const HYPERCHARGE_COINS = 5000;
/**
 * Gear prices vary by rarity (1000 / 1500 / 2000). Epic and mythic gears were
 * removed in July 2026, so the common case is the 1000-coin tier; the API does
 * not report the rarity, only a level, so this is the flat approximation.
 */
const GEAR_COINS = 1000;

/** Every brawler has three buffies: gadget, star power and hypercharge. */
export const BUFFIES_PER_BRAWLER = 3;

/**
 * Gear slots a brawler can actually equip at once.
 *
 * This, not the catalogue, is the denominator for gear completion. Gears are
 * the one category where owning everything is *irrational*: a brawler can field
 * two, so buying the other four is dead coin. Counting against the full
 * catalogue therefore punished exactly the players who spend well — measured
 * across real rosters, a Pro account with every brawler at power 11, every
 * hypercharge and every buffie sat at 2.51 gears per brawler and scored 40% on
 * gears, while a collector who had bought all six scored 98%.
 *
 * Owned gears are counted per brawler and capped at this, so the collector is
 * not pushed over 100% either. Both halves have to change together or the
 * ratio stops meaning anything.
 */
export const EQUIPPABLE_GEARS = 2;

/** Cumulative coins spent to reach a given power level from level 1. */
function coinsToReachLevel(level: number): number {
  return COIN_COST_PER_LEVEL.slice(0, Math.max(0, level - 1)).reduce((a, b) => a + b, 0);
}

/** Cumulative power points spent to reach a given power level from level 1. */
function powerPointsToReachLevel(level: number): number {
  return POWER_POINT_COST_PER_LEVEL.slice(0, Math.max(0, level - 1)).reduce(
    (a, b) => a + b,
    0,
  );
}

export interface OwnershipStat {
  /** Counted toward completion. May be capped — see `ownedRaw`. */
  owned: number;
  total: number;
  /**
   * Everything actually owned, when that can exceed what completion counts.
   *
   * Only gears differ today: completion counts two per brawler because that is
   * all one can equip, but plenty of players own more and the profile should
   * still say so rather than quietly hiding the extras.
   */
  ownedRaw?: number;
}

export interface ProgressionSummary {
  brawlers: OwnershipStat;
  maxedBrawlers: OwnershipStat;
  starPowers: OwnershipStat;
  gadgets: OwnershipStat;
  gears: OwnershipStat;
  hyperCharges: OwnershipStat;
  buffies: OwnershipStat;
  /** Brawlers with a non-default skin equipped. The API only reports the skin
   *  currently in use, never the full wardrobe, so this is not "skins owned". */
  skinsEquipped: number;

  coinsInvested: number;
  powerPointsInvested: number;
  /** Coins still needed to take every owned brawler to power 11. */
  coinsToMaxOwned: number;

  /** 0–1 across power levels and every unlockable ability in the game. */
  completion: number;
  /** True when the brawler catalogue was unavailable, so totals are unknown. */
  totalsUnavailable: boolean;
}

/* -------------------------------- playtime -------------------------------- */

/**
 * Typical match lengths in minutes. 3v3 modes usually run to roughly two
 * minutes; showdown drags a little longer.
 */
const MINUTES_PER_3V3 = 2;
const MINUTES_PER_SHOWDOWN = 2.5;

/**
 * Matches played per recorded victory.
 *
 * The API reports wins, never games played, so this inverts an assumed win
 * rate: 3v3 is symmetric so wins are about half of games; solo showdown pays a
 * win to 1 of 10, duo to 1 of 5. Rough by construction, and labelled as an
 * estimate wherever it is shown.
 */
const GAMES_PER_3V3_WIN = 2;
const GAMES_PER_SOLO_WIN = 10;
const GAMES_PER_DUO_WIN = 5;

export interface PlaytimeEstimate {
  matches: number;
  hours: number;
}

export function estimatePlaytime(player: BSPlayer): PlaytimeEstimate {
  const teamGames = (player['3vs3Victories'] ?? 0) * GAMES_PER_3V3_WIN;
  const soloGames = (player.soloVictories ?? 0) * GAMES_PER_SOLO_WIN;
  const duoGames = (player.duoVictories ?? 0) * GAMES_PER_DUO_WIN;

  const minutes =
    teamGames * MINUTES_PER_3V3 + (soloGames + duoGames) * MINUTES_PER_SHOWDOWN;

  return {
    matches: teamGames + soloGames + duoGames,
    hours: minutes / 60,
  };
}

/**
 * @param player           Player payload from the official API.
 * @param catalogue        Full brawler list from the official API, the only
 *                         source reporting gears and hypercharges per brawler.
 * @param releasedBuffies  Distinct buffies observed across the sampled
 *                         population. The API has no buffie catalogue, and
 *                         assuming three per brawler overstates the total, so
 *                         an observed count is preferred when available.
 */
export function computeProgression(
  player: BSPlayer,
  catalogue: BSBrawler[],
  releasedBuffies?: number | null,
): ProgressionSummary {
  const totalsUnavailable = catalogue.length === 0;

  // Totals available in the game.
  const totalBrawlers = catalogue.length || player.brawlers.length;
  const totalStarPowers = catalogue.reduce((n, b) => n + (b.starPowers?.length ?? 0), 0);
  const totalGadgets = catalogue.reduce((n, b) => n + (b.gadgets?.length ?? 0), 0);
  // Two per brawler in the catalogue, not every gear that exists. See
  // EQUIPPABLE_GEARS for why the catalogue is the wrong denominator here.
  const totalGears = catalogue.length * EQUIPPABLE_GEARS;
  const totalHyperCharges = catalogue.reduce(
    (n, b) => n + (b.hyperCharges?.length ?? 0),
    0,
  );
  // A buffie exists per ability *type* a brawler actually has, and only for
  // brawlers that have shipped one. The observed count is the better
  // denominator; the catalogue cap is the fallback before enough data exists.
  const buffieCap = catalogue.reduce(
    (n, b) =>
      n +
      ((b.starPowers?.length ?? 0) > 0 ? 1 : 0) +
      ((b.gadgets?.length ?? 0) > 0 ? 1 : 0) +
      ((b.hyperCharges?.length ?? 0) > 0 ? 1 : 0),
    0,
  );
  const totalBuffies =
    releasedBuffies && releasedBuffies > 0
      ? releasedBuffies
      : buffieCap || totalBrawlers * BUFFIES_PER_BRAWLER;

  // What the player actually has.
  let ownedStarPowers = 0;
  let ownedGadgets = 0;
  let ownedGears = 0;
  let ownedGearsRaw = 0;
  let ownedHyperCharges = 0;
  let ownedBuffies = 0;
  let skinsEquipped = 0;
  let maxedBrawlers = 0;
  let coinsInvested = 0;
  let powerPointsInvested = 0;
  let coinsToMaxOwned = 0;
  let earnedPowerSteps = 0;

  for (const brawler of player.brawlers) {
    const level = Math.min(Math.max(brawler.power, 1), MAX_POWER_LEVEL);

    coinsInvested += coinsToReachLevel(level);
    powerPointsInvested += powerPointsToReachLevel(level);
    coinsToMaxOwned += coinsToReachLevel(MAX_POWER_LEVEL) - coinsToReachLevel(level);
    earnedPowerSteps += level - 1;

    if (level >= MAX_POWER_LEVEL) maxedBrawlers += 1;

    const starPowers = brawler.starPowers?.length ?? 0;
    const gadgets = brawler.gadgets?.length ?? 0;
    const gears = brawler.gears?.length ?? 0;
    // Counted toward completion only up to what can be equipped, so a full
    // set of six reads as "done", not as 300% of one brawler's share.
    const usefulGears = Math.min(gears, EQUIPPABLE_GEARS);
    const hyperCharges = brawler.hyperCharges?.length ?? 0;

    ownedStarPowers += starPowers;
    ownedGadgets += gadgets;
    ownedGears += usefulGears;
    ownedGearsRaw += gears;
    ownedHyperCharges += hyperCharges;

    coinsInvested +=
      starPowers * STAR_POWER_COINS +
      gadgets * GADGET_COINS +
      // Deliberately the raw count, not `usefulGears`: completion asks what a
      // player needs, but coins invested asks what they actually spent, and a
      // collector who bought all six really did pay for all six.
      gears * GEAR_COINS +
      hyperCharges * HYPERCHARGE_COINS;

    // Buffies are unlocked through a gacha and keys as well as coins, so they
    // are counted for completion but deliberately left out of the coin total.
    const buffies = brawler.buffies;
    if (buffies) {
      ownedBuffies +=
        Number(Boolean(buffies.gadget)) +
        Number(Boolean(buffies.starPower)) +
        Number(Boolean(buffies.hyperCharge));
    }

    if (brawler.skin) skinsEquipped += 1;
  }

  // Completion counts every unit the game has: 10 power steps per brawler plus
  // each unlockable ability.
  const totalUnits =
    totalBrawlers * (MAX_POWER_LEVEL - 1) +
    totalStarPowers +
    totalGadgets +
    totalGears +
    totalHyperCharges +
    totalBuffies;

  const ownedUnits =
    earnedPowerSteps +
    ownedStarPowers +
    ownedGadgets +
    ownedGears +
    ownedHyperCharges +
    ownedBuffies;

  return {
    brawlers: { owned: player.brawlers.length, total: totalBrawlers },
    maxedBrawlers: { owned: maxedBrawlers, total: totalBrawlers },
    starPowers: { owned: ownedStarPowers, total: totalStarPowers },
    gadgets: { owned: ownedGadgets, total: totalGadgets },
    gears: { owned: ownedGears, total: totalGears, ownedRaw: ownedGearsRaw },
    hyperCharges: { owned: ownedHyperCharges, total: totalHyperCharges },
    buffies: { owned: ownedBuffies, total: totalBuffies },
    skinsEquipped,
    coinsInvested,
    powerPointsInvested,
    coinsToMaxOwned,
    completion: totalUnits > 0 ? Math.min(ownedUnits / totalUnits, 1) : 0,
    totalsUnavailable,
  };
}
