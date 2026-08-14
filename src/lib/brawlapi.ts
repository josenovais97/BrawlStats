import type {
  BABrawler,
  BABrawlerList,
  BAGameMode,
  BAGameModeList,
  BAIcons,
  BAMap,
  BAMapList,
} from '@/types/brawlapi';

/**
 * api.brawlapi.com is a free, keyless, static metadata mirror. It supplies the
 * artwork and flavour text the official API omits: brawler portraits, rarity
 * colours, star power / gadget descriptions, map images and game mode icons.
 *
 * No auth means there is nothing to protect here, but we still fetch it
 * server-side and cache it hard — it only changes on game updates.
 */
const BRAWLAPI_BASE = 'https://api.brawlapi.com/v1';

/** Static metadata: refresh once a day is plenty. */
const REVALIDATE_STATIC = 86_400;

async function baFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BRAWLAPI_BASE}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: REVALIDATE_STATIC },
  });
  if (!res.ok) throw new Error(`brawlapi ${path} responded ${res.status}`);
  return (await res.json()) as T;
}

/* -------------------------------- brawlers -------------------------------- */

export async function getBrawlers(): Promise<BABrawler[]> {
  const data = await baFetch<BABrawlerList>('/brawlers');
  return [...data.list].sort((a, b) => a.id - b.id);
}

export async function getBrawler(id: number): Promise<BABrawler | undefined> {
  const list = await getBrawlers();
  return list.find((b) => b.id === id);
}

/** id -> brawler, for decorating player and battle log payloads with artwork. */
export async function getBrawlerMap(): Promise<Map<number, BABrawler>> {
  const list = await getBrawlers();
  return new Map(list.map((b) => [b.id, b]));
}

/* ------------------------------- game modes ------------------------------- */

export async function getGameModes(): Promise<BAGameMode[]> {
  const data = await baFetch<BAGameModeList>('/gamemodes');
  return data.list;
}

/**
 * Keyed by `scHash`, which is the same string the official API returns in
 * `battle.mode` and `event.mode` (e.g. "gemGrab", "soloShowdown").
 */
export async function getGameModeMap(): Promise<Map<string, BAGameMode>> {
  const modes = await getGameModes();
  const map = new Map<string, BAGameMode>();
  for (const m of modes) {
    if (m.scHash) map.set(m.scHash.toLowerCase(), m);
    map.set(m.name.toLowerCase().replace(/\s+/g, ''), m);
  }
  return map;
}

/* ---------------------------------- maps ---------------------------------- */

export async function getMaps(): Promise<BAMap[]> {
  const data = await baFetch<BAMapList>('/maps');
  return data.list;
}

/** Keyed by the numeric event id used by the official rotation endpoint. */
export async function getMapMap(): Promise<Map<number, BAMap>> {
  const maps = await getMaps();
  return new Map(maps.map((m) => [m.id, m]));
}

/* ---------------------------------- icons --------------------------------- */

export async function getIcons(): Promise<BAIcons> {
  return baFetch<BAIcons>('/icons');
}

/**
 * Profile icon and club badge URLs follow a stable CDN pattern, so we build
 * them directly rather than shipping the whole (large) icons payload just to
 * render one image.
 */
export function playerIconUrl(iconId: number | undefined): string {
  return `https://cdn.brawlify.com/profile-icons/regular/${iconId ?? 28000000}.png`;
}

export function clubBadgeUrl(badgeId: number | undefined): string {
  return `https://cdn.brawlify.com/club-badges/regular/${badgeId ?? 8000000}.png`;
}

/** Square brawler icon with rarity border, by id. */
export function brawlerIconUrl(brawlerId: number): string {
  return `https://cdn.brawlify.com/brawlers/borders/${brawlerId}.png`;
}

/** Borderless brawler portrait, by id. */
export function brawlerPortraitUrl(brawlerId: number): string {
  return `https://cdn.brawlify.com/brawlers/borderless/${brawlerId}.png`;
}

/**
 * Ranked tier badge.
 *
 * The CDN publishes 22 tier images keyed from 58000000, matching the API's
 * 1-based `rankedRank`. Returns null for an unranked player so callers can
 * skip the image instead of rendering a broken one.
 */
const RANKED_TIER_BASE_ID = 58000000;
const RANKED_TIER_COUNT = 22;

export function rankedTierIconUrl(rank: number | undefined | null): string | null {
  if (!rank || rank < 1 || rank > RANKED_TIER_COUNT) return null;
  return `https://cdn.brawlify.com/ranked/tiered/${RANKED_TIER_BASE_ID + rank - 1}.png`;
}

/** Broad ranked league badge, e.g. "Bronze" or "Masters". */
export function rankedLeagueIconUrl(rankName: string | undefined | null): string | null {
  if (!rankName) return null;
  // "BRONZE I" -> "Bronze"
  const league = rankName.trim().split(/\s+/)[0];
  if (!league) return null;
  const normalized = league.charAt(0).toUpperCase() + league.slice(1).toLowerCase();
  return `https://cdn.brawlify.com/ranked/regular/${normalized}.png`;
}

/** Prestige badge, 0–6. */
export function prestigeIconUrl(level: number | undefined | null): string | null {
  if (level === undefined || level === null) return null;
  const capped = Math.min(Math.max(level, 0), 6);
  return `https://cdn.brawlify.com/prestiges/regular/${capped}.png`;
}

/** Star power artwork, by accessory id. */
export function starPowerIconUrl(id: number): string {
  return `https://cdn.brawlify.com/star-powers/borderless/${id}.png`;
}

/** Gadget artwork, by accessory id. */
export function gadgetIconUrl(id: number): string {
  return `https://cdn.brawlify.com/gadgets/borderless/${id}.png`;
}

/** Gear artwork, by gear id. */
export function gearIconUrl(id: number): string {
  return `https://cdn.brawlify.com/gears/regular/${id}.png`;
}
