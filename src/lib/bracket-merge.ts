import type { BrawlerStatRow } from '@/types/stats';

/**
 * Several Ranked brackets' rows as one roster (2026-11-23, owner: "avoid doing
 * posts with all ranks, it ends up not being real. most people are mythic +").
 *
 * Wins and the baseline are weighted by each bracket's decided battles, so a
 * brawler is measured against the lobbies it actually played in. A bracket's
 * usage rate is its own picks over its own battles; the merged rate is the
 * brawler's picks over every bracket's battles, each bracket's total read
 * back from any of its rows (sampleSize / usageRate).
 */
export function mergeBracketRows(sets: BrawlerStatRow[][]): BrawlerStatRow[] {
  const totals = sets.map((rows) => {
    const r = rows.find((x) => x.usageRate && x.sampleSize > 0);
    return r ? r.sampleSize / (r.usageRate as number) : 0;
  });
  const all = totals.reduce((a, b) => a + b, 0);
  const by = new Map<number, { row: BrawlerStatRow; wins: number; base: number; decided: number }>();
  for (const rows of sets) {
    for (const r of rows) {
      const cur = by.get(r.brawlerId) ?? {
        row: { ...r, sampleSize: 0, decidedSampleSize: 0, ownerSampleSize: 0 },
        wins: 0,
        base: 0,
        decided: 0,
      };
      cur.row.sampleSize += r.sampleSize;
      cur.row.decidedSampleSize += r.decidedSampleSize;
      cur.row.ownerSampleSize += r.ownerSampleSize;
      if (r.winRate !== null && r.baselineWinRate !== null && r.decidedSampleSize > 0) {
        cur.wins += r.winRate * r.decidedSampleSize;
        cur.base += r.baselineWinRate * r.decidedSampleSize;
        cur.decided += r.decidedSampleSize;
      }
      by.set(r.brawlerId, cur);
    }
  }
  return [...by.values()].map(({ row, wins, base, decided }) => ({
    ...row,
    winRate: decided > 0 ? wins / decided : null,
    baselineWinRate: decided > 0 ? base / decided : null,
    usageRate: all > 0 ? row.sampleSize / all : null,
  }));
}
