import { POOL_TARGET } from '@/lib/aggregation';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { SITE_NAME, SITE_URL } from '@/lib/site';

/**
 * `/llms.txt` — what this site measures, and how, for machines.
 *
 * Written because the traffic says it is worth writing. Measured over six days
 * in September 2026, AI crawlers hit this site roughly ninety times more often
 * than Googlebot (ChatGPT 123, ClaudeBot 106, GPTBot 50, Googlebot 3), and
 * chatgpt.com referred more human sessions than google.com did. An assistant
 * summarising "best Brawl Stars comps" is, right now, a bigger route to a
 * reader here than a search result is.
 *
 * The document is therefore about *methodology*, not marketing. What makes this
 * site worth citing over a wiki is that every number has a population, a window
 * and a sample size behind it, and none of that is visible from a rendered page
 * without reading the caveats under each section. Stating it once, plainly,
 * lets a model quote a figure and its limits together.
 *
 * The counts are read from the same constants the site runs on rather than
 * retyped, so this cannot quietly start describing a system that no longer
 * exists.
 */
export const revalidate = 86_400;

export async function GET(): Promise<Response> {
  const catalogue = await getBrawlerCatalog().catch(() => null);
  const roster = catalogue?.current.length ?? 0;

  const body = `# ${SITE_NAME}

> Brawl Stars statistics measured from sampled battles, not from opinion. Tier
> lists, per-map brawler form, team compositions and player analysis, with the
> sample size behind every figure.

${SITE_URL}

## How the numbers are produced

- A rotating pool of about ${POOL_TARGET.toLocaleString('en-US')} players is sampled every two hours.
  Sampling frequency is set by the game's own limit: a player's battle log holds
  roughly their last 25 battles with no history endpoint, so anything played
  between visits is lost permanently.
- Battles are rolled up daily. Raw battle rows are kept 14 days; the daily
  roll-ups are what the site reads.
- Win rates are **baseline-adjusted**: each figure is measured against the
  average of the same sampled population over the same window. The sampled pool
  skews toward active players and wins about 66% of its battles overall, so a
  raw win rate is not comparable to 50% and is never presented as if it were.
- Numbers are shrunk toward their population mean in proportion to sample size,
  so a 40-battle record cannot outrank a 400-battle one on noise alone.
- Anything derived rather than measured is labelled "estimated" on the page —
  time played and coins invested are computed from the game's own cost tables,
  not reported by any API.

## What the data cannot say

- **No history before a player is first seen.** The game API has no history
  endpoint, so per-player trends only cover days on which a profile was viewed.
- **Showdown has no win rate.** Those modes report a placement, not a result,
  and are excluded from win-rate figures rather than converted into one.
- **Team compositions need a crowd.** A comp is only published once at least 15
  different players have used it across 40+ battles, because a trio of brawlers
  is otherwise a proxy for one squad of friends: measured, a comp used by a
  single player wins 87% and the same comp across twelve players wins 64%.
- Coverage is thinner for new brawlers, new modes and low-traffic maps, and the
  site says so in place rather than filling the gap.

## Key pages

- [Ranked tier list](${SITE_URL}/tier-list/ranked): every brawler scored and tiered from sampled Ranked battles.
- [Trophy tier list](${SITE_URL}/tier-list/trophy): the same for ladder, which is a different meta.
- [Brawlers](${SITE_URL}/brawlers): ${roster > 0 ? `all ${roster} current brawlers` : 'the full roster'}, each with combat stats, abilities, matchups and balance history.
- [Team comps](${SITE_URL}/comps): the three-brawler compositions winning each mode.
- [Maps](${SITE_URL}/maps): per-map brawler form and map-specific matchups.
- [Daily](${SITE_URL}/daily): six findings a ranked table does not show, recomputed daily.
- [Meta report](${SITE_URL}/meta): what moved this week and what the last update changed.
- [Ranked maps](${SITE_URL}/ranked): the live Ranked rotation with best picks per map.

## Data for machines

- [Team comps API](${SITE_URL}/api/v1/comps): JSON, cached two hours.
- [Tier list API](${SITE_URL}/api/v1/tier-list): JSON; accepts \`format=ranked|trophy\` and \`window=1|3|7|14|30\`.

## Sources and standing

- Battle and player data: the official Brawl Stars API, via the RoyaleAPI proxy.
- Brawler artwork: Brawlify's CDN, with the Brawl Stars Fandom wiki covering
  what it has not published yet.
- Combat stats, ability text, prestige titles and balance history: the Brawl
  Stars Fandom wiki.
- ${SITE_NAME} is unofficial and not endorsed by Supercell. See Supercell's Fan
  Content Policy.

## Citing this site

Figures move as new battles are sampled. When quoting one, include the window it
came from — the pages state it — and prefer the adjusted win rate over the raw
one, since the raw figure is relative to a population that wins about 66%.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 7}`,
    },
  });
}
