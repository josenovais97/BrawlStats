/**
 * TypeScript interfaces for the official Brawl Stars API
 * (https://developer.brawlstars.com), accessed via the RoyaleAPI proxy.
 *
 * Field names mirror the API exactly, including the awkward "3vs3Victories".
 */

export interface BSIconRef {
  id: number;
}

/**
 * A club reference on a player payload.
 *
 * Both fields are optional: for a player with no club the API returns an empty
 * object `{}` rather than null, so presence of `club` proves nothing and `tag`
 * must be checked before use.
 */
export interface BSClubRef {
  tag?: string;
  name?: string;
}

export interface BSAccessory {
  id: number;
  name: string;
}

export interface BSGear {
  id: number;
  name: string;
  level: number;
}

export interface BSSkinRef {
  id: number;
  name: string;
}

/** A brawler as owned by a specific player. */
export interface BSPlayerBrawler {
  id: number;
  name: string;
  power: number;
  rank: number;
  trophies: number;
  highestTrophies: number;
  prestigeLevel?: number;
  currentWinStreak?: number;
  maxWinStreak?: number;
  skin?: BSSkinRef | null;
  gadgets: BSAccessory[];
  starPowers: BSAccessory[];
  gears: BSGear[];
  hyperCharges?: BSAccessory[];
  /**
   * Buffies (added December 2025): one per ability type, each buffing the
   * brawler's gadgets, star powers or hypercharge. The API reports them as
   * three booleans rather than a list.
   */
  buffies?: {
    gadget?: boolean;
    starPower?: boolean;
    hyperCharge?: boolean;
  };
}

export interface BSPlayer {
  tag: string;
  name: string;
  nameColor: string | null;
  icon: BSIconRef;
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  expPoints: number;
  totalPrestigeLevel?: number;
  isQualifiedFromChampionshipChallenge: boolean;
  /** 3v3 wins across all modes. */
  '3vs3Victories': number;
  soloVictories: number;
  duoVictories: number;
  bestRoboRumbleTime: number;
  bestTimeAsBigBrawler: number;
  /** Ranked (formerly Power League) fields. Absent for players who never played it. */
  rankedSeasonId?: number;
  rankedRank?: number;
  rankedRankName?: string;
  rankedElo?: number;
  highestSeasonRankedRank?: number;
  highestSeasonRankedRankName?: string;
  highestSeasonRankedElo?: number;
  highestAllTimeRankedRank?: number;
  highestAllTimeRankedRankName?: string;
  highestAllTimeRankedElo?: number;
  club?: BSClubRef | null;
  brawlers: BSPlayerBrawler[];
}

/* ------------------------------- battle log ------------------------------- */

export interface BSBattleBrawler {
  id: number;
  name: string;
  power: number;
  trophies: number;
  trophyChange?: number;
}

export interface BSBattlePlayer {
  tag: string;
  name: string;
  brawler: BSBattleBrawler;
  /** Present in some showdown payloads where a player fields several brawlers. */
  brawlers?: BSBattleBrawler[];
}

export interface BSBattleEvent {
  id: number;
  mode: string;
  modeId?: number;
  map: string | null;
}

export type BSBattleResult = 'victory' | 'defeat' | 'draw';

export interface BSBattleDetail {
  mode: string;
  type: string;
  result?: BSBattleResult;
  /** Showdown-style modes report a placement instead of a result. */
  rank?: number;
  duration?: number;
  trophyChange?: number;
  starPlayer?: BSBattlePlayer | null;
  /** Team modes. */
  teams?: BSBattlePlayer[][];
  /** Solo showdown and similar free-for-all modes. */
  players?: BSBattlePlayer[];
  /** Ranked matches. */
  level?: { id: number; name: string };
}

export interface BSBattleLogEntry {
  /** Compact ISO-8601 basic format, e.g. "20260813T235142.000Z". */
  battleTime: string;
  event: BSBattleEvent;
  battle: BSBattleDetail;
}

export interface BSBattleLog {
  items: BSBattleLogEntry[];
  paging?: BSPaging;
}

/* ---------------------------------- club ---------------------------------- */

export type BSClubType = 'open' | 'inviteOnly' | 'closed' | 'unknown';

export type BSClubRole =
  | 'member'
  | 'senior'
  | 'vicePresident'
  | 'president'
  | 'notMember'
  | 'unknown';

export interface BSClubMember {
  tag: string;
  name: string;
  nameColor: string | null;
  role: BSClubRole;
  trophies: number;
  icon: BSIconRef;
}

export interface BSClub {
  tag: string;
  name: string;
  description: string;
  type: BSClubType;
  badgeId: number;
  requiredTrophies: number;
  trophies: number;
  isFamilyFriendly?: boolean;
  members: BSClubMember[];
}

/* -------------------------------- rankings -------------------------------- */

export interface BSPaging {
  cursors: { before?: string; after?: string };
}

export interface BSPlayerRanking {
  tag: string;
  name: string;
  nameColor: string | null;
  icon: BSIconRef;
  trophies: number;
  rank: number;
  club?: { name: string } | null;
}

export interface BSClubRanking {
  tag: string;
  name: string;
  badgeId: number;
  trophies: number;
  rank: number;
  memberCount: number;
}

export interface BSListResponse<T> {
  items: T[];
  paging?: BSPaging;
}

/* --------------------------------- events --------------------------------- */

export interface BSRotationSlot {
  /** Compact ISO-8601 basic format. */
  startTime: string;
  endTime: string;
  slotId: number;
  event: BSBattleEvent;
}

/* ------------------------------ brawler list ------------------------------ */

export interface BSBrawler {
  id: number;
  name: string;
  starPowers: BSAccessory[];
  gadgets: BSAccessory[];
  gears?: BSGear[];
  hyperCharges?: BSAccessory[];
}

/* --------------------------------- errors --------------------------------- */

/** Error body returned by the official API, e.g. `{ "reason": "notFound" }`. */
export interface BSErrorBody {
  reason?: string;
  message?: string;
}
