import type { NextRequest } from 'next/server';

import { rankedTierIconUrl } from '@/lib/brawlapi';
import { getBattleLog, getPlayer } from '@/lib/bs-api';
import { appNames } from '@/lib/bubble-app-l10n';
import { rankedGames, reviewGame } from '@/lib/bubble-review';
import { combatFromLog } from '@/lib/combat';
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

  // One game of the match history (2026-11-13): reviewed whenever it was played.
  const pickedRaw = q.get('game') ?? '';
  if (BATTLE_TIME.test(pickedRaw)) {
    const picked = ranked.find((e) => e.battleTime === pickedRaw);
    if (!picked) return okResponse({ game: null }, 60);
    const owner = await getPlayer(tag).catch(() => null);
    const one = await reviewGame(picked, tag, owner?.brawlers ?? [], { ownPickOnly: true });
    return okResponse({ game: one ? toGame(picked, tag, one, null, null) : null }, 300);
  }
  const latest = ranked[0]?.battleTime ?? null;
  const me = `#${tag}`;
  const games = ranked.map((e) => {
    const mine = (e.battle.teams ?? []).flat().find((p) => normalizeTag(p.tag) === tag);
    return {
      t: e.battleTime,
      win: e.battle.result === 'victory',
      star: e.battle.starPlayer?.tag?.toUpperCase() === me,
      brawler: mine?.brawler?.name ? name(mine.brawler.name) : null,
      // Same key as /api/bubble/me: the app keeps whichever answer saw a game
      // first, and without it games seen by the bubble had no mode (2026-11-24).
      mode: e.event?.mode ?? e.battle.mode ?? null,
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

  const elo = player?.rankedElo ?? null;
  const moved = elo !== null && Number.isFinite(prevElo) && prevElo > 0 ? elo - prevElo : null;
  const eloChange = fresh.length === 1 && moved !== null && moved !== 0 && Math.abs(moved) < 400 ? moved : null;
  return okResponse({ latest, newGames: fresh.length, elo, games, game: toGame(entry, tag, read, elo, eloChange) }, 30);
}

/** The review the panel draws, for one Ranked game of the log. */
function toGame(
  entry: Parameters<typeof reviewGame>[0],
  tag: string,
  read: NonNullable<Awaited<ReturnType<typeof reviewGame>>>,
  elo: number | null,
  eloChange: number | null,
) {
  const { review } = read;
  const progress = rankProgress(elo);
  const rankIndex = progress ? RANK_ELO_FLOORS.findIndex(([n]) => n === progress.rank.toUpperCase()) : -1;
  const starTag = normalizeTag(entry.battle.starPlayer?.tag ?? null);

  const won = entry.battle.result === 'victory';
  /*
   * Read from the same chance the card's bar shows (2026-11-23). It used the
   * map-only edge before, which could say "your draft was stronger" under a
   * bar reading 47%. 45-55% is even, as in the panel drawer's last game line.
   */
  const chance = review?.winChance ?? null;
  const verdict =
    chance === null
      ? 'unknown'
      : won
        ? chance >= 0.55
          ? 'draftWon'
          : chance <= 0.45
            ? 'upset'
            : 'even'
        : chance <= 0.45
          ? 'draftLost'
          : chance >= 0.55
            ? 'playLost'
            : 'even';

  // The scoreboard (2026-11-25): the battle log carries it since November.
  const board = (who: string) => {
    const c = combatFromLog(entry, who);
    return c ? { k: c.kills, d: c.deaths, dmg: c.damage, heal: c.healing } : null;
  };
  const players = (entry.battle.teams ?? []).flat();
  const banned = (side: { tag: string }[]) => [
    ...new Set(
      side
        .map((p) => players.find((x) => normalizeTag(x.tag) === p.tag)?.bannedBrawler?.id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];

  return {
    battleTime: entry.battleTime,
    mapName: entry.event?.map ?? null,
    mode: entry.event?.mode ?? entry.battle.mode ?? null,
    result: won ? 'victory' : 'defeat',
    eloChange,
    rank: progress?.rank ?? null,
    rankIcon: rankIndex >= 0 ? absolute(rankedTierIconUrl(rankIndex + 1)) : null,
    mine: read.mine.map((p) => ({ id: p.id, you: p.tag === tag, star: p.tag === starTag, s: board(p.tag) })),
    theirs: read.theirs.map((p) => ({ id: p.id, star: p.tag === starTag, s: board(p.tag) })),
    // Who each side banned, once each (2026-11-25).
    bans: { mine: banned(read.mine), theirs: banned(read.theirs) },
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
  };
}

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
