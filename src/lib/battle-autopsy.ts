import 'server-only';

import type { MapForm } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import type { BSBattleLogEntry, BSBattlePlayer } from '@/types/brawlstars';

/**
 * Why the recent losses happened.
 *
 * The battle log already tells a player *that* they lost. What it cannot tell
 * them is whether there was a reason — and there usually is one of two: the
 * brawler was wrong for the map, or the same opponent keeps beating them.
 *
 * Both are answerable from data the site already holds, and neither is
 * answerable from the log alone, which is what makes this worth building rather
 * than another list of results. It is deliberately conservative: a loss with no
 * evidence behind it is left unexplained rather than assigned a story, because
 * "you were unlucky" is usually the true answer and a site that never says so
 * is a horoscope.
 */

/** A brawler this far below its map's average was the wrong tool for the job. */
const POOR_PICK = -0.03;

/** Fewer than this and a "recurring problem" is a coincidence. */
const MIN_OCCURRENCES = 2;

/**
 * How much more often a brawler must appear in losses than in wins to count.
 *
 * Without this the list fills with whoever is popular. The first version
 * reported "Otis was on the other side in 3 of your losses" — true, and
 * meaningless, because Otis is played constantly and turned up in the wins too.
 * Appearing in defeats is only evidence if it is *disproportionate*, so the
 * comparison is against the same brawler's appearances in this player's wins.
 */
const NEMESIS_SKEW = 2;

export interface AutopsyFinding {
  kind: 'map-pick' | 'nemesis';
  /** The player's brawler, for `map-pick`; the opponent's, for `nemesis`. */
  brawlerId: number;
  brawlerName: string;
  /** Losses in the log this finding accounts for. */
  losses: number;
  /** Only for `map-pick`: where, and how far below the map's average. */
  mapName?: string;
  mode?: string;
  edge?: number;
}

export interface Autopsy {
  losses: number;
  findings: AutopsyFinding[];
}

function participants(entry: BSBattleLogEntry): BSBattlePlayer[] {
  const { teams, players } = entry.battle;
  if (teams) return teams.flat();
  if (players) return players;
  return [];
}

/**
 * Reads the log for repeated causes, not individual excuses.
 *
 * Grouped rather than per-battle on purpose. One loss on a bad map is noise;
 * the same brawler losing three times on the same map is a habit, and a habit
 * is the only thing a reader can actually change.
 */
export function battleAutopsy({
  log,
  tag,
  form,
  limit = 3,
}: {
  log: BSBattleLogEntry[];
  tag: string;
  /** Per-map ladder form, keyed by map name. */
  form: Map<string, MapForm[]>;
  limit?: number;
}): Autopsy | null {
  const me = normalizeTag(tag);

  const badPicks = new Map<string, AutopsyFinding>();
  const nemeses = new Map<number, AutopsyFinding>();
  /** Appearances in this player's wins, the control for the loss counts. */
  const inWins = new Map<number, number>();
  let losses = 0;

  for (const entry of log) {
    const lost = entry.battle.result === 'defeat';

    if (!lost) {
      if (entry.battle.result !== 'victory') continue;
      const team = entry.battle.teams?.find((t) => t.some((p) => normalizeTag(p.tag) === me));
      if (!team) continue;
      const counted = new Set<number>();
      for (const player of participants(entry)) {
        if (team.some((mate) => mate.tag === player.tag)) continue;
        const id = player.brawler?.id;
        if (id === undefined || counted.has(id)) continue;
        counted.add(id);
        inWins.set(id, (inWins.get(id) ?? 0) + 1);
      }
      continue;
    }

    losses += 1;

    const everyone = participants(entry);
    const mine = everyone.find((p) => normalizeTag(p.tag) === me);
    if (!mine?.brawler) continue;

    const mapName = entry.event?.map;
    const mapForm = mapName ? form.get(mapName) : undefined;

    /*
     * Was the pick wrong for this map? Measured against the map's own average,
     * which is the only comparison that means anything — a brawler can be
     * strong overall and still be the wrong answer on one piece of terrain.
     */
    if (mapName && mapForm) {
      const here = mapForm.find((f) => f.brawlerId === mine.brawler.id);
      if (here && here.adjusted - 0.5 <= POOR_PICK) {
        const key = `${mine.brawler.id}-${mapName}`;
        const existing = badPicks.get(key);
        badPicks.set(key, {
          kind: 'map-pick',
          brawlerId: mine.brawler.id,
          brawlerName: mine.brawler.name,
          mapName,
          mode: entry.event?.mode,
          edge: here.adjusted - 0.5,
          losses: (existing?.losses ?? 0) + 1,
        });
      }
    }

    /*
     * Is one opponent brawler doing the damage? Counted once per losing battle
     * rather than per appearance; whether that count means anything is decided
     * later, against the same brawler's appearances in this player's wins.
     */
    const myTeam = entry.battle.teams?.find((team) =>
      team.some((p) => normalizeTag(p.tag) === me),
    );
    if (myTeam) {
      const seen = new Set<number>();
      for (const player of everyone) {
        if (myTeam.some((mate) => mate.tag === player.tag)) continue;
        const id = player.brawler?.id;
        if (id === undefined || seen.has(id)) continue;
        seen.add(id);
        const existing = nemeses.get(id);
        nemeses.set(id, {
          kind: 'nemesis',
          brawlerId: id,
          brawlerName: player.brawler.name,
          losses: (existing?.losses ?? 0) + 1,
        });
      }
    }
  }

  if (losses === 0) return null;

  const findings = [...badPicks.values(), ...nemeses.values()]
    .filter((finding) => finding.losses >= MIN_OCCURRENCES)
    .filter(
      (finding) =>
        finding.kind !== 'nemesis' ||
        finding.losses >= (inWins.get(finding.brawlerId) ?? 0) * NEMESIS_SKEW,
    )
    .sort((a, b) => {
      // A wrong pick is actionable; a recurring opponent is context. Both are
      // ranked by how much of the log they explain, picks first on a tie.
      if (b.losses !== a.losses) return b.losses - a.losses;
      return a.kind === 'map-pick' ? -1 : 1;
    })
    .slice(0, limit);

  return findings.length > 0 ? { losses, findings } : null;
}
