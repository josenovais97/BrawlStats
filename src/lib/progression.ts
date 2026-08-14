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
  owned: number;
  total: number;
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

/**
 * @param player    Player payload from the official API.
 * @param catalogue Full brawler list from the official API, which is the only
 *                  source that reports gears and hypercharges per brawler.
 */
export function computeProgression(
  player: BSPlayer,
  catalogue: BSBrawler[],
): ProgressionSummary {
  const totalsUnavailable = catalogue.length === 0;

  // Totals available in the game.
  const totalBrawlers = catalogue.length || player.brawlers.length;
  const totalStarPowers = catalogue.reduce((n, b) => n + (b.starPowers?.length ?? 0), 0);
  const totalGadgets = catalogue.reduce((n, b) => n + (b.gadgets?.length ?? 0), 0);
  const totalGears = catalogue.reduce((n, b) => n + (b.gears?.length ?? 0), 0);
  const totalHyperCharges = catalogue.reduce(
    (n, b) => n + (b.hyperCharges?.length ?? 0),
    0,
  );
  const totalBuffies = totalBrawlers * BUFFIES_PER_BRAWLER;

  // What the player actually has.
  let ownedStarPowers = 0;
  let ownedGadgets = 0;
  let ownedGears = 0;
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
    const hyperCharges = brawler.hyperCharges?.length ?? 0;

    ownedStarPowers += starPowers;
    ownedGadgets += gadgets;
    ownedGears += gears;
    ownedHyperCharges += hyperCharges;

    coinsInvested +=
      starPowers * STAR_POWER_COINS +
      gadgets * GADGET_COINS +
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
    gears: { owned: ownedGears, total: totalGears },
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
