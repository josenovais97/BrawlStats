import 'server-only';

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { currentMonth } from '@/lib/site';
import { humanizeMode } from '@/lib/format';
import { findBySlug, slugify } from '@/lib/slugs';
import {
  DEFAULT_TIER_WINDOW,
  TIER_WINDOWS,
  getFilterableModes,
  isTierWindow,
  type TierFormat,
  type TierWindowKey,
} from '@/lib/stats';

/**
 * The URL scheme for the tier lists, in one place.
 *
 * Both dimensions a reader can change — which mode, which window — are path
 * segments, and the two routes below cover every shape:
 *
 *   /tier-list/ranked                 all modes, default window
 *   /tier-list/ranked/24h             all modes, 24h
 *   /tier-list/ranked/gem-grab        gem grab, default window
 *   /tier-list/ranked/gem-grab/24h    gem grab, 24h
 *
 * The first segment after the format is therefore ambiguous — it is a window
 * key or a mode slug — which is resolvable only because the window keys are a
 * closed set of two and no game mode is named "24h". `resolveTierRoute` is the
 * one place that ambiguity is decided, so the six route files never each get
 * their own opinion about it.
 *
 * Why paths and not `?window=`: reading `searchParams` in a server component
 * opts the route out of static rendering, which is what had both tier lists
 * and every one of their mode pages re-rendering against the database on every
 * request. See `tierListHref`.
 */

/** Builds the canonical URL for a (format, window, mode) combination. */
export function tierListHref(
  format: TierFormat,
  windowKey: TierWindowKey,
  mode?: string,
): string {
  const segments = ['tier-list', format];
  if (mode) segments.push(slugify(mode));
  // The default window stays out of the URL, so a bare path and its explicit
  // form are never two URLs competing to rank for one page.
  if (windowKey !== DEFAULT_TIER_WINDOW) segments.push(windowKey);
  return `/${segments.join('/')}`;
}

export interface TierRoute {
  windowKey: TierWindowKey;
  /** Undefined on the all-modes lists. Not yet checked against real data. */
  modeSlug?: string;
}

/**
 * Turns the path segments after `/tier-list/{format}` into a scope.
 *
 * Never returns for a URL that is not the canonical spelling of its own
 * content: an explicit default window redirects to the bare form, and anything
 * that does not name a real combination 404s rather than soft-404ing into an
 * empty list.
 */
export function resolveTierRoute(
  format: TierFormat,
  segments: (string | undefined)[],
): TierRoute {
  const [first, second] = segments.filter((s): s is string => Boolean(s));

  if (!first) return { windowKey: DEFAULT_TIER_WINDOW };

  // One segment: a window on its own, or a mode at the default window.
  if (!second) {
    if (!isTierWindow(first)) return { windowKey: DEFAULT_TIER_WINDOW, modeSlug: first };
    if (first === DEFAULT_TIER_WINDOW) permanentRedirect(tierListHref(format, first));
    return { windowKey: first };
  }

  // Two segments: mode then window, in that order and no other.
  if (isTierWindow(first) || !isTierWindow(second)) notFound();
  if (second === DEFAULT_TIER_WINDOW) {
    permanentRedirect(tierListHref(format, second, first));
  }
  return { windowKey: second, modeSlug: first };
}

const COPY: Record<
  TierFormat,
  { noun: string; modeNoun: string; description: string }
> = {
  ranked: {
    noun: 'Ranked tier list',
    modeNoun: 'Ranked',
    description:
      'The best Brawl Stars brawlers in competitive Ranked, MONTH. Built from win and pick rates in sampled Ranked battles and updated every few hours.',
  },
  trophy: {
    noun: 'trophy tier list',
    modeNoun: 'trophy ladder',
    description:
      'The best Brawl Stars brawlers on the trophy ladder, MONTH. Built from win and pick rates in sampled ladder battles, showdown included, and updated every few hours.',
  },
};

/**
 * Title, description and indexing directive for one tier-list URL.
 *
 * The month tracks regeneration rather than build time, which stays honest
 * because these pages revalidate hourly off a sampler that runs every few.
 *
 * The 24h views are `noindex, follow`. They are a real view worth linking and
 * a poor thing to index: over 24 hours a mode page ranks about one brawler
 * against sixty-odd on the default window, so letting search engines have them
 * would put a dozen near-empty pages in front of the full ones they duplicate.
 * `follow` keeps the links out of them working normally.
 */
export async function tierListMetadata(
  format: TierFormat,
  { windowKey, modeSlug }: TierRoute,
): Promise<Metadata> {
  const copy = COPY[format];
  const isDefaultWindow = windowKey === DEFAULT_TIER_WINDOW;
  const windowSuffix = isDefaultWindow ? '' : `, last ${TIER_WINDOWS[windowKey].sublabel}`;
  const robots = isDefaultWindow ? undefined : { index: false, follow: true };

  if (!modeSlug) {
    return {
      title: `Brawl Stars ${copy.noun} (${currentMonth()})${windowSuffix}`,
      description: copy.description.replace('MONTH', currentMonth()),
      alternates: { canonical: tierListHref(format, windowKey) },
      robots,
    };
  }

  const modes = await getFilterableModes(30, 150, format).catch(() => []);
  const match = findBySlug(modes, modeSlug, (m) => m.mode);
  const resolved = match?.mode ?? modeSlug;
  const label = humanizeMode(resolved);

  return {
    title: `Best Brawl Stars brawlers for ${label}, ${copy.modeNoun} (${currentMonth()})${windowSuffix}`,
    description: `Which brawlers win most in ${label}, ranked by meta score from sampled ${
      format === 'ranked' ? 'competitive Ranked' : 'trophy-ladder'
    } battles.`,
    alternates: { canonical: tierListHref(format, windowKey, resolved) },
    robots,
  };
}
