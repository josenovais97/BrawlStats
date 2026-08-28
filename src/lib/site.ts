/**
 * Canonical origin for the deployed site.
 *
 * Metadata needs absolute URLs for canonical links, Open Graph and structured
 * data. Preview deploys get their own hostname from Vercel, but the canonical
 * URL should still point at production, so the production origin wins whenever
 * it is set.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://brawlzone.net'
).replace(/\/$/, '');

export const SITE_NAME = 'BrawlZone';

/**
 * Where to write in.
 *
 * A real, monitored address rather than a form. A contact form needs a POST
 * handler, spam defences and somewhere to put the submissions — all of which
 * this site would have to build and maintain — and a `mailto:` needs none of
 * it. It is also the trust signal search engines look for: a site publishing
 * numbers about other people's accounts should say who is behind it and how to
 * reach them.
 */
export const CONTACT_EMAIL = 'contact@brawlzone.net';

/**
 * How this site identifies itself to the APIs it reads.
 *
 * Built from the origin above rather than written out, because it had been
 * written out — three times, in three files, all still naming the old
 * vercel.app host after the move. A contact URL exists so an operator whose
 * API we are calling can reach us; one that 404s is worse than none, and
 * nothing about a hardcoded copy would ever have told us it had gone stale.
 *
 * The wiki and news endpoints this is sent to ask for a real identifier and a
 * way to get in touch, which is what this is.
 */
export const USER_AGENT = `${SITE_NAME}/1.0 (+${SITE_URL})`;

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
/*
 * The profile the landing page offers as an example, so it has to show the
 * site working rather than merely load.
 *
 * The previous pick had ranked elo 0 and had not been seen in game for a
 * fortnight, so the example demonstrated an empty Ranked section, a capped
 * skill score and no recent battles -- every feature worth showing, missing.
 *
 * Chosen 2026-08-28 for activity, not size: 7,850 ranked elo and ~150 battles
 * in the last week, which is what makes the Ranked, battle-log and progression
 * sections all have something to say. Worth re-checking if it ever goes quiet;
 * an inactive example is the same bug again.
 */
export const SAMPLE_PLAYER_TAG = '2RLCPVGUG';

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
