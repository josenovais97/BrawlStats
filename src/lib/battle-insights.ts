import { parseApiDate } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';
import type { BSBattleLogEntry, BSBattlePlayer } from '@/types/brawlstars';

/**
 * Derived stats from a player's recent battle log.
 *
 * The API returns roughly the last 25 battles and nothing older, so everything
 * here describes a short recent window rather than career history. That is
 * still the most interesting slice: who you actually play with, what you have
 * been picking, and how it has been going lately.
 */

export interface BrawlerUsage {
  brawlerId: number;
  brawlerName: string;
  battles: number;
  wins: number;
  decided: number;
  winRate: number | null;
  trophyChange: number;
}

export interface PlayerAssociation {
  tag: string;
  name: string;
  battles: number;
  wins: number;
  decided: number;
  winRate: number | null;
}

export interface ModeUsage {
  mode: string;
  battles: number;
  wins: number;
  decided: number;
  winRate: number | null;
}

export interface BattleInsights {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  /** Battles that reported a win or loss; showdown placements are excluded. */
  decided: number;
  winRate: number | null;
  /** Net trophies across the whole log. */
  trophyChange: number;
  starPlayerCount: number;
  /** Showdown-style placements, averaged. */
  averageRank: number | null;

  brawlers: BrawlerUsage[];
  modes: ModeUsage[];
  teammates: PlayerAssociation[];
  opponents: PlayerAssociation[];

  lastBattleAt: string | null;
  battlesLast24h: number;
  /** Distinct days covered by the log, for a battles-per-day figure. */
  daysCovered: number;
}

/** Every participant, whatever shape the mode reports. */
function participants(entry: BSBattleLogEntry): BSBattlePlayer[] {
  const { teams, players } = entry.battle;
  if (teams) return teams.flat();
  if (players) return players;
  return [];
}

/** The team containing this player, when the mode has teams. */
function ownTeam(entry: BSBattleLogEntry, tag: string): BSBattlePlayer[] | null {
  const { teams } = entry.battle;
  if (!teams) return null;
  return teams.find((team) => team.some((p) => normalizeTag(p.tag) === tag)) ?? null;
}

function rate(wins: number, decided: number): number | null {
  return decided > 0 ? wins / decided : null;
}

export function computeBattleInsights(
  entries: BSBattleLogEntry[],
  playerTag: string,
): BattleInsights {
  const tag = normalizeTag(playerTag);

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let trophyChange = 0;
  let starPlayerCount = 0;
  let rankSum = 0;
  let rankCount = 0;
  let battlesLast24h = 0;
  let lastBattleAt: string | null = null;

  const dayKeys = new Set<string>();
  const brawlers = new Map<number, BrawlerUsage>();
  const modes = new Map<string, ModeUsage>();
  const teammates = new Map<string, PlayerAssociation>();
  const opponents = new Map<string, PlayerAssociation>();

  const dayAgo = Date.now() - 86_400_000;

  for (const entry of entries) {
    const self = participants(entry).find((p) => normalizeTag(p.tag) === tag);
    const brawler = self?.brawler ?? self?.brawlers?.[0];

    const result = entry.battle.result;
    const isWin = result === 'victory';
    const isLoss = result === 'defeat';
    const isDraw = result === 'draw';
    const decided = isWin || isLoss ? 1 : 0;

    if (isWin) wins += 1;
    if (isLoss) losses += 1;
    if (isDraw) draws += 1;

    const delta = entry.battle.trophyChange ?? self?.brawler?.trophyChange ?? 0;
    trophyChange += delta;

    if (typeof entry.battle.rank === 'number') {
      rankSum += entry.battle.rank;
      rankCount += 1;
    }

    if (entry.battle.starPlayer?.tag && normalizeTag(entry.battle.starPlayer.tag) === tag) {
      starPlayerCount += 1;
    }

    const when = parseApiDate(entry.battleTime);
    if (when) {
      if (!lastBattleAt || when.toISOString() > lastBattleAt) {
        lastBattleAt = when.toISOString();
      }
      if (when.getTime() >= dayAgo) battlesLast24h += 1;
      dayKeys.add(when.toISOString().slice(0, 10));
    }

    // Brawler usage
    if (brawler) {
      const current = brawlers.get(brawler.id) ?? {
        brawlerId: brawler.id,
        brawlerName: brawler.name,
        battles: 0,
        wins: 0,
        decided: 0,
        winRate: null,
        trophyChange: 0,
      };
      current.battles += 1;
      current.wins += isWin ? 1 : 0;
      current.decided += decided;
      current.trophyChange += delta;
      brawlers.set(brawler.id, current);
    }

    // Mode usage
    const modeName = entry.battle.mode ?? entry.event.mode ?? 'unknown';
    const modeEntry = modes.get(modeName) ?? {
      mode: modeName,
      battles: 0,
      wins: 0,
      decided: 0,
      winRate: null,
    };
    modeEntry.battles += 1;
    modeEntry.wins += isWin ? 1 : 0;
    modeEntry.decided += decided;
    modes.set(modeName, modeEntry);

    // Teammates and opponents. Only team modes have a meaningful "teammate";
    // in showdown everyone else is an opponent.
    const team = ownTeam(entry, tag);
    for (const participant of participants(entry)) {
      const otherTag = normalizeTag(participant.tag);
      if (otherTag === tag) continue;

      const isTeammate = team
        ? team.some((p) => normalizeTag(p.tag) === otherTag)
        : false;
      const bucket = isTeammate ? teammates : opponents;

      const current = bucket.get(otherTag) ?? {
        tag: otherTag,
        name: participant.name,
        battles: 0,
        wins: 0,
        decided: 0,
        winRate: null,
      };
      current.battles += 1;
      current.wins += isWin ? 1 : 0;
      current.decided += decided;
      bucket.set(otherTag, current);
    }
  }

  const finish = <T extends { wins: number; decided: number; winRate: number | null }>(
    items: T[],
  ): T[] => items.map((item) => ({ ...item, winRate: rate(item.wins, item.decided) }));

  const decidedTotal = wins + losses;

  return {
    battles: entries.length,
    wins,
    losses,
    draws,
    decided: decidedTotal,
    winRate: rate(wins, decidedTotal),
    trophyChange,
    starPlayerCount,
    averageRank: rankCount > 0 ? rankSum / rankCount : null,

    brawlers: finish([...brawlers.values()]).sort(
      (a, b) => b.battles - a.battles || b.trophyChange - a.trophyChange,
    ),
    modes: finish([...modes.values()]).sort((a, b) => b.battles - a.battles),
    // A single shared match is noise; two or more is a pattern worth showing.
    teammates: finish([...teammates.values()])
      .filter((t) => t.battles > 1)
      .sort((a, b) => b.battles - a.battles),
    opponents: finish([...opponents.values()])
      .filter((t) => t.battles > 1)
      .sort((a, b) => b.battles - a.battles),

    lastBattleAt,
    battlesLast24h,
    daysCovered: Math.max(dayKeys.size, 1),
  };
}
