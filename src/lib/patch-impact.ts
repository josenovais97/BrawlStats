import 'server-only';

import { CHANGE_LABEL, type ChangeCategory } from '@/lib/release-notes';
import type { PatchSplit } from '@/lib/stats';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * What the last update did to *this* account.
 *
 * Every site publishes the patch notes and every site publishes the new tier
 * list. Neither answers the question the player actually has on update day,
 * which is whether any of it applies to them — a nerf to a brawler you have
 * never touched is news about someone else's account.
 *
 * Two things are joined here that nobody else has together: Supercell's own
 * change list, parsed by category, and a per-brawler before/after measured from
 * our daily snapshots. The roster decides which rows are worth showing.
 */

/** Below this a move is inside the noise of a short sample. */
const MEANINGFUL_MOVE = 0.01;

/**
 * Snapshots needed after the patch before a move is worth printing.
 *
 * Two days produced swings of twelve points in both directions, which is not
 * what a balance change does — it is what a two-day sample does. Publishing
 * those would be the map-form mistake again: a number that looks like a
 * finding, is the first thing a reader would quote, and is mostly noise.
 *
 * So the section ships the day a patch lands, showing which of the player's
 * brawlers were touched, and fills in the measurements a few days later when
 * they mean something.
 */
const MIN_DAYS_AFTER = 3;

/** Rows shown before the list becomes a wall. An update can touch forty. */
export const PATCH_ROWS_SHOWN = 8;

/**
 * How long an update stays interesting.
 *
 * The section removes itself afterwards rather than becoming another permanent
 * block on an already long page. Three weeks covers the window where "what did
 * the patch do to me" is a live question, and by then the next one is usually
 * close.
 */
export const PATCH_RELEVANT_DAYS = 21;

/** Whether an update is recent enough to still be worth a section. */
export function patchIsRecent(publishedAt: string | null | undefined, now = Date.now()): boolean {
  if (!publishedAt) return false;
  return (now - new Date(publishedAt).getTime()) / 86_400_000 <= PATCH_RELEVANT_DAYS;
}

export interface PatchRow {
  brawlerId: number;
  name: string;
  category: ChangeCategory;
  categoryLabel: string;
  /** Power the account holds it at, or null when it is not owned. */
  power: number | null;
  trophies: number;
  /** Adjusted win-rate move across the patch date, or null when unmeasured. */
  delta: number | null;
  daysAfter: number;
}

export interface PatchImpact {
  /** Capped for display; `changedTotal` keeps the real figure. */
  rows: PatchRow[];
  /** Every brawler the update touched, owned or not. */
  changedTotal: number;
  /** How many of those this account owns. */
  ownedTotal: number;
  /** Owned and measurably improved / worsened, for the headline. */
  buffed: number;
  nerfed: number;
  /** The thinnest "after" sample behind any row, for the caveat line. */
  daysAfter: number;
}

/**
 * Joins the update's change list to the roster and the measurements.
 *
 * Returns null unless something here is both *owned* and *measured*, and that
 * pair of conditions is the whole design.
 *
 * The first version showed every brawler the notes named — "the 1 September
 * update changed 41 brawlers you own" over eight rows of "too early to
 * measure". Each part was true and the whole thing was useless: a large patch
 * touches most of the roster, so the count says nothing, and a section that
 * cannot yet say what changed is a placeholder taking up a screen.
 *
 * Unowned brawlers are dropped for the same reason. "Something you have never
 * unlocked was buffed" is not a thing the reader can act on, and it was padding
 * the list to the point where the rows that mattered were below the fold.
 *
 * So this stays absent for the first days after a patch and appears once the
 * snapshots can say which of the reader's own brawlers actually moved — which
 * is the only version of this section worth a place on the page.
 */
export function patchImpact({
  changes,
  brawlers,
  split,
  byName,
}: {
  changes: { category: ChangeCategory; brawlers: string[] }[];
  brawlers: BSPlayerBrawler[];
  split: Map<number, PatchSplit>;
  /** Lowercased brawler name to id, from the catalogue. */
  byName: Map<string, number>;
}): PatchImpact | null {
  const owned = new Map(brawlers.map((b) => [b.id, b]));
  const rows: PatchRow[] = [];
  const seen = new Set<number>();

  for (const change of changes) {
    for (const name of change.brawlers) {
      const id = byName.get(name.toLowerCase());
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);

      const mine = owned.get(id);
      const measured = split.get(id);
      const delta =
        measured &&
        measured.before !== null &&
        measured.after !== null &&
        measured.daysAfter >= MIN_DAYS_AFTER
          ? measured.after - measured.before
          : null;

      rows.push({
        brawlerId: id,
        name,
        category: change.category,
        categoryLabel: CHANGE_LABEL[change.category],
        power: mine?.power ?? null,
        trophies: mine?.trophies ?? 0,
        delta,
        daysAfter: measured?.daysAfter ?? 0,
      });
    }
  }

  /*
   * Owned and measured only. Everything else is a patch note, and Supercell
   * already published those.
   */
  const useful = rows.filter((row) => row.power !== null && row.delta !== null);
  if (useful.length === 0) return null;

  /*
   * Owned first, then by how far the brawler moved. A player scanning this
   * wants their own roster before the rest of the patch, and within that the
   * biggest change first — in either direction, because a nerf to something
   * they main matters as much as a buff.
   */
  // Biggest move first, in either direction: a nerf to something they main
  // matters as much as a buff. Trophies break a tie, so the brawlers this
  // account actually plays win it.
  useful.sort((a, b) => {
    const moveDiff = Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0);
    return moveDiff !== 0 ? moveDiff : b.trophies - a.trophies;
  });

  return {
    rows: useful.slice(0, PATCH_ROWS_SHOWN),
    changedTotal: useful.length,
    ownedTotal: useful.length,
    buffed: useful.filter((r) => (r.delta ?? 0) >= MEANINGFUL_MOVE).length,
    nerfed: useful.filter((r) => (r.delta ?? 0) <= -MEANINGFUL_MOVE).length,
    daysAfter: Math.min(...useful.map((r) => r.daysAfter).filter((d) => d > 0), Infinity),
  };
}
