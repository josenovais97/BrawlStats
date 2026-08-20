/**
 * Canonical origin for the deployed site.
 *
 * Metadata needs absolute URLs for canonical links, Open Graph and structured
 * data. Preview deploys get their own hostname from Vercel, but the canonical
 * URL should still point at production, so the production origin wins whenever
 * it is set.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://brawlzone.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'BrawlZone';

/**
 * A real account to show the product on, for visitors who have not got their
 * own tag to hand.
 *
 * Deliberately a live lookup rather than a canned screenshot: the page it
 * opens is the same server-rendered profile everyone else gets, so nothing
 * here can drift out of date or overstate what a profile contains. It is the
 * tag already used as the search placeholder, so it is one account rather than
 * a second one to keep an eye on.
 */
export const SAMPLE_PLAYER_TAG = '2V0UL0GQV8';

/**
 * The month a page is being served in, for titles.
 *
 * A freshness signal, and one this site can actually make good on: the sampler
 * runs every three hours and these pages revalidate hourly to daily, so a
 * month in the title is a claim the data backs rather than decoration. Every
 * competitor that outranks us on "<brawler> build" carries one.
 *
 * Deliberately not the day. A date that specific reads as stale the moment it
 * is a day old, and the underlying numbers move on a slower cadence than that.
 */
export function currentMonth(): string {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
