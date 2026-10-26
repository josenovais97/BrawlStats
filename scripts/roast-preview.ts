/**
 * Print the roast for a tag, in all three languages, from the terminal.
 *
 *   node --import tsx --conditions=react-server scripts/roast-preview.ts 2PP [day]
 *
 * Reads the player and battle log through the live site's public API, so it
 * needs no key, and the Ranked tier list for "your main is D tier". Classes
 * are not fetched here, so a main with no line of its own shows the generic
 * line rather than the class one the page would use. `day` (YYYY-MM-DD)
 * shows what another day's roll would say.
 */
import { buildFacts, roast } from '@/lib/roast';
import type { BSBattleLog, BSPlayer } from '@/types/brawlstars';
import type { Tier } from '@/types/stats';

const SITE = process.env.SITE ?? 'https://brawlzone.net';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SITE}${path}`, { headers: { 'User-Agent': 'brawlzone-roast-preview' } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const tag = (process.argv[2] ?? '').replace(/^#/, '').toUpperCase();
  const day = process.argv[3] ?? new Date().toISOString().slice(0, 10);
  if (!tag) {
    console.error('usage: roast-preview.ts <tag> [YYYY-MM-DD]');
    process.exit(2);
  }

  const player = await getJson<BSPlayer>(`/api/player/${tag}`);
  const log = await getJson<BSBattleLog>(`/api/player/${tag}/battlelog`).catch(() => null);
  const tiers = await getJson<{ brawlers: { brawlerId: number; tier: Tier }[] }>('/api/v1/tier-list').catch(
    () => ({ brawlers: [] }),
  );
  const tierById = new Map(tiers.brawlers.map((b) => [b.brawlerId, b.tier]));

  const facts = buildFacts(player, log?.items ?? null, {
    rosterSize: tiers.brawlers.length,
    tierOf: (id) => tierById.get(id) ?? null,
  });

  for (const lang of ['en', 'es', 'pt'] as const) {
    const r = roast(facts, lang, `${player.tag}|${day}`);
    console.log(`\n[${lang}]  ${player.name}  —  ${r.score.toFixed(1)}/10  ${r.title}`);
    for (const line of r.lines) console.log(`  • ${line}`);
    console.log(`  ${r.closer}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
