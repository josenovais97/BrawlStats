import 'server-only';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
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
  /** The reward's own game art (see `rewardArt`), added here, not in the feed. */
  art: string;
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

/**
 * Art for what a reward gives. Boxes are Brawlify's box icons (MIT, the
 * same CDN as the gadget and gear marks), kept in public/rewards so they never
 * depend on someone else's CDN; currencies reuse the site's own icons. Matched
 * on the name the job saw ("Mega Box", "1000 Power Points"); a brawler's own
 * box shows the brawler. Anything unknown gets the rainbow box.
 */
const ART: [RegExp, string][] = [
  [/mega box/i, '/rewards/box-red.png'],
  [/big box/i, '/rewards/box-pink.png'],
  [/starr drop/i, '/icons/starr-drop.png'],
  [/power point/i, '/icons/power-point.png'],
  [/coin/i, '/icons/coin.png'],
  [/box/i, '/rewards/box-blue.png'],
];
const FALLBACK = '/rewards/box-rainbow.png';

export function rewardArt(name: string, brawlers: { name: string; art: string }[]): string {
  const brawler = [...brawlers]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => new RegExp(`\\b${b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(name));
  if (brawler) return brawler.art;
  return ART.find(([re]) => re.test(name))?.[1] ?? FALLBACK;
}

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
  const catalog = await getBrawlerCatalog().catch(() => null);
  const brawlers = (catalog?.current ?? []).map((b) => ({ name: b.name, art: b.meta?.imageUrl2 ?? b.imageUrl }));
  items = items.map((r) => ({ ...r, art: rewardArt(r.name, brawlers) }));
  const cutoff = Date.now() - LIVE_DAYS * 86_400_000;
  const newest = [...items].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  return {
    live: newest.filter((r) => Date.parse(r.postedAt) >= cutoff),
    earlier: newest.filter((r) => Date.parse(r.postedAt) < cutoff),
  };
}
