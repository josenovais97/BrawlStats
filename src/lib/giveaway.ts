/**
 * The first BrawlZone giveaway (2026-10-27): rules as code, no server state.
 *
 * Entries: 1 for entering, +2 for confirming in the Discord server, +1 for
 * each friend who enters with your link, up to 10. Following and
 * subscribing are asked for but never rewarded -- YouTube treats rewarding a
 * subscription as fake engagement, which would cost the channel the Creator
 * Code this is meant to bring closer.
 *
 * The winner is drawn from a public randomness beacon (drand, a new value
 * every 30 seconds, published by the League of Entropy) at the first round
 * after the giveaway closes: a number nobody, the organiser included, can
 * know while entries are still open. `drawWinner` (lib/giveaway-draw) is
 * deterministic given that value and the entry list, so anyone with both can
 * check the result. This file has no server imports: the form uses it too.
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
  // Placeholder dates until the owner launches it: one month, opening day TBD.
  opensAt: '2026-10-30T15:00:00Z',
  closesAt: '2026-11-30T20:00:00Z',
};

/** Whether the page and the form are public yet (owner's go-ahead pending). */
export const GIVEAWAY_PUBLIC = false;

export const DISCORD_BONUS = 2;
export const REFERRAL_CAP = 10;
/** Entries from one network in a day, so one phone cannot mint "friends". */
export const ENTRIES_PER_IP_PER_DAY = 3;

export function isOpen(now = Date.now(), g = GIVEAWAY): boolean {
  return now >= Date.parse(g.opensAt) && now < Date.parse(g.closesAt);
}

export interface EntryCounts {
  base: 1;
  discord: number;
  referrals: number;
  total: number;
}

export function entriesFor(discordConfirmed: boolean, referralCount: number): EntryCounts {
  const discord = discordConfirmed ? DISCORD_BONUS : 0;
  const referrals = Math.min(REFERRAL_CAP, Math.max(0, referralCount));
  return { base: 1, discord, referrals, total: 1 + discord + referrals };
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
