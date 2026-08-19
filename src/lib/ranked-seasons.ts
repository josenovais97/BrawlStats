import { getBrawlers } from '@/lib/brawlapi';
import { slugify } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';

/**
 * Ranked seasons, kept by hand.
 *
 * Nothing publishes this. The official API has no season endpoint, and neither
 * does the artwork mirror — `/seasons`, `/ranked` and `/rankedseasons` are all
 * 404, and the brawler payload carries no trial flag. A player battle log does
 * not name the season either. So a curated table is the only way to answer
 * "when does this season end" and "which brawlers can I try", and both are
 * things people actually plan around.
 *
 * The cost is maintenance: one entry per season, roughly every five weeks. The
 * code is built so a missed entry degrades rather than lies — an unrecognised
 * date resolves to no current season and every surface hides itself, instead of
 * confidently naming a season that ended a month ago.
 *
 * Trial brawlers are stored by name rather than by id: names are what the
 * patch notes publish, they are stable, and they are checkable at a glance by
 * whoever updates this next. They resolve against the live brawler list, so a
 * typo drops one portrait rather than breaking the section.
 */
export interface RankedSeason {
  /** Season number as the game counts them. */
  number: number;
  /** First day of the season, UTC. Seasons roll at 00:00 UTC. */
  startsOn: string;
  /**
   * The three maxed brawlers everyone can field this season, by name.
   *
   * @see TRIAL_BRAWLER_RULES for what "maxed" means here.
   */
  trialBrawlers: string[];
  /** Mode the season's new maps were added to, when the notes name one. */
  newMapsMode?: string;
}

/**
 * Newest last. Add a season when it is announced; nothing else needs changing.
 */
export const RANKED_SEASONS: RankedSeason[] = [
  {
    number: 47,
    startsOn: '2026-07-16',
    trialBrawlers: ['Berry', 'Tara', 'Meg'],
    newMapsMode: 'Gem Grab',
  },
  {
    number: 48,
    startsOn: '2026-08-20',
    trialBrawlers: ['Trunk', 'Willow', 'Kaze'],
    newMapsMode: 'Brawl Ball',
  },
];

/**
 * What a trial brawler actually gives you, in the game's own terms.
 *
 * Kept next to the data because it is the half people get wrong: a trial
 * brawler is not a locked brawler you may borrow, it is a fully maxed one, and
 * it counts toward the power-11 requirement that gates the higher ranks.
 */
export const TRIAL_BRAWLER_RULES = [
  'Playable in Ranked even if you have not unlocked them.',
  'Fielded at Power 11 with every Gadget, Star Power, Gear, Buffie and their Hypercharge, exactly as in Friendly Battles.',
  'They count toward the Power 11 brawler requirement for each rank — Mythic and above need more than 12.',
] as const;

export interface ResolvedSeason extends RankedSeason {
  /** Exclusive: the day the next season starts. Null when none is known yet. */
  endsOn: string | null;
  /** Trial brawlers joined to their artwork. Missing names are dropped. */
  brawlers: BABrawler[];
}

export interface SeasonState {
  current: ResolvedSeason | null;
  next: ResolvedSeason | null;
  /** Whole days until the next season starts. Null when none is scheduled. */
  daysUntilNext: number | null;
}

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * Resolves which season is running, and which is next.
 *
 * `now` is a parameter rather than read from the clock so this stays pure —
 * the React Compiler lint rejects reading the clock during render, and it also
 * makes the boundary behaviour testable with a fixed date.
 */
export async function getSeasonState(now: Date = new Date()): Promise<SeasonState> {
  const brawlers = await getBrawlers().catch(() => [] as BABrawler[]);
  const bySlug = new Map(brawlers.map((b) => [slugify(b.name), b]));

  const resolve = (season: RankedSeason, index: number): ResolvedSeason => ({
    ...season,
    endsOn: RANKED_SEASONS[index + 1]?.startsOn ?? null,
    brawlers: season.trialBrawlers
      .map((name) => bySlug.get(slugify(name)))
      .filter((b): b is BABrawler => Boolean(b)),
  });

  const today = startOfUtcDay(now);
  const ordered = [...RANKED_SEASONS].sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  let current: ResolvedSeason | null = null;
  let next: ResolvedSeason | null = null;

  for (let i = 0; i < ordered.length; i += 1) {
    const start = Date.parse(`${ordered[i].startsOn}T00:00:00Z`);
    if (start <= today) current = resolve(ordered[i], i);
    else if (!next) next = resolve(ordered[i], i);
  }

  const daysUntilNext = next
    ? Math.round((Date.parse(`${next.startsOn}T00:00:00Z`) - today) / 86_400_000)
    : null;

  return { current, next, daysUntilNext };
}
