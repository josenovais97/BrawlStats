import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildFacts, parseRanked, roast, roastScore, ROAST_LINES, type RoastFacts } from '@/lib/roast';
import { CLOSERS, JOKES, TITLES, jokeLines, type Line } from '@/lib/roast-jokes';
import type { BSBattleLogEntry, BSPlayer, BSPlayerBrawler } from '@/types/brawlstars';

const LANGS = ['en', 'es', 'pt'] as const;

function brawler(id: number, name: string, over: Partial<BSPlayerBrawler> = {}): BSPlayerBrawler {
  return {
    id,
    name,
    power: 11,
    rank: 1,
    trophies: 500,
    highestTrophies: 500,
    maxWinStreak: 4,
    gadgets: [],
    starPowers: [{ id: 1, name: 'x' }],
    gears: [],
    ...over,
  };
}

function player(over: Partial<BSPlayer> = {}): BSPlayer {
  return {
    tag: '#ABC123',
    name: 'xXProGamerXx',
    nameColor: null,
    icon: { id: 28000000 },
    trophies: 23_456,
    highestTrophies: 23_456,
    expLevel: 210,
    expPoints: 0,
    isQualifiedFromChampionshipChallenge: false,
    '3vs3Victories': 900,
    soloVictories: 1600,
    duoVictories: 300,
    bestRoboRumbleTime: 0,
    bestTimeAsBigBrawler: 0,
    rankedRankName: 'SILVER II',
    highestAllTimeRankedRankName: 'GOLD I',
    club: {},
    brawlers: [
      brawler(16000000, 'SHELLY', { trophies: 1500 }),
      brawler(16000001, 'COLT', { power: 1, starPowers: [] }),
      brawler(16000002, 'BULL', { starPowers: [] }),
    ],
    ...over,
  };
}

function battle(result: 'victory' | 'defeat', name = 'SHELLY', type = 'soloRanked'): BSBattleLogEntry {
  return {
    battleTime: '20261026T120000.000Z',
    event: { id: 1, mode: 'gemGrab', map: 'Hard Rock Mine' },
    battle: {
      mode: 'gemGrab',
      type,
      result,
      teams: [
        [{ tag: '#ABC123', name: 'me', brawler: { id: 16000000, name, power: 11, trophies: 1500 } }],
        [{ tag: '#OTHER', name: 'them', brawler: { id: 16000001, name: 'COLT', power: 11, trophies: 1500 } }],
      ],
    },
  };
}

// Newest first: four losses, then a run of wins and losses.
const LOG = [
  ...Array.from({ length: 4 }, () => battle('defeat')),
  ...Array.from({ length: 12 }, (_, i) => battle(i % 3 === 0 ? 'victory' : 'defeat')),
];

const ctx = { rosterSize: 108, tierOf: (id: number) => (id === 16000000 ? ('D' as const) : null) };

test('parses Ranked names into comparable ranks', () => {
  assert.deepEqual(parseRanked('LEGENDARY II'), { tier: 'LEGENDARY', index: 5, raw: 'LEGENDARY II' });
  assert.equal(parseRanked('PRO')?.index, 7);
  assert.equal(parseRanked(''), null);
  assert.equal(parseRanked('WOOD'), null);
});

test('facts read the log: wins, the current losing streak, the main', () => {
  const f = buildFacts(player(), LOG, ctx);
  assert.equal(f.log?.decided, 16);
  assert.equal(f.log?.wins, 4);
  assert.equal(f.log?.lossStreak, 4);
  assert.equal(f.main?.name, 'SHELLY');
  assert.equal(f.main?.tier, 'D');
  assert.equal(f.hasClub, false, 'an empty club object is no club');
  assert.equal(f.untouched, 1);
  assert.equal(f.maxedNoStarPower, 1);
  assert.equal(f.braggingName, true);
});

test('same tag and day gives the same roast; it is five distinct lines', () => {
  const f = buildFacts(player(), LOG, ctx);
  const a = roast(f, 'en', '#ABC123|2026-10-26');
  const b = roast(f, 'en', '#ABC123|2026-10-26');
  assert.deepEqual(a, b);
  assert.equal(a.lines.length, ROAST_LINES);
  assert.equal(new Set(a.lines).size, a.lines.length);
});

test('a filled roast leaves no placeholder behind, in any language', () => {
  const f = buildFacts(player(), LOG, ctx);
  for (const lang of LANGS) {
    for (let day = 1; day <= 30; day++) {
      const r = roast(f, lang, `#ABC123|2026-10-${day}`);
      for (const line of [...r.lines, r.closer, r.title]) {
        assert.doesNotMatch(line, /\{\w+\}/, `${lang}: ${line}`);
      }
    }
  }
});

test('an account with no log and no Ranked still gets a full roast', () => {
  const quiet = buildFacts(
    player({ rankedRankName: undefined, highestAllTimeRankedRankName: undefined, name: 'Ana' }),
    null,
    { rosterSize: 108 },
  );
  const r = roast(quiet, 'pt', 'x');
  assert.ok(r.lines.length >= 3, r.lines.join('\n'));
  assert.ok(r.lines.some((l) => l.includes('Ranqueado')), 'mentions having no Ranked rank');
});

test('the score stays inside 0-10 and rewards rank and win rate', () => {
  const weak = buildFacts(player(), LOG, ctx);
  const strong = buildFacts(
    player({ highestAllTimeRankedRankName: 'MASTERS I', rankedRankName: 'MASTERS I', trophies: 150_000 }),
    Array.from({ length: 16 }, () => battle('victory')),
    ctx,
  );
  const s1 = roastScore(weak);
  const s2 = roastScore(strong);
  assert.ok(s1 > 0 && s1 < 10);
  assert.ok(s2 > s1 + 3, `${s1} vs ${s2}`);
});

test('every joke, title and closer is written in all three languages with the same placeholders', () => {
  const allLines: Line[] = [
    ...JOKES.flatMap((j) => j.lines),
    ...CLOSERS.flatMap((c) => c.lines),
    ...TITLES.map((t) => t.title),
  ];
  // The main jokes are looked up per brawler, so reach them through a main.
  for (const name of ['SHELLY', 'EDGAR', 'EL PRIMO', '8-BIT']) {
    const f = { main: { name, className: null } } as unknown as RoastFacts;
    allLines.push(...jokeLines(JOKES.find((j) => j.id === 'main-specific')!, f));
  }
  for (const line of allLines) {
    const keys = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const lang of LANGS) assert.ok(line[lang]?.trim(), `missing ${lang}: ${line.en}`);
    assert.equal(keys(line.es), keys(line.en), line.en);
    assert.equal(keys(line.pt), keys(line.en), line.en);
  }
});

test('bragging names are spotted inside gamer tags, not inside ordinary words', () => {
  const brags = (name: string) => buildFacts(player({ name }), null, ctx).braggingName;
  for (const name of ['xXProGamerXx', 'KingSlayer', 'BOSS_77', 'the god', 'Legend10', 'PRO']) {
    assert.equal(brags(name), true, name);
  }
  for (const name of ['Viking', 'Problem', 'PROBLEM', 'GODZILLA', 'Godinho', 'Ana']) {
    assert.equal(brags(name), false, name);
  }
});
