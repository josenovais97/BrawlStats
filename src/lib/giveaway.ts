/**
 * The first BrawlZone giveaway (2026-10-27): rules as code, no server state.
 *
 * A contest, not a draw: points for entering (1), for confirming in the
 * Discord server (+2), for following on Instagram and TikTok and
 * subscribing on YouTube (+1 each, on the entrant's word: no platform lets
 * anyone check) and for every friend who enters with your link (+1, no
 * limit). Most points when it closes wins; a tie goes to whoever entered
 * first. Nothing is left to luck -- the owner checked Portuguese law, where a
 * prize decided by chance needs a council's authorisation weeks ahead.
 *
 * The YouTube point is the owner's call (2026-10-27), made after being told
 * YouTube treats a rewarded subscription as fake engagement and that the
 * Creator Code application could suffer for it.
 *
 * This file has no server imports: the form uses it too.
 */
export interface Giveaway {
  id: string;
  /** Shown as is; translations key off it. */
  prize: string;
  opensAt: string;
  closesAt: string;
}

export const GIVEAWAY: Giveaway = {
  id: 'gw1',
  prize: '€10 Google Play or App Store gift card',
  // One month, opened 2026-10-27 at the owner's word.
  opensAt: '2026-10-27T15:00:00Z',
  closesAt: '2026-11-27T20:00:00Z',
};

/**
 * The Brawl Pass, which the prize pays for: the wiki's art, loaded by the
 * visitor's browser like the skin pages' (the wiki's CDN refuses this box),
 * with our own box as the fallback if it does not load.
 */
export const BRAWL_PASS_ART =
  'https://static.wikia.nocookie.net/brawlstars/images/0/0f/Brawl_Pass.png/revision/latest/scale-to-width-down/600';
export const PRIZE_FALLBACK_ART = '/rewards/box-rainbow.png';

/** Whether the page and the form are public (launched 2026-10-27). */
export const GIVEAWAY_PUBLIC = true;

export const DISCORD_BONUS = 2;
/** Entries from one network in a day, so one phone cannot mint "friends". */
export const ENTRIES_PER_IP_PER_DAY = 3;

export function isOpen(now = Date.now(), g = GIVEAWAY): boolean {
  return now >= Date.parse(g.opensAt) && now < Date.parse(g.closesAt);
}

export function notOpenYet(now = Date.now(), g = GIVEAWAY): boolean {
  return now < Date.parse(g.opensAt);
}

export function hasClosed(now = Date.now(), g = GIVEAWAY): boolean {
  return now >= Date.parse(g.closesAt);
}

export const FOLLOW_PLATFORMS = ['youtube', 'tiktok', 'instagram'] as const;
export type FollowPlatform = (typeof FOLLOW_PLATFORMS)[number];

export interface EntryCounts {
  base: 1;
  discord: number;
  follows: number;
  referrals: number;
  total: number;
}

export function entriesFor(discordConfirmed: boolean, referralCount: number, follows = 0): EntryCounts {
  const discord = discordConfirmed ? DISCORD_BONUS : 0;
  const referrals = Math.max(0, referralCount);
  const followed = Math.min(FOLLOW_PLATFORMS.length, Math.max(0, follows));
  return { base: 1, discord, follows: followed, referrals, total: 1 + discord + followed + referrals };
}

export interface Standing {
  code: string;
  playerName: string;
  points: number;
  enteredAt: number;
}

/** Most points first; a tie goes to whoever entered first. */
export function rank<T extends Standing>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.points - a.points || a.enteredAt - b.enteredAt || a.code.localeCompare(b.code));
}

/** Eight characters a kid can read out over voice chat: no 0/O, 1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode(random: (n: number) => number): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

export function isCode(value: string | null | undefined): value is string {
  return !!value && /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(value);
}

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}
