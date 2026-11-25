/**
 * One rank's Ranked tier list as JSON, S to C with the week's arrows, for the
 * Instagram Story (2026-11-25; deploy/bin/brawlzone-ig-story tiers).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/story-tiers.ts mythic
 *
 * Exits 3 when the rank has too few games for a list of its own.
 */
import { bracketBySlug } from '@/lib/rank-brackets';
import { getSeasonState } from '@/lib/ranked-seasons';
import { getBracketRoster } from '@/lib/stats';
import { computeWeekTrend } from '@/lib/week-trend';

async function main(): Promise<number> {
  const bracket = bracketBySlug(process.argv[2]);
  if (!bracket) throw new Error('usage: story-tiers.ts diamond|mythic|legendary|masters');
  const [roster, trend, season] = await Promise.all([
    getBracketRoster(bracket.id),
    computeWeekTrend(bracket.id).catch((): Record<number, 1 | -1> => ({})),
    getSeasonState().catch(() => null),
  ]);
  if (!roster) return 3;
  const rows = (['S', 'A', 'B', 'C'] as const).map((tier) => ({
    tier,
    items: roster.scored
      .filter((b) => b.tier === tier)
      .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
      .map((b) => ({ id: b.brawlerId, n: b.brawlerName, dir: trend[b.brawlerId] ?? 0 })),
  }));
  const out = JSON.stringify({ rank: bracket.slug, days: roster.days, season: season?.current?.number ?? season?.latest?.number ?? null, rows });
  await new Promise<void>((resolve, reject) => process.stdout.write(out + '\n', (e) => (e ? reject(e) : resolve())));
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
