/**
 * The free daily reward in Supercell's Brawl Stars store (2026-11-24).
 *
 * One free reward a day, the same clock for everyone: it changes at 08:00
 * UTC. What it is shows only after signing in, so this site cannot see it in
 * the store: brawlzone-rewards-watch finds its name elsewhere, and the card
 * stands without one.
 *
 * Plain functions, shared by the page and the browser.
 */
export const DAILY_STORE_URL = 'https://store.supercell.com/brawlstars';

/** The hour, UTC, the store changes its daily reward. */
export const STORE_RESET_HOUR = 8;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The store's day at `ms`, as YYYY-MM-DD: it starts at 08:00 UTC, so 07:59 is still yesterday's. */
export function storeDay(ms: number): string {
  return new Date(ms - STORE_RESET_HOUR * HOUR).toISOString().slice(0, 10);
}

/** When the reward on offer at `ms` goes away. */
export function nextStoreReset(ms: number): number {
  return Math.floor((ms - STORE_RESET_HOUR * HOUR) / DAY) * DAY + DAY + STORE_RESET_HOUR * HOUR;
}

/** Hours and minutes left, never negative. */
export function timeLeft(ms: number): { h: number; m: number } {
  const minutes = Math.max(0, Math.ceil((nextStoreReset(ms) - ms) / 60_000));
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

/** The week the daily reward is also announced (owner's trial): the same dates as deploy/bin/brawlzone-daily-gift. */
export const DAILY_ALERT_DAYS = { from: '2026-11-25', to: '2026-12-01' };

/**
 * Whether the Bubble app is told about today's reward at `ms`: in the trial
 * week, from 15:00 UTC (08:00 is the middle of the night in America) until two
 * hours before it changes, so a phone that checks late is not sent to a reward
 * about to go.
 */
export function dailyAlertOn(ms: number): boolean {
  const day = storeDay(ms);
  if (day < DAILY_ALERT_DAYS.from || day > DAILY_ALERT_DAYS.to) return false;
  const left = nextStoreReset(ms) - ms;
  return left <= 17 * HOUR && left >= 2 * HOUR;
}

/** Where the daily card's button goes: the reward's own page when known, else the store. */
export function dailyGiftUrl(url: unknown): string {
  return typeof url === 'string' && /^https:\/\/store\.supercell\.com\/brawlstars\/product\/[a-z-]+\/[0-9A-Za-z]+$/.test(url)
    ? url
    : DAILY_STORE_URL;
}

/**
 * Supercell Store's Black Friday (store.supercell.com/blackfriday, read
 * 2026-11-24): November 27 to 30. The note on /rewards shows until the last
 * store day ends.
 */
export const BLACK_FRIDAY = { from: '2026-11-27', to: '2026-11-30', noteUntil: '2026-12-01T08:00:00Z', url: 'https://store.supercell.com/blackfriday' };

export function blackFridayOn(ms: number): boolean {
  return ms < Date.parse(BLACK_FRIDAY.noteUntil);
}

/** The store's day and whether its Black Friday note is up, now. */
export function storeNow(): { day: string; blackFriday: boolean } {
  const ms = Date.now();
  return { day: storeDay(ms), blackFriday: blackFridayOn(ms) };
}

/** "November 24", in the reader's language, for a store day. */
export function dayLabel(day: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * A store gift that is claimed by adding the store to the phone's home screen
 * (the 20 Gems of November 2026). Its link is the plain store page with this
 * marker, which the store ignores and this site reads to show the steps.
 */
export function isHomeScreenGift(url: string): boolean {
  return /^https:\/\/store\.supercell\.com\/(?:[a-z-]+\/)?brawlstars\/?#add-to-home-screen$/.test(url);
}
