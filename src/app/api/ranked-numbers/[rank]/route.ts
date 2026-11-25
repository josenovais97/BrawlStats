import { isRankKey } from '@/lib/ranked-numbers';
import { getRankNumbers } from '@/lib/ranked-numbers-data';

/**
 * One rank's bans and stats for /ranked/stats (2026-11-25): the page sends the
 * first and asks for another when it is chosen. Cached like the page, five
 * addresses in all.
 */
export const revalidate = 7200;

/* Runtime ISR -- see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ rank: string }> }) {
  const { rank } = await params;
  if (!isRankKey(rank)) return Response.json(null, { status: 404 });
  return Response.json(await getRankNumbers(rank), {
    headers: { 'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
