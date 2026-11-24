import type { NextRequest } from 'next/server';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getBattleLog } from '@/lib/bs-api';
import { isOptedOut } from '@/lib/opted-out';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { normalizeTag } from '@/lib/tags';

/**
 * People you queue with (Bubble 1.43, 2026-11-23).
 *
 * GET ?tag=<tag>&skip=<tag,tag> → the players who were on your team in at
 * least two different matches in your last 25 battles, most games first, each
 * with the brawler they played most with you. Squad's empty state offers them
 * as one-tap friends, which fills the list without an invite.
 *
 * Matches, not games: a Ranked match is a best of three and the log lists each
 * game, so a stranger from one match appears two or three times. Counting
 * games (2026-11-23) offered mostly strangers. Games with the same map and the
 * same six players are one match.
 *
 * Names and tags only, as the battle log already shows them to anyone; opted-out
 * players are never returned. `skip` drops tags already in the friends list.
 */
export const dynamic = 'force-dynamic';

const MAX = 5;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const tag = normalizeTag(q.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  const skip = new Set((q.get('skip') ?? '').split(',').map((t) => normalizeTag(t)).filter(Boolean));
  const [log, art] = await Promise.all([
    getBattleLog(tag)
      .then((r) => r.items ?? [])
      .catch(() => null),
    getBrawlerArtMap().catch(() => new Map()),
  ]);
  if (!log) return okResponse({ players: [], unavailable: true }, 60);

  const seen = new Map<string, { name: string; games: number; wins: number; matches: Set<string>; brawlers: Map<number, number> }>();
  for (const entry of log) {
    const teams = entry.battle.teams;
    if (!teams || teams.length < 2) continue;
    const mine = teams.find((team) => team.some((p) => normalizeTag(p.tag) === tag));
    if (!mine) continue;
    const match = `${entry.event?.map ?? ''}|${teams.flat().map((p) => p.tag).sort().join(',')}`;
    // Duo Showdown has a placement instead of a result: top two counts as a win.
    const rank = (entry.battle as { rank?: number }).rank;
    const won = entry.battle.result === 'victory' || (typeof rank === 'number' && rank <= 2);
    for (const p of mine) {
      const other = normalizeTag(p.tag);
      if (!other || other === tag || skip.has(other) || isOptedOut(other)) continue;
      const row = seen.get(other) ?? { name: p.name ?? `#${other}`, games: 0, wins: 0, matches: new Set<string>(), brawlers: new Map<number, number>() };
      row.games += 1;
      row.matches.add(match);
      if (won) row.wins += 1;
      const id = p.brawler?.id;
      if (id) row.brawlers.set(id, (row.brawlers.get(id) ?? 0) + 1);
      seen.set(other, row);
    }
  }

  const players = [...seen.entries()]
    .filter(([, r]) => r.matches.size >= 2)
    .sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins)
    .slice(0, MAX)
    .map(([other, r]) => {
      const top = [...r.brawlers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const icon = top ? (art.get(top)?.imageUrl ?? brawlerIconUrl(top)) : null;
      return { tag: other, name: r.name, games: r.games, wins: r.wins, icon: icon ? absolute(icon) : null };
    });
  return okResponse({ players }, 300);
}

function absolute(url: string): string {
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
