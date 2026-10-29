import 'server-only';

import { SITE_URL, USER_AGENT } from '@/lib/site';
import { WIKI_API, fetchWikiJson } from '@/lib/wiki';

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
  /** The reward's own game art (see `withArt`), added here, not in the feed. */
  art: string;
  /** Our own art for it, shown if `art` fails to load. */
  fallbackArt: string;
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
 * Art we ship ourselves, for when the wiki has nothing better or its image
 * fails to load. Generic boxes are Brawlify's box icons (MIT, the same CDN as the gadget and gear marks), kept
 * in public/rewards; currencies reuse the site's own icons. Matched loosely on
 * the name the job saw, so "Legendary Starr Drop", which has no art of its
 * own on the wiki, still gets a Starr Drop.
 */
const LOCAL_ART: [RegExp, string][] = [
  // Supercell's Fan Kit art (fankit.supercell.com, 2026-10-29), in
  // public/rewards/art: the reward posts read the same files.
  [/ranked starr drop/i, '/rewards/art/ranked-starr-drop.png'],
  [/credit/i, '/rewards/art/credits.png'],
  [/gem/i, '/rewards/art/gems.png'],
  [/bling/i, '/rewards/art/bling.png'],
  [/xp doubler/i, '/rewards/art/xp-doublers.png'],
  [/power point/i, '/rewards/art/power-points.png'],
  [/coin/i, '/rewards/art/coins.png'],
  [/coffin box/i, '/rewards/art/coffin-box.png'],
  [/nori box/i, '/rewards/art/nori-box.png'],
  [/wendy box/i, '/rewards/art/wendy-box.png'],
  [/mecha box/i, '/rewards/art/mecha-box.png'],
  [/mega box/i, '/rewards/box-red.png'],
  [/big box/i, '/rewards/box-pink.png'],
  [/starr drop/i, '/icons/starr-drop.png'],
  [/box/i, '/rewards/box-blue.png'],
];

/**
 * A gift of our own drawing, for a reward nothing matches.
 *
 * It was the rainbow box until 2026-10-28, when a Chaos Drop went out and the
 * page showed it as a box: a specific item's art on the wrong reward reads as
 * a promise. A plain gift says "a reward" and nothing more.
 */
const FALLBACK = '/rewards/gift.png';

/** Our own art for a reward, or the gift. The wiki's comes first; see `withArt`. */
export function rewardArt(name: string): string {
  return LOCAL_ART.find(([re]) => re.test(name))?.[1] ?? FALLBACK;
}

/**
 * "1x Chaos Drop" -> "Chaos Drop", "2000 Credits" -> "Credits".
 *
 * Supercell's vouchers are named by what they give, with a count in front or
 * behind; the art is for the thing, not the count.
 */
export function rewardBase(name: string): string {
  return name
    .replace(/^\s*\d[\d,.]*\s*[x×]?\s*/i, '')
    .replace(/\s*[x×]\s*\d+\s*$/i, '')
    .trim();
}

/**
 * Wiki file names worth trying for a reward, best first.
 *
 * The wiki names most items' art after the item ("Chaos Drop.png",
 * "Vince Box.png"); currencies are the exception and have `Icon-` files that
 * are the in-game marks rather than a pile of them.
 */
const WIKI_ALIAS: Record<string, string> = {
  // The wiki's plain "Chaos Drop.png" is the grey, colourless drop; the
  // coloured art is per rarity, and its own Chaos Drops section leads with
  // the Rare one (2026-10-28).
  'chaos drop': 'Rare Chaos Drop.png',
  gem: 'Icon-Gem.png',
  credit: 'Icon-Credit.png',
  bling: 'Icon-Bling.png',
  coin: 'Icon-Coin.png',
  'power point': 'Icon-Power Point.png',
  'xp doubler': 'XP Doubler.png',
};

export function wikiArtCandidates(name: string): string[] {
  const base = rewardBase(name);
  if (!base) return [];
  // "Boxes" -> "Box", "Credits" -> "Credit"; "Bling" and "Brawl Pass" stay.
  const one = base.replace(/(box)es$/i, '$1').replace(/([^s])s$/i, '$1');
  const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const alias = WIKI_ALIAS[one.toLowerCase()];
  return [...new Set([...(alias ? [alias] : []), `${title(base)}.png`, `${title(one)}.png`])];
}

interface ImageInfoResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    pages?: Record<string, { title?: string; imageinfo?: { url?: string; thumburl?: string }[] }>;
  };
}

/**
 * Each reward's art: the wiki's own image when it has one, else ours.
 *
 * One API call for every candidate of every reward, cached for a day: the
 * names in the feed change a few times a month and the art behind a name
 * almost never. The images load from the wiki's CDN in the reader's browser,
 * as the Starr Drops page's do; a failed lookup costs the art, never the page.
 */
async function withArt(items: Omit<FreeReward, 'art' | 'fallbackArt'>[]): Promise<FreeReward[]> {
  const wanted = [...new Set(items.flatMap((r) => wikiArtCandidates(r.name)))].slice(0, 50);
  const found = new Map<string, string>();
  if (wanted.length > 0) {
    const body = await fetchWikiJson<ImageInfoResponse>(
      `${WIKI_API}?action=query&titles=${encodeURIComponent(wanted.map((f) => `File:${f}`).join('|'))}` +
        '&prop=imageinfo&iiprop=url&iiurlwidth=320&format=json',
      86_400,
    );
    const asked = new Map((body?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(body?.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const src = info?.thumburl ?? info?.url;
      if (!page.title || !src) continue;
      found.set((asked.get(page.title) ?? page.title).replace(/^File:/, ''), src);
    }
  }
  return items.map((r) => ({
    ...r,
    art: wikiArtCandidates(r.name).map((f) => found.get(f)).find(Boolean) ?? rewardArt(r.name),
    fallbackArt: rewardArt(r.name),
  }));
}

export async function getFreeRewards(): Promise<{ live: FreeReward[]; earlier: FreeReward[] }> {
  let items: Omit<FreeReward, 'art' | 'fallbackArt'>[] = [];
  try {
    const res = await fetch(`${SITE_URL}/social/rewards/latest.json`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const feed = (await res.json()) as { items?: Omit<FreeReward, 'art' | 'fallbackArt'>[] };
      items = (feed.items ?? []).filter((r) => r && typeof r.name === 'string' && OFFICIAL.test(r.url));
    }
  } catch {
    // An empty page that says "nothing right now" beats an error page.
  }
  const withArtwork = await withArt(items);
  const cutoff = Date.now() - LIVE_DAYS * 86_400_000;
  const newest = [...withArtwork].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  return {
    live: newest.filter((r) => Date.parse(r.postedAt) >= cutoff),
    earlier: newest.filter((r) => Date.parse(r.postedAt) < cutoff),
  };
}
