/**
 * Event variants the sampler files under their own name (battleModeOf): each
 * runs on a regular mode's engine, so `battle.mode` names the parent.
 */
export const VARIANT_MODES: ReadonlySet<string> = new Set([
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

/**
 * Variants the site does not list yet: no per-mode tier list, sitemap entry
 * or "Best modes" row. New mode pages in seven languages during the AdSense
 * review would be new sections (owner rule); their battles simply stop
 * polluting the modes they were filed under. Remove an entry to list it (it
 * stays filed apart either way).
 */
export const UNLISTED_MODES: ReadonlySet<string> = new Set(VARIANT_MODES);

export function isListedMode(mode: string): boolean {
  return !UNLISTED_MODES.has(mode);
}

/**
 * The mode a battle was really played in (2026-11-06).
 *
 * `battle.mode` names the engine an event runs on, `event.mode` the event.
 * For trophy event variants they differ: on 40 live battle logs Brawl Hockey
 * arrived as brawlBall, Mega Showdown as soloShowdown, Mega Duo and Trio
 * Showdown as duoShowdown, Brawl Arena as siege, and the 5v5 events as their
 * 3v3 parents, so about one trophy Brawl Ball battle in ten was Brawl Hockey.
 *
 * Only the known variants (VARIANT_MODES) take the event's name. The event
 * name is not simply better: the game also sends internal names for the very
 * same mode (Wipeout maps arrive as `deathmatch`, Duels maps as `tagTeam`),
 * and trusting those split two existing modes for one sampler run. Ranked
 * battles agreed on every sample.
 */
export function battleModeOf(entry: {
  event?: { mode?: string | null } | null;
  battle?: { mode?: string | null } | null;
}): string {
  const event = entry.event?.mode;
  if (event && VARIANT_MODES.has(event)) return event;
  return entry.battle?.mode ?? (event && event !== 'unknown' ? event : 'unknown');
}
