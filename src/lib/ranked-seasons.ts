import { getBrawlers } from '@/lib/brawlapi';
import { slugify } from '@/lib/slugs';
import { WIKI_API, fetchWikiJson } from '@/lib/wiki';
import type { BABrawler } from '@/types/brawlapi';

/**
 * Ranked seasons: when they turn over, who the trial brawlers are, and which
 * maps are in the pool.
 *
 * None of this comes from an API, and not for want of looking. The official
 * API has no season endpoint and its `/events/rotation` is the trophy ladder
 * only — fifteen slots, no Ranked. The artwork mirror documents exactly five
 * endpoints (brawlers, events, gamemodes, icons, maps); `/seasons`, `/ranked`
 * and `/rankedseasons` all 404, and its `/events` returns an empty rotation.
 *
 * What does publish it is the community wiki, as structured wikitext tables,
 * reachable through the MediaWiki API. That is what this reads. It is someone
 * else's page and can be restructured without notice, so every step degrades:
 * a failed fetch or an unparseable table falls back to the curated table
 * below, and dates fall back to the published schedule rule.
 *
 * Wiki text is CC-BY-SA, which the season panel attributes on the page.
 */

const WIKI_API_PAGE = `${WIKI_API}?action=parse&page=Ranked&prop=wikitext&format=json`;

/** Seasons turn over monthly; twice a day is far more than enough. */
const REVALIDATE_SEASONS = 43_200;

export interface RankedSeason {
  /** Season number as the game counts them. */
  number: number;
  /** First day of the season, ISO date. */
  startsOn: string;
  /** The three maxed brawlers everyone can field, by name. */
  trialBrawlers: string[];
  /** The mode the season features, when one is named. */
  featuredMode?: string;
}

/**
 * Last-resort season data, used only when the wiki cannot be read or parsed.
 *
 * Deliberately short: it exists so the panel degrades to something true rather
 * than vanishing, not as a second copy of the wiki to keep in sync. Anything
 * older than the current pair is not worth carrying.
 */
const FALLBACK_SEASONS: RankedSeason[] = [
  {
    number: 47,
    startsOn: '2026-07-16',
    trialBrawlers: ['Berry', 'Tara', 'Meg'],
    featuredMode: 'Gem Grab',
  },
  {
    number: 48,
    startsOn: '2026-08-20',
    trialBrawlers: ['Trunk', 'Willow', 'Kaze'],
    featuredMode: 'Brawl Ball',
  },
];

/**
 * What a trial brawler actually gives you, in the game's own terms.
 *
 * This is the half people get wrong: a trial brawler is not a locked brawler
 * you may borrow, it is a fully maxed one, and it counts toward the power-11
 * requirement that gates the higher ranks.
 */
export const TRIAL_BRAWLER_RULES = [
  'Playable in Ranked even if you have not unlocked them.',
  'Fielded at Power 11 with every Gadget, Star Power, Gear, Buffie and their Hypercharge, exactly as in Friendly Battles.',
  'They count toward the Power 11 brawler requirement for each rank — Mythic and above need more than 12.',
] as const;

/**
 * Modifiers were removed from Ranked in the February 2025 rework.
 *
 * Worth stating on the page: it is the reason a per-map Ranked win rate means
 * anything at all. Every sampled Ranked battle is the plain mode on the plain
 * map, with no power-ups or mutators mixed in — and since the battle log
 * exposes no modifier field, there would be no way to filter them out if they
 * did still exist.
 */
export const RANKED_HAS_NO_MODIFIERS = true;

export interface ResolvedSeason extends RankedSeason {
  /** Exclusive: the day the next season starts. */
  endsOn: string | null;
  /** Trial brawlers joined to their artwork. Unmatched names are dropped. */
  brawlers: BABrawler[];
}

/** The Ranked map pool for one mode. */
export interface MapPoolEntry {
  mode: string;
  maps: string[];
  /** The season's featured mode gets a marker in the pool table. */
  featured: boolean;
}

export interface SeasonState {
  /** The season running today, when one is known. */
  current: ResolvedSeason | null;
  /** The announced successor, when the wiki lists one. */
  next: ResolvedSeason | null;
  /**
   * The newest season we have data for, running or not.
   *
   * Distinct from `current` so the panel can say "season 48 has ended and 49
   * is not published yet" instead of either going blank or carrying on calling
   * a finished season the current one.
   */
  latest: ResolvedSeason | null;
  /** The next turnover date, announced or derived from the schedule. */
  nextStartsOn: string | null;
  /** Whole days until that turnover. Never negative. */
  daysUntilNext: number | null;
  /** Active map pool, when the wiki published one. */
  mapPool: MapPoolEntry[];
  /** Which season the published pool belongs to. */
  mapPoolSeason: number | null;
  /** Whether the numbers came from the wiki or from the fallback table. */
  source: 'wiki' | 'fallback';
}

/* ------------------------------- the schedule ------------------------------ */

/**
 * Ranked seasons start on the third Thursday of the month.
 *
 * Checked against every season the wiki lists: 17 of 18 land exactly on it.
 * The one exception is season 31, which began with the February 2025 Ranked
 * rework rather than on schedule — a release date, not a cadence.
 *
 * This is what lets an end date exist for the newest season, which by
 * definition has no next entry to read one off.
 */
export function thirdThursday(year: number, month: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  // getUTCDay(): Sunday 0 … Thursday 4.
  const offset = (4 - first.getUTCDay() + 7) % 7;
  const day = new Date(Date.UTC(year, month, 1 + offset + 14));
  return day.toISOString().slice(0, 10);
}

/** The season boundary after `startsOn`, i.e. the next month's third Thursday. */
function nextBoundary(startsOn: string): string {
  const start = new Date(`${startsOn}T00:00:00Z`);
  return thirdThursday(start.getUTCFullYear(), start.getUTCMonth() + 1);
}

/**
 * The first scheduled turnover strictly after `today`.
 *
 * Used when the newest season we know of has already ended and no successor
 * has been published. Without it the countdown is computed against a boundary
 * in the past and renders as a negative number of days, which is how a stale
 * source turns into a visibly broken panel rather than a quietly old one.
 */
function boundaryAfter(today: number): string {
  const day = new Date(today);
  let candidate = thirdThursday(day.getUTCFullYear(), day.getUTCMonth());
  if (Date.parse(`${candidate}T00:00:00Z`) <= today) {
    candidate = thirdThursday(day.getUTCFullYear(), day.getUTCMonth() + 1);
  }
  return candidate;
}

/* -------------------------------- wiki parse ------------------------------- */

/** Every `[[File:Name.png|…|link=Target]]` in a chunk, as `[name, target]`. */
function fileLinks(text: string): [string, string][] {
  return [...text.matchAll(/\[\[File:([^.|\]]+)[^\]]*?link=([^\]|]+)\]\]/g)].map(
    (m) => [m[1].trim(), m[2].trim()] as [string, string],
  );
}

/**
 * Pulls the trial-brawler table out of the page.
 *
 * Rows look like:
 *   |47||July 16, 2026||[[File:Berry Portrait.png|x41px|link=Berry]]…||
 *   [[File:Gem Grab.png|x41px|link=Gem Grab]]
 *
 * Brawlers and the featured mode are told apart by the file name rather than
 * by position, because the mode cell wraps onto its own line and is sometimes
 * absent entirely.
 */
function parseSeasons(wikitext: string): RankedSeason[] {
  const start = wikitext.indexOf('==Trial Brawlers==');
  if (start === -1) return [];
  const end = wikitext.indexOf('\n==', start + 5);
  const section = wikitext.slice(start, end === -1 ? undefined : end);

  const seasons: RankedSeason[] = [];

  for (const chunk of section.split('|-')) {
    const row = /^\s*\|(\d+)\|\|\s*([A-Z][a-z]+ \d{1,2}, \d{4})\s*\|\|/.exec(chunk);
    if (!row) continue;

    const startsOn = toIsoDate(row[2]);
    if (!startsOn) continue;

    const links = fileLinks(chunk);
    const trialBrawlers = links
      .filter(([file]) => /portrait/i.test(file))
      .map(([, target]) => target);
    const featured = links.find(([file]) => !/portrait/i.test(file));

    if (trialBrawlers.length === 0) continue;

    seasons.push({
      number: Number(row[1]),
      startsOn,
      trialBrawlers,
      ...(featured ? { featuredMode: featured[1] } : {}),
    });
  }

  return seasons.sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

/**
 * Pulls the active map pool out of the page.
 *
 * The table is one row per mode: a mode icon cell, then one cell per map. The
 * mode cell is recognised by its `65xpx` thumbnail (the table's own convention,
 * typo included) and map cells by the `-Map.png` suffix.
 */
function parseMapPool(wikitext: string): { season: number | null; pool: MapPoolEntry[] } {
  const start = wikitext.indexOf('==Maps==');
  if (start === -1) return { season: null, pool: [] };
  const end = wikitext.indexOf('\n==', start + 5);
  const section = wikitext.slice(start, end === -1 ? undefined : end);

  const seasonMatch = /Active maps \(Season (\d+)\)/i.exec(section);
  const pool: MapPoolEntry[] = [];
  let current: MapPoolEntry | null = null;

  for (const line of section.split('\n')) {
    const mode = /^\|\s*\[\[File:([^.|\]]+)\.png\|65x?px[^\]]*\]\]/.exec(line);
    if (mode) {
      current = {
        mode: mode[1].trim(),
        maps: [],
        // The featured mode carries a "FEATURED!" caption in the same cell.
        featured: /FEATURED/i.test(line),
      };
      pool.push(current);
      continue;
    }

    if (!current || !line.includes('-Map.png')) continue;
    // The map's own name is the plain wiki link after the thumbnail.
    const name = /\[\[([^\]|]+)\]\]\s*$/.exec(line);
    if (name) current.maps.push(name[1].trim());
  }

  return {
    season: seasonMatch ? Number(seasonMatch[1]) : null,
    pool: pool.filter((entry) => entry.maps.length > 0),
  };
}

/** "July 16, 2026" -> "2026-07-16". Null when it does not parse. */
function toIsoDate(value: string): string | null {
  const parsed = Date.parse(`${value} UTC`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

async function fetchWiki(): Promise<{
  seasons: RankedSeason[];
  mapPool: MapPoolEntry[];
  mapPoolSeason: number | null;
} | null> {
  try {
    const body = await fetchWikiJson<{ parse?: { wikitext?: { '*'?: unknown } } }>(
      WIKI_API_PAGE,
      REVALIDATE_SEASONS,
    );
    const wikitext = body?.parse?.wikitext?.['*'];
    if (typeof wikitext !== 'string') return null;

    const seasons = parseSeasons(wikitext);
    if (seasons.length === 0) return null;

    const { season, pool } = parseMapPool(wikitext);
    return { seasons, mapPool: pool, mapPoolSeason: season };
  } catch {
    return null;
  }
}

/* --------------------------------- resolve --------------------------------- */

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * Resolves which season is running and which is next.
 *
 * `now` is a parameter rather than read from the clock so this stays pure —
 * the React Compiler lint rejects reading the clock during render, and it makes
 * the turnover boundary testable with a fixed date.
 */
export async function getSeasonState(now: Date = new Date()): Promise<SeasonState> {
  const [wiki, brawlers] = await Promise.all([
    fetchWiki(),
    getBrawlers().catch(() => [] as BABrawler[]),
  ]);

  const seasons = wiki?.seasons ?? FALLBACK_SEASONS;
  const bySlug = new Map(brawlers.map((b) => [slugify(b.name), b]));
  const today = startOfUtcDay(now);

  const resolve = (season: RankedSeason, index: number): ResolvedSeason => ({
    ...season,
    // The next entry's start, or — for the newest season, which has none — the
    // schedule rule, so the countdown works the moment a season is announced.
    endsOn: seasons[index + 1]?.startsOn ?? nextBoundary(season.startsOn),
    brawlers: season.trialBrawlers
      .map((name) => bySlug.get(slugify(name)))
      .filter((b): b is BABrawler => Boolean(b)),
  });

  let latest: ResolvedSeason | null = null;
  let next: ResolvedSeason | null = null;

  for (let i = 0; i < seasons.length; i += 1) {
    const start = Date.parse(`${seasons[i].startsOn}T00:00:00Z`);
    if (start <= today) latest = resolve(seasons[i], i);
    else if (!next) next = resolve(seasons[i], i);
  }

  // Only genuinely current if today falls inside it. A season whose end has
  // passed with nothing published to replace it has ended — saying otherwise
  // would keep naming last month's trial brawlers indefinitely.
  const hasEnded =
    latest !== null && Date.parse(`${latest.endsOn}T00:00:00Z`) <= today;
  const current = latest && !hasEnded ? latest : null;

  const nextStartsOn = next?.startsOn ?? (current ? current.endsOn : boundaryAfter(today));
  const daysUntilNext = Math.max(
    0,
    Math.round((Date.parse(`${nextStartsOn}T00:00:00Z`) - today) / 86_400_000),
  );

  return {
    current,
    next,
    latest,
    nextStartsOn,
    daysUntilNext,
    mapPool: wiki?.mapPool ?? [],
    mapPoolSeason: wiki?.mapPoolSeason ?? null,
    source: wiki ? 'wiki' : 'fallback',
  };
}
