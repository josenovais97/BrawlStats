import type { NextRequest } from 'next/server';

import { rankedTierIconUrl } from '@/lib/brawlapi';
import { getBattleLog, getPlayer } from '@/lib/bs-api';
import { appNames } from '@/lib/bubble-app-l10n';
import { rankedGames, reviewGame } from '@/lib/bubble-review';
import { RANK_ELO_FLOORS, rankProgress } from '@/lib/ranked-elo';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { normalizeTag } from '@/lib/tags';

/**
 * The post-game review (Bubble 1.40, 2026-11-09).
 *
 * While the bubble is on screen the app asks every two minutes with the
 * newest Ranked game it has seen (`since`) and the elo it had then (`elo`).
 * Nothing new costs one battle-log call and returns `game: null`. A new game
 * also reads the profile (elo now, and the roster for a better pick) and
 * comes back as everything the panel's review screen draws:
 *
 *   the result and the elo it moved (only for exactly one new game, and
 *   only when the numbers moved: the battle log and the profile do not
 *   always update in the same minute), both teams with the star player,
 *   the draft's chance, what countered the team, and the swap from the
 *   player's own power-11 brawlers that would have helped most.
 *
 * Without `since` it only answers what the newest game is, so the app has
 * a starting point and never pulses for a game played before it looked.
 * `games` is the battle log's Ranked games in /api/bubble/me's shape, so the
 * app's daily goal moves the minute a game ends.
 */

export const dynamic = 'force-dynamic';

const BATTLE_TIME = /^\d{8}T\d{6}\.\d{3}Z$/;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const tag = normalizeTag(q.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  const sinceRaw = q.get('since') ?? '';
  const since = BATTLE_TIME.test(sinceRaw) ? sinceRaw : null;
  const prevElo = Number(q.get('elo'));

  const [log, name] = await Promise.all([
    getBattleLog(tag)
      .then((r) => r.items)
      .catch(() => null),
    appNames(q.get('lang')),
  ]);
  if (!log) return okResponse({ latest: null, newGames: 0, game: null, games: [] }, 30);

  const ranked = rankedGames(log);
  const latest = ranked[0]?.battleTime ?? null;
  const me = `#${tag}`;
  const games = ranked.map((e) => {
    const mine = (e.battle.teams ?? []).flat().find((p) => normalizeTag(p.tag) === tag);
    return {
      t: e.battleTime,
      win: e.battle.result === 'victory',
      star: e.battle.starPlayer?.tag?.toUpperCase() === me,
      brawler: mine?.brawler?.name ? name(mine.brawler.name) : null,
    };
  });
  // Battle times sort as strings: fixed width, most significant first.
  const fresh = since ? ranked.filter((e) => e.battleTime > since) : [];

  if (!since || fresh.length === 0) {
    // A starting point needs the elo the next game will be measured from.
    const elo = since ? null : await getPlayer(tag).then((p) => p.rankedElo ?? null).catch(() => null);
    return okResponse({ latest, newGames: 0, elo, game: null, games }, 30);
  }

  const entry = fresh[0];
  const player = await getPlayer(tag).catch(() => null);
  const read = await reviewGame(entry, tag, player?.brawlers ?? [], { ownPickOnly: true });
  if (!read) return okResponse({ latest, newGames: fresh.length, elo: player?.rankedElo ?? null, game: null, games }, 30);
  const { review } = read;

  const elo = player?.rankedElo ?? null;
  const moved = elo !== null && Number.isFinite(prevElo) && prevElo > 0 ? elo - prevElo : null;
  const eloChange = fresh.length === 1 && moved !== null && moved !== 0 && Math.abs(moved) < 400 ? moved : null;
  const progress = rankProgress(elo);
  const rankIndex = progress ? RANK_ELO_FLOORS.findIndex(([n]) => n === progress.rank.toUpperCase()) : -1;
  const starTag = normalizeTag(entry.battle.starPlayer?.tag ?? null);

  const advantage = review?.advantage ?? null;
  const won = entry.battle.result === 'victory';
  const verdict =
    review?.winChance == null || advantage === null
      ? 'unknown'
      : won
        ? advantage >= 4
          ? 'draftWon'
          : advantage <= -4
            ? 'upset'
            : 'even'
        : advantage <= -4
          ? 'draftLost'
          : advantage >= 4
            ? 'playLost'
            : 'even';

  return okResponse(
    {
      latest,
      newGames: fresh.length,
      elo,
      games,
      game: {
        battleTime: entry.battleTime,
        mapName: entry.event?.map ?? null,
        mode: entry.event?.mode ?? entry.battle.mode ?? null,
        result: won ? 'victory' : 'defeat',
        eloChange,
        rank: progress?.rank ?? null,
        rankIcon: rankIndex >= 0 ? absolute(rankedTierIconUrl(rankIndex + 1)) : null,
        mine: read.mine.map((p) => ({ id: p.id, you: p.tag === tag, star: p.tag === starTag })),
        theirs: read.theirs.map((p) => ({ id: p.id, star: p.tag === starTag })),
        winChance: review?.winChance ?? null,
        verdict,
        worst: review?.worstMatchup
          ? {
              brawlerId: review.worstMatchup.brawlerId,
              againstId: review.worstMatchup.againstId,
              edge: Math.round(review.worstMatchup.edge * 10) / 10,
              battles: review.worstMatchup.battles,
            }
          : null,
        keyEnemy: review?.keyEnemy ? { brawlerId: review.keyEnemy.brawlerId, edge: Math.round(review.keyEnemy.edge * 10) / 10 } : null,
        better: review?.betterPick
          ? { outId: review.betterPick.outId, inId: review.betterPick.inId, gain: Math.round(review.betterPick.gain * 10) / 10 }
          : null,
      },
    },
    30,
  );
}

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
