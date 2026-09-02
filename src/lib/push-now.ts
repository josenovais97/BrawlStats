import 'server-only';

import type { MapForm } from '@/lib/stats';
import type { BSPlayerBrawler, BSRotationSlot } from '@/types/brawlstars';

/**
 * What to press play with, right now.
 *
 * The profile already answers "how strong is this account" and "what should I
 * upgrade". This answers the question a player actually has thirty seconds
 * before a session: of the maps live at this moment, which one do I own a good
 * brawler for, and how long is it up.
 *
 * That is a different question from the roster read a few sections below it.
 * "You own a top-3 pick in 6 of 6 modes" describes the account; this names one
 * brawler, one map and a countdown. Everything here is already on the site —
 * the rotation on /events, the map form on each map page — and the only new
 * thing is the intersection with what this player owns.
 */

/** Below this a brawler is not a real option, whatever its win rate says. */
const USABLE_POWER = 9;

/**
 * A brawler has to beat its map's average by this much to be worth naming.
 *
 * Without a floor the page always has a "best" pick, including on maps where
 * the whole roster sits within noise of the average — and a recommendation
 * that is really "any of these forty" is worse than saying nothing, because it
 * spends the reader's trust on a coin flip.
 */
const MIN_EDGE = 0.02;

/** Roughly a third of a push: low enough that the next few wins come easily. */
const EASY_PUSH_RATIO = 0.6;

export interface PushOption {
  brawlerId: number;
  brawlerName: string;
  power: number;
  trophies: number;
  mapName: string;
  mode: string;
  /** 0.5 is the map's average; above it the brawler is genuinely better here. */
  adjusted: number;
  winRate: number;
  battles: number;
  endsAt: string;
  /** True when the brawler sits well below this account's usual trophy count. */
  easyPush: boolean;
}

/** "20260903T080000.000Z" — the game's own compact form, not ISO. */
function parseGameTime(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec));
}

/**
 * Ranks the live rotation against what this account owns.
 *
 * Slots already finished are dropped rather than shown as expired: the whole
 * value of the section is that it is actionable now, and a recommendation you
 * cannot act on is noise wearing the same styling as signal.
 */
export function pushOptions({
  rotation,
  brawlers,
  form,
  now = new Date(),
  limit = 4,
}: {
  rotation: BSRotationSlot[];
  brawlers: BSPlayerBrawler[];
  form: Map<string, MapForm[]>;
  now?: Date;
  limit?: number;
}): PushOption[] {
  const owned = new Map(brawlers.map((b) => [b.id, b]));

  /*
   * "Low for this account", not low in absolute terms. A brawler on 400
   * trophies is a push waiting to happen on an account averaging 900 and is
   * already overextended on one averaging 300, and only the first is worth
   * suggesting.
   */
  const ranked = brawlers.filter((b) => b.trophies > 0);
  const averageTrophies =
    ranked.length > 0 ? ranked.reduce((sum, b) => sum + b.trophies, 0) / ranked.length : 0;

  const options: PushOption[] = [];

  for (const slot of rotation) {
    const mapName = slot.event?.map;
    const ends = parseGameTime(slot.endTime ?? '');
    if (!mapName || !ends || ends.getTime() <= now.getTime()) continue;

    const mapForm = form.get(mapName);
    if (!mapForm) continue;

    /*
     * One option per map: the map's form list is already sorted, so the first
     * owned, usable brawler on it is the best this account can bring. Five
     * options for one map is a research task; the point is to hand over a
     * decision.
     */
    const entry = mapForm.find(
      (candidate) =>
        candidate.adjusted - 0.5 >= MIN_EDGE &&
        (owned.get(candidate.brawlerId)?.power ?? 0) >= USABLE_POWER,
    );
    if (!entry) continue;

    const mine = owned.get(entry.brawlerId)!;
    options.push({
      brawlerId: mine.id,
      brawlerName: mine.name,
      power: mine.power,
      trophies: mine.trophies,
      mapName,
      mode: slot.event?.mode ?? '',
      adjusted: entry.adjusted,
      winRate: entry.winRate,
      battles: entry.battles,
      endsAt: ends.toISOString(),
      easyPush: averageTrophies > 0 && mine.trophies < averageTrophies * EASY_PUSH_RATIO,
    });
  }

  /*
   * Sorted by how good the pick is, not by how soon the slot closes. A 61% map
   * that is up for six more hours beats a 52% one expiring in twenty minutes,
   * and urgency is already visible on each card.
   */
  return options.sort((a, b) => b.adjusted - a.adjusted).slice(0, limit);
}
