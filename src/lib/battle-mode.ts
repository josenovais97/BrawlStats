/**
 * The mode a battle was really played in (2026-11-06).
 *
 * `battle.mode` names the engine an event runs on, `event.mode` names the
 * event. For trophy games they differ: on 40 live battle logs Brawl Hockey
 * arrived as brawlBall, Mega Showdown as soloShowdown, Mega Duo and Trio
 * Showdown as duoShowdown, Brawl Arena as siege, and the 5v5 events as their
 * 3v3 parents. The sampler took `battle.mode` first, so about one trophy Brawl
 * Ball battle in ten was really Brawl Hockey. Ranked battles agreed on every
 * sample, so Ranked data keeps its keys. `unknown` (a mode the API has no
 * name for yet) falls back to the battle's own mode.
 */
export function battleModeOf(entry: {
  event?: { mode?: string | null } | null;
  battle?: { mode?: string | null } | null;
}): string {
  const event = entry.event?.mode;
  if (event && event !== 'unknown') return event;
  return entry.battle?.mode ?? 'unknown';
}

/**
 * Event variants the sampler files separately since 2026-11-06 but the site
 * does not list yet: no per-mode tier list, sitemap entry or "Best modes"
 * row. Six new mode pages in seven languages during the AdSense review would
 * be new sections (owner rule); their battles simply stop polluting the modes
 * they were filed under. Remove an entry to list it.
 */
export const UNLISTED_MODES: ReadonlySet<string> = new Set([
  'airHockey',
  'megaShowdown',
  'megaDuoShowdown',
  'trioShowdown',
  'brawlArena',
  'brawlBall5V5',
  'knockout5V5',
  'deathmatch5v5',
  'gemGrab5V5',
  'heist5V5',
  'hotZone5V5',
  'bounty5V5',
  'wipeout5V5',
]);

export function isListedMode(mode: string): boolean {
  return !UNLISTED_MODES.has(mode);
}
