import { MIN_BAN_BATTLES, MIN_MAP_BAN_BATTLES, isRankKey, type BanList, type RankKey } from '@/lib/ranked-numbers';
import { getRankNumbers } from '@/lib/ranked-numbers-data';

/**
 * Who gets banned, for the Bubble panel (2026-11-25): this week's share of
 * Ranked games each brawler is banned in, over everything and map by map. A
 * map with too few games at the rank answers with Mythic and up, then with
 * every rank, and says so (`wide`). Five addresses: every rank and the four
 * brackets.
 */
export const revalidate = 7200;

/* Runtime ISR -- see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

const ABOVE: readonly RankKey[] = ['mythic', 'legendary', 'masters'];

export async function GET(_request: Request, { params }: { params: Promise<{ rank: string }> }) {
  const { rank } = await params;
  if (rank !== 'all' && (!isRankKey(rank) || rank === 'mythic-plus')) return Response.json(null, { status: 404 });
  const key = rank as RankKey;
  const chain: RankKey[] = key === 'all' ? ['all'] : ABOVE.includes(key) ? [key, 'mythic-plus', 'all'] : [key, 'all'];
  const sets = await Promise.all(chain.map((k) => getRankNumbers(k).catch(() => null)));

  const overall = sets.find((s) => s && s.battles >= MIN_BAN_BATTLES) ?? null;
  const maps: Record<string, { wide: boolean; bans: BanList }> = {};
  sets.forEach((set, i) => {
    for (const m of set?.maps ?? []) {
      if (maps[m.map] || m.battles < MIN_MAP_BAN_BATTLES) continue;
      maps[m.map] = { wide: i > 0, bans: m.bans };
    }
  });

  return Response.json(
    { battles: overall?.battles ?? 0, wide: overall !== null && overall !== sets[0], all: (overall?.bans ?? []).filter(([, r]) => r >= 0.005), maps },
    { headers: { 'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
