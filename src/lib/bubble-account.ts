/**
 * The account the overlay is filtering for, and how it is remembered.
 *
 * Browser-side only. The panel is a WebView inside the Android app, and the
 * app writes these keys into its storage before the page loads — so the page
 * never needs a tag in its URL. That is not a style choice: a query parameter
 * would opt `/bubble/panel` out of caching entirely (AGENTS.md trap 5), and
 * the panel is the one page on this site opened over and over in a hurry.
 *
 * Everything here degrades to "no account configured", which is the state the
 * overlay shipped in and still works perfectly well in.
 */

export const ACCOUNT_KEYS = {
  tag: 'brawlzone-bubble-tag',
  filter: 'brawlzone-bubble-filter',
  hide: 'brawlzone-bubble-hide',
  roster: 'brawlzone-bubble-roster',
} as const;

/**
 * How much of a roster the panel treats as fieldable.
 *
 * One value, not a set of flags, and the app picks it from three mutually
 * exclusive tiles. `hypercharge` implies `power11` — a hypercharge cannot be
 * unlocked below power 11, so "level 11 with hypercharge" is strictly narrower,
 * and the two as separate booleans had a fourth combination that means nothing.
 * The panel therefore only has to check the one active mode.
 */
export type OwnedFilter = 'all' | 'power11' | 'hypercharge';

export interface OwnedBrawler {
  id: number;
  power: number;
  hypercharge: boolean;
}

export interface CachedRoster {
  tag: string;
  name: string;
  /** The player's in-game icon, for the panel's header. Absent on old caches. */
  iconUrl?: string;
  brawlers: OwnedBrawler[];
  /** When this was fetched, so the panel can refresh it without a timer. */
  fetchedAt: number;
}

/**
 * A day.
 *
 * A roster changes when you level a brawler or unlock a hypercharge, which is
 * not something that happens between two drafts. Refetching per panel open
 * would put a live upstream API call on the hot path of a feature designed to
 * be opened constantly — the exact read pattern this project has been burned
 * by twice.
 */
export const ROSTER_TTL_MS = 86_400_000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readTag(): string | null {
  const tag = read(ACCOUNT_KEYS.tag);
  return tag && tag.trim() ? tag.trim().toUpperCase() : null;
}

/**
 * Whether to remove what you cannot field, rather than dim it.
 *
 * Off by default, and that default is deliberate. Dimming keeps the tier
 * counts honest and keeps a brawler you are one upgrade away from in view —
 * hiding makes the panel disagree with every other tier list, which reads as a
 * bug to anyone who knows the meta. It is opt-in for the people who would
 * rather see only what they can take.
 */
export function readHide(): boolean {
  return read(ACCOUNT_KEYS.hide) === '1';
}

export function readFilter(): OwnedFilter {
  const raw = read(ACCOUNT_KEYS.filter);
  return raw === 'power11' || raw === 'hypercharge' ? raw : 'all';
}

export function readRoster(tag: string): CachedRoster | null {
  const raw = read(ACCOUNT_KEYS.roster);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedRoster;
    // A cached roster for a different tag is not stale, it is wrong — someone
    // changed the account in the app and the panel must not answer for the
    // previous one.
    if (parsed?.tag !== tag) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRoster(roster: CachedRoster) {
  try {
    localStorage.setItem(ACCOUNT_KEYS.roster, JSON.stringify(roster));
  } catch {
    /* Storage full or blocked. The panel refetches next time and still works. */
  }
}

export function isStale(roster: CachedRoster, now = Date.now()): boolean {
  return now - roster.fetchedAt > ROSTER_TTL_MS;
}

/**
 * Whether this account can field a brawler under the current filter.
 *
 * A brawler that is not owned at all is never fieldable, which is the whole
 * point — the overlay was recommending picks the reader did not have.
 */
export function canField(
  owned: Map<number, OwnedBrawler>,
  brawlerId: number,
  filter: OwnedFilter,
): boolean {
  const b = owned.get(brawlerId);
  if (!b) return false;
  if (filter === 'power11') return b.power >= 11;
  if (filter === 'hypercharge') return b.power >= 11 && b.hypercharge;
  /*
   * `all` still means owned, not everything. Someone who has configured an
   * account is asking to be told what they can play; a filter that let through
   * brawlers they do not own would make the marking meaningless.
   */
  return true;
}

/** How the filter reads on screen, so the panel can say what it is doing. */
export const FILTER_LABEL: Record<OwnedFilter, string> = {
  all: 'Brawlers you own',
  power11: 'Power 11 only',
  hypercharge: 'Power 11 with hypercharge',
};
