/**
 * TypeScript interfaces for the free, no-auth static API at api.brawlapi.com.
 * Used purely for cosmetic metadata: icons, images, descriptions, map art.
 * Never contains player data, so it is safe to call from anywhere.
 */

export interface BAClass {
  id: number;
  name: string;
}

export interface BARarity {
  id: number;
  name: string;
  color: string;
}

export interface BAAccessory {
  id: number;
  name: string;
  path?: string;
  version?: number;
  description: string;
  descriptionHtml: string;
  imageUrl: string;
  released: boolean;
}

export interface BABrawler {
  id: number;
  avatarId: number;
  name: string;
  hash: string;
  path: string;
  fankit: string;
  released: boolean;
  version: number;
  link: string;
  /** Square icon with a rarity border. */
  imageUrl: string;
  /** Borderless portrait. */
  imageUrl2: string;
  /** Small emoji-sized pin. */
  imageUrl3: string;
  class: BAClass;
  rarity: BARarity;
  unlock: number | null;
  description: string;
  descriptionHtml: string;
  starPowers: BAAccessory[];
  gadgets: BAAccessory[];
  videos?: unknown[];
}

export interface BABrawlerList {
  list: BABrawler[];
}

export interface BAGameMode {
  id: number;
  scId: number;
  name: string;
  hash: string;
  /** Matches the `mode` string used by the official API, e.g. "gemGrab". */
  scHash: string;
  disabled: boolean;
  color: string;
  bgColor: string;
  version: number;
  title: string;
  tutorial: string;
  description: string;
  shortDescription?: string;
  sort1?: number;
  sort2?: number;
  link?: string;
  imageUrl: string;
  imageUrl2?: string;
  lastActive?: number | null;
  TID?: string;
}

export interface BAGameModeList {
  list: BAGameMode[];
}

export interface BAEnvironment {
  id: number;
  scId: number;
  name: string;
  hash: string;
  path: string;
  version: number;
  imageUrl: string;
}

export interface BAMap {
  id: number;
  new: boolean;
  disabled: boolean;
  name: string;
  hash: string;
  version: number;
  link: string;
  imageUrl: string;
  credit: string | null;
  environment: BAEnvironment;
  gameMode: Partial<BAGameMode> & { name: string; imageUrl: string };
}

export interface BAMapList {
  list: BAMap[];
}

export interface BAPlayerIcon {
  id: number;
  name: string;
  name2: string;
  imageUrl: string;
  imageUrl2: string;
  brawler: number | null;
  requiredExpLevel: number;
  requiredTotalTrophies: number;
  sortOrder: number;
  isReward: boolean;
  isAvailableForOffers: boolean;
}

export interface BAClubIcon {
  id: number;
  imageUrl: string;
}

export interface BAIcons {
  player: Record<string, BAPlayerIcon>;
  club: Record<string, BAClubIcon>;
}
