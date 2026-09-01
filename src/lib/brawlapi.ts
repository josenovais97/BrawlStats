import { stripGameMarkup } from '@/lib/format';
import type {
  BAAccessory,
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

/** The neutral stand-in for a rarity whose colour cannot be trusted. */
export const FALLBACK_RARITY_COLOR = '#8b95b8';

/**
 * A rarity colour that is safe to interpolate into CSS.
 *
 * The artwork source ships at least one malformed value — Pierce's Legendary
 * rarity is `#fff11ev`, a typo for `#fff11e` — and it is not a harmless one.
 * An invalid colour inside `color-mix()` drops the *whole declaration*, so a
 * single stray character silently removes a card's border, plate or wash
 * wherever that brawler appears. It was reaching the page 43 times on a large
 * profile.
 *
 * Cleaned once here rather than guarded at each call site, because the call
 * sites are the problem: three of them checked and the rest did not.
 */
export function rarityColor(value: string | undefined | null): string {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value
    : FALLBACK_RARITY_COLOR;
}

export async function getBrawlers(): Promise<BABrawler[]> {
  const data = await baFetch<BABrawlerList>('/brawlers');
  return [...data.list]
    .sort((a, b) => a.id - b.id)
    .map((b) => ({
      ...b,
      // Every consumer reads `rarity.color` straight into a style, so it is
      // normalised at the source and never arrives broken.
      rarity: { ...b.rarity, color: rarityColor(b.rarity?.color) },
      starPowers: b.starPowers.map((a) => normalizeAccessory(a, starPowerIconUrl)),
      gadgets: b.gadgets.map((a) => normalizeAccessory(a, gadgetIconUrl)),
    }));
}

/**
 * Accessory descriptions arrive with the game's own markup still in them:
 * colour tags (`<cFFBB00>…</c>`) and value placeholders (`<!card.value1>`,
 * `<VALUE>`) that neither upstream API ever resolves to a number — the damage
 * and duration figures simply are not published anywhere. Rendered raw they
 * leak engine internals into the page, so colour tags are dropped and the
 * unresolved numbers become a plain "?".
 */
export function sanitizeDescription(text: string): string {
  return stripGameMarkup(text)
    .replace(/<![^<>]*>|<VALUE>/gi, '?')
    // The placeholder often sits in "<!token> %", which now reads "? %".
    .replace(/\s+%/g, '%')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * brawlapi hands out `borderless` artwork URLs, which 404 for every recently
 * released accessory, so the URL is rebuilt from the id against the variant
 * that is actually complete.
 */
function normalizeAccessory(
  accessory: BAAccessory,
  iconUrl: (id: number) => string,
): BAAccessory {
  return {
    ...accessory,
    imageUrl: iconUrl(accessory.id),
    description: sanitizeDescription(accessory.description),
  };
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
 * Keyed by `scHash` **lowercased**, plus the space-stripped lowercased name.
 *
 * The lowercasing is the part worth stating, because `battle.mode` arrives
 * camelCased ("gemGrab", "brawlBall") and looking it up unchanged silently
 * misses — silently, and only for the camelCase half of the roster, so
 * "knockout" and "heist" resolve while "brawlBall" and "hotZone" fall through
 * to whatever fallback the caller wrote. That shipped to /comps and /meta as
 * mode headings reading "brawlBall". Lowercase the key at every call site.
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

/** id -> mode. Maps reference their mode by numeric id, not by name. */
export async function getGameModeIdMap(): Promise<Map<number, BAGameMode>> {
  const modes = await getGameModes();
  return new Map(modes.map((m) => [m.id, m]));
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

/** Borderless brawler portrait, by id. Still a square tile, just unframed. */
export function brawlerPortraitUrl(brawlerId: number): string {
  return `https://cdn.brawlify.com/brawlers/borderless/${brawlerId}.png`;
}

/**
 * Full-body character render on a transparent background.
 *
 * Roughly ten times the weight of a portrait tile, so this is for decorative
 * hero art only — never for lists.
 */
export function brawlerModelUrl(brawlerId: number): string {
  return `https://cdn.brawlify.com/brawlers/model/${brawlerId}.png`;
}

/** A render that exists will not stop existing; a missing one might land. */
const MODEL_TTL_FOUND = 86_400_000;
const MODEL_TTL_MISSING = 3_600_000;

interface ModelProbe {
  expires: number;
  result: Promise<boolean>;
}

const modelProbes = new Map<number, ModelProbe>();

/**
 * Whether a full-body render actually exists for a brawler.
 *
 * The CDN publishes `/model/` weeks behind a release — Nori and Wendy both 404
 * today — and nothing in the metadata says so: the payload hands out an
 * `imageUrl` for the portrait and never mentions the render at all. So the only
 * honest answer comes from asking, which is one HEAD request.
 *
 * Worth asking because the hero puts the live top three on a podium: whoever is
 * winning this week is exactly the brawler whose art has not landed yet, and a
 * broken image is the one thing a landing page cannot show.
 *
 * Memoised in-process rather than through the data cache, which only stores
 * GET. Left on default fetch semantics deliberately — `no-store` would opt the
 * whole landing page out of static rendering to ask a question whose answer
 * changes once per brawler, ever.
 */
export function hasBrawlerModel(brawlerId: number): Promise<boolean> {
  const cached = modelProbes.get(brawlerId);
  if (cached && cached.expires > Date.now()) return cached.result;

  const result: Promise<boolean> = fetch(brawlerModelUrl(brawlerId), {
    method: 'HEAD',
    signal: AbortSignal.timeout(5_000),
  })
    .then((res) => res.ok)
    /*
     * A failed probe counts as a hit. A timeout is not evidence of a missing
     * file, and hiding artwork that exists over one flaky request is the worse
     * mistake of the two.
     */
    .catch(() => true)
    .then((found) => {
      modelProbes.set(brawlerId, {
        expires: Date.now() + (found ? MODEL_TTL_FOUND : MODEL_TTL_MISSING),
        result,
      });
      return found;
    });

  // Held on the short life while in flight, so a hung request cannot pin an
  // answer nobody has given yet.
  modelProbes.set(brawlerId, { expires: Date.now() + MODEL_TTL_MISSING, result });
  return result;
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

/**
 * Star power artwork, by accessory id.
 *
 * `regular` rather than `borderless`: the borderless set stops being published
 * a few releases back, so newer star powers render as broken images there.
 */
export function starPowerIconUrl(id: number): string {
  return `https://cdn.brawlify.com/star-powers/regular/${id}.png`;
}

/** Gadget artwork, by accessory id. Same `borderless` gap as star powers. */
export function gadgetIconUrl(id: number): string {
  return `https://cdn.brawlify.com/gadgets/regular/${id}.png`;
}

/** Gear artwork, by gear id. */
export function gearIconUrl(id: number): string {
  return `https://cdn.brawlify.com/gears/regular/${id}.png`;
}
