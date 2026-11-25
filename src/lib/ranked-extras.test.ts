import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BRAWLER_ID_BASE, STATS_HEAD, STATS_PER_PLAYER, rankedExtras } from '@/lib/ranked-extras';
import type { BSBattleLogEntry } from '@/types/brawlstars';

const player = (tag: string, brawler: number, ban: number | null, stats: [number, number, number, number] | null) => ({
  tag, name: tag, brawler: { id: BRAWLER_ID_BASE + brawler, name: '', power: 11, trophies: 14 },
  ...(ban !== null ? { bannedBrawler: { id: BRAWLER_ID_BASE + ban, name: '' } } : {}),
  ...(stats ? { stats: { kills: stats[0], deaths: stats[1], damageDealt: stats[2], healing: stats[3], damageTaken: 9 } } : {}),
});
const battle = (over: Partial<BSBattleLogEntry['battle']> = {}): BSBattleLogEntry => ({
  battleTime: '20261125T083950.000Z',
  event: { id: 1, mode: 'heist', map: 'Hot Potato' },
  battle: {
    mode: 'heist', type: 'soloRanked', result: 'victory', duration: 120,
    starPlayer: player('#20R', 5, 12, [4, 0, 30_000, 500]),
    teams: [
      [player('#20J', 1, 10, [1, 2, 10_000, 100]), player('#20Y', 2, 11, [2, 2, 20_000, 200]), player('#20R', 5, 12, [4, 0, 30_000, 500])],
      [player('#20P', 3, 10, [0, 3, 5_000, 0]), player('#20Q', 4, null, [1, 1, 8_000, 0]), player('#20U', 6, 13, [1, 3, 9_000, 10])],
    ],
    ...over,
  },
});

test('bans and stats, with the sampled player\'s team first', () => {
  const a = rankedExtras(battle(), '20P');
  assert.deepEqual(a.banIds, [10, 13, 10, 11, 12], 'a player who banned nobody is left out, a double ban stays');
  assert.equal(a.lineupStats.length, STATS_HEAD + 6 * STATS_PER_PLAYER);
  assert.deepEqual(a.lineupStats.slice(0, 7), [120, 5, 3, 0, 3, 5_000, 0], 'seconds, the star player\'s place, then the first player');
  assert.deepEqual(rankedExtras(battle(), '20J').lineupStats.slice(0, 2), [120, 2]);
});

test('anything missing keeps what can be trusted', () => {
  assert.deepEqual(rankedExtras(battle({ duration: undefined }), '20J').lineupStats, []);
  assert.deepEqual(rankedExtras(battle({ duration: undefined }), '20J').banIds, [10, 11, 12, 10, 13]);
  assert.equal(rankedExtras(battle({ starPlayer: null }), '20J').lineupStats[1], -1);
  const noStats = battle();
  noStats.battle.teams![1][0] = player('#20P', 3, 10, null);
  assert.deepEqual(rankedExtras(noStats, '20J').lineupStats, []);
  assert.deepEqual(rankedExtras(battle(), '9999'), { banIds: [], lineupStats: [] }, 'not their battle');
  assert.deepEqual(rankedExtras(battle({ teams: undefined }), '20J'), { banIds: [], lineupStats: [] });
});
