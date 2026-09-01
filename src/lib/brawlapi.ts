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

/**
 * The seven classes the game actually has.
 *
 * Checked rather than trusted, because on 2026-09-01 the mirror started
 * returning the brawler's *tagline* in `class.name` — Vince came back as
 * `{ id: 107, name: "Collect Caterpillars To Become More Powerful" }`, and the
 * id is the brawler's index rather than a class id. Nothing errored: the
 * brawler index rendered a filter row with one chip per brawler ("Bombard
 * Safely From Behind Walls."), and every brawler page showed a sentence where
 * its class chip belongs.
 *
 * A closed set is the right shape for this. There have been seven classes for
 * years and a new one would be a headline change, so anything outside the set
 * is upstream noise rather than a class this code has not heard of. Returning
 * null routes the brawler to the wiki fallback, which already existed for the
 * brawlers the mirror reported as "Unknown" and is correct for all of them.
 */
const BRAWLER_CLASSES = new Set([
  'Artillery',
  'Assassin',
  'Controller',
  'Damage Dealer',
  'Marksman',
  'Support',
  'Tank',
]);

/** The mirror's class name when it is one, and null when it is anything else. */
export function realBrawlerClass(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed && BRAWLER_CLASSES.has(trimmed) ? trimmed : null;
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

/**
 * A mode's display name, however the caller happens to hold its key.
 *
 * Wraps the two things every caller was getting wrong on its own: the map is
 * keyed lowercase while `battle.mode` is camelCase, and a mode the artwork
 * source has dropped has no entry at all. Retired modes still appear in
 * sampled battles — Siege is gone from Brawlify's list and still in the data —
 * so the fallback has to be presentable rather than a raw key.
 */
export function modeLabel(modes: Map<string, BAGameMode>, key: string): string {
  const known = modes.get(key.toLowerCase())?.name;
  if (known) return known;
  // "brawlBall" -> "Brawl Ball": split the camel hump, then capitalise.
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
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

/** Artwork that exists will not stop existing; a missing file might land. */
const ART_TTL_FOUND = 86_400_000;
const ART_TTL_MISSING = 3_600_000;

interface ArtProbe {
  expires: number;
  result: Promise<boolean>;
}

const artProbes = new Map<string, ArtProbe>();

/**
 * Whether a CDN artwork file actually exists, by asking for its headers.
 *
 * The mirror builds every artwork URL from a brawler id, so a file it has not
 * published yet does not fall back — it 404s, and nothing in the metadata says
 * so. Only asking gives an honest answer, and it costs one HEAD request.
 *
 * Memoised in-process rather than through the data cache, which only stores
 * GET. Left on default fetch semantics deliberately — `no-store` would opt a
 * whole page out of static rendering to ask a question whose answer changes
 * once per brawler, ever.
 */
function hasArtwork(url: string): Promise<boolean> {
  const cached = artProbes.get(url);
  if (cached && cached.expires > Date.now()) return cached.result;

  const result: Promise<boolean> = fetch(url, {
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
      artProbes.set(url, {
        expires: Date.now() + (found ? ART_TTL_FOUND : ART_TTL_MISSING),
        result,
      });
      return found;
    });

  // Held on the short life while in flight, so a hung request cannot pin an
  // answer nobody has given yet.
  artProbes.set(url, { expires: Date.now() + ART_TTL_MISSING, result });
  return result;
}

/**
 * Whether a full-body render exists.
 *
 * The CDN publishes `/model/` weeks behind a release, and the hero puts the
 * live top three on a podium — whoever is winning this week is exactly the
 * brawler whose art has not landed yet.
 */
export function hasBrawlerModel(brawlerId: number): Promise<boolean> {
  return hasArtwork(brawlerModelUrl(brawlerId));
}

/**
 * Whether the square portrait tile exists — the one every list on the site uses.
 *
 * Worth probing because the mirror publishes a brawler's *metadata* before its
 * *artwork*. On 2026-09-01 Cosmo and Vince appeared in the payload with
 * constructed `imageUrl`s that 404, which is a worse failure than being absent
 * entirely: the catalogue's wiki-portrait fallback keyed on "the mirror has no
 * entry", so the moment the entry arrived the fallback switched off and the
 * roster rendered two broken images. Existence, not presence of a URL, is the
 * question that matters.
 */
export function hasBrawlerPortrait(brawlerId: number): Promise<boolean> {
  return hasArtwork(brawlerIconUrl(brawlerId));
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
