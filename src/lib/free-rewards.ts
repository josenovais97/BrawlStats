import 'server-only';

import { SITE_URL, USER_AGENT } from '@/lib/site';

/**
 * The free reward links Supercell hands out, for /rewards (2026-10-27).
 *
 * Read from the feed `brawlzone-rewards` already writes for the Bubble app
 * (`/social/rewards/latest.json`, the newest twenty, served by Caddy as a
 * file), so the page needs no table and no job of its own: a reward is on
 * the site within five minutes of the job posting it everywhere else.
 */
export interface FreeReward {
  id: string;
  name: string;
  url: string;
  image: string | null;
  postedAt: string;
}

/** How long a link is shown as live. Supercell does not say; most last days, not weeks. */
export const LIVE_DAYS = 7;

/**
 * Only Supercell's own links, whatever the feed says. The job already refuses
 * anything else; this is the page refusing it too, because a claim button on
 * this site pointing anywhere else would be the exact scam the page warns
 * about.
 */
const OFFICIAL = /^https:\/\/(link\.brawlstars\.com|store\.supercell\.com)\//;

export async function getFreeRewards(): Promise<{ live: FreeReward[]; earlier: FreeReward[] }> {
  let items: FreeReward[] = [];
  try {
    const res = await fetch(`${SITE_URL}/social/rewards/latest.json`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const feed = (await res.json()) as { items?: FreeReward[] };
      items = (feed.items ?? []).filter((r) => r && typeof r.name === 'string' && OFFICIAL.test(r.url));
    }
  } catch {
    // An empty page that says "nothing right now" beats an error page.
  }
  const cutoff = Date.now() - LIVE_DAYS * 86_400_000;
  const newest = [...items].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  return {
    live: newest.filter((r) => Date.parse(r.postedAt) >= cutoff),
    earlier: newest.filter((r) => Date.parse(r.postedAt) < cutoff),
  };
}
