import 'server-only';

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { languageAlternates, localePath, monthYear, rankLabel, type Locale } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { bracketBySlug, type RankBracket } from '@/lib/rank-brackets';
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
  locale: Locale = 'en',
): TierRoute {
  const [first, second] = segments.filter((s): s is string => Boolean(s));

  if (!first) return { windowKey: DEFAULT_TIER_WINDOW };

  // One segment: a window on its own, or a mode at the default window.
  if (!second) {
    if (!isTierWindow(first)) return { windowKey: DEFAULT_TIER_WINDOW, modeSlug: first };
    if (first === DEFAULT_TIER_WINDOW) permanentRedirect(localePath(locale, tierListHref(format, first)));
    return { windowKey: first };
  }

  // Two segments: mode then window, in that order and no other.
  if (isTierWindow(first) || !isTierWindow(second)) notFound();
  if (second === DEFAULT_TIER_WINDOW) {
    permanentRedirect(localePath(locale, tierListHref(format, second, first)));
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
/** Canonical in the page's language, plus the page in the other two. */
function alternatesFor(path: string, locale: Locale): Metadata['alternates'] {
  return { canonical: localePath(locale, path), languages: languageAlternates(path) };
}

/**
 * The translations' titles. Written for what people type in each language:
 * "tier list brawl stars", "mejores brawlers para atrapagemas", "melhores
 * brawlers pique-gema" -- the game's own mode name, the month, the list.
 */
const INTL: Record<
  Exclude<Locale, 'en'>,
  {
    where: Record<TierFormat, string>;
    index: (where: string, month: string) => [string, string];
    mode: (mode: string, where: string, month: string) => [string, string];
    rank: (rank: string, month: string) => [string, string];
    rankMode: (mode: string, rank: string, month: string) => [string, string];
    last24: string;
  }
> = {
  es: {
    where: { ranked: 'Competitivo', trophy: 'trofeos' },
    index: (where, month) => [
      `Tier list de Brawl Stars en ${where} (${month}): los mejores brawlers`,
      `Los mejores brawlers de Brawl Stars en ${where}, ${month}. Hecha con las tasas de victoria y de uso de partidas reales, y actualizada cada pocas horas.`,
    ],
    mode: (mode, where, month) => [
      `Mejores brawlers para ${mode} en Brawl Stars (${month}): tier list de ${where}`,
      `Los brawlers que más ganan en ${mode} ahora mismo, ordenados con partidas reales de ${where} y actualizados cada pocas horas. Mira los mejores antes de tu próxima partida de ${mode}.`,
    ],
    rank: (rank, month) => [
      `Tier list de Brawl Stars en ${rank} (${month}): los mejores brawlers de tu rango`,
      `Los mejores brawlers de Brawl Stars en ${rank}, ${month}. Hecha solo con partidas de Competitivo jugadas en ${rank}, porque el meta de tu rango no es el de arriba.`,
    ],
    rankMode: (mode, rank, month) => [
      `Mejores brawlers para ${mode} en ${rank} (${month}): tier list de Brawl Stars`,
      `Los brawlers que más ganan en ${mode} en ${rank}, con partidas reales de Competitivo de ese rango, actualizados cada pocas horas.`,
    ],
    last24: ', últimas 24 horas',
  },
  pt: {
    where: { ranked: 'Ranqueado', trophy: 'troféus' },
    index: (where, month) => [
      `Tier list do Brawl Stars ${where === 'Ranqueado' ? 'no Ranqueado' : 'nos troféus'} (${month}): os melhores brawlers`,
      `Os melhores brawlers do Brawl Stars ${where === 'Ranqueado' ? 'no Ranqueado' : 'nos troféus'}, ${month}. Feita com as taxas de vitória e de escolha de partidas reais e atualizada a cada poucas horas.`,
    ],
    mode: (mode, where, month) => [
      `Melhores brawlers para ${mode} no Brawl Stars (${month}): tier list ${where === 'Ranqueado' ? 'do Ranqueado' : 'de troféus'}`,
      `Os brawlers que mais ganham em ${mode} agora, ordenados por partidas reais ${where === 'Ranqueado' ? 'do Ranqueado' : 'de troféus'} e atualizados a cada poucas horas. Veja os melhores antes da sua próxima partida de ${mode}.`,
    ],
    rank: (rank, month) => [
      `Tier list do Brawl Stars no ${rank} (${month}): os melhores brawlers do seu rank`,
      `Os melhores brawlers do Brawl Stars no ${rank}, ${month}. Feita só com partidas ranqueadas jogadas no ${rank}, porque o meta do seu rank não é o do topo.`,
    ],
    rankMode: (mode, rank, month) => [
      `Melhores brawlers para ${mode} no ${rank} (${month}): tier list do Brawl Stars`,
      `Os brawlers que mais ganham em ${mode} no ${rank}, com partidas ranqueadas reais desse rank, atualizados a cada poucas horas.`,
    ],
    last24: ', últimas 24 horas',
  },
};

export async function tierListMetadata(
  format: TierFormat,
  { windowKey, modeSlug }: TierRoute,
  locale: Locale = 'en',
): Promise<Metadata> {
  const copy = COPY[format];
  const isDefaultWindow = windowKey === DEFAULT_TIER_WINDOW;
  const windowSuffix = isDefaultWindow ? '' : `, last ${TIER_WINDOWS[windowKey].sublabel}`;
  const robots = isDefaultWindow ? undefined : { index: false, follow: true };

  if (locale !== 'en') {
    const t = INTL[locale];
    const month = monthYear(locale);
    const suffix = isDefaultWindow ? '' : t.last24;
    let resolved: string | undefined;
    if (modeSlug) {
      const modes = await getFilterableModes(30, 150, format).catch(() => []);
      resolved = findBySlug(modes, modeSlug, (m) => m.mode)?.mode ?? modeSlug;
    }
    const [title, description] = resolved
      ? t.mode((await gameWords(locale)).mode(resolved), t.where[format], month)
      : t.index(t.where[format], month);
    return {
      title: `${title}${suffix}`,
      description,
      alternates: alternatesFor(tierListHref(format, windowKey, resolved), locale),
      robots,
    };
  }

  if (!modeSlug) {
    return {
      title: `Brawl Stars ${copy.noun} (${currentMonth()})${windowSuffix}`,
      description: copy.description.replace('MONTH', currentMonth()),
      alternates: alternatesFor(tierListHref(format, windowKey), locale),
      robots,
    };
  }

  const modes = await getFilterableModes(30, 150, format).catch(() => []);
  const match = findBySlug(modes, modeSlug, (m) => m.mode);
  const resolved = match?.mode ?? modeSlug;
  const label = humanizeMode(resolved);

  return {
    /*
     * The search first. Search Console (to 2026-10-05) had the Gem Grab page
     * at position 4.8 with 43 impressions and no clicks: the title opened on
     * "Best Brawl Stars brawlers for", so the words people typed ("best gem
     * grab brawlers") sat mid-sentence, and it ended on a qualifier nobody
     * searches for. Now: the answer's name, the month, then what kind of list.
     */
    title: `Best ${label} brawlers in Brawl Stars (${currentMonth()}): ${
      format === 'ranked' ? 'Ranked' : 'ladder'
    } tier list${windowSuffix}`,
    description: `The brawlers winning most in ${label} right now, ranked from real ${
      format === 'ranked' ? 'competitive Ranked' : 'trophy-ladder'
    } battles and refreshed every few hours. See the top picks before your next ${label} game.`,
    alternates: alternatesFor(tierListHref(format, windowKey, resolved), locale),
    robots,
  };
}

/*
 * Ranked brackets get pages of their own, under a fixed `rank` segment:
 *
 *   /tier-list/ranked/rank/mythic             every mode, Mythic lobbies
 *   /tier-list/ranked/rank/mythic/gem-grab    Gem Grab, Mythic lobbies
 *
 * Paths for the same reason as everything above (a query string would make the
 * route dynamic), and a fixed segment so none of it competes with the
 * mode-or-window ambiguity `resolveTierRoute` settles: a static segment wins
 * over `[scope]`, and no mode is called "rank". Default window only: a bracket
 * is already a slice of the sample, and 24 hours of a slice is too little.
 */

/** The bracket list's URL, or the all-ranks list when no bracket is given. */
export function bracketTierListHref(bracket: RankBracket | null | undefined, mode?: string): string {
  if (!bracket) return tierListHref('ranked', DEFAULT_TIER_WINDOW, mode);
  return `/tier-list/ranked/rank/${bracket.slug}${mode ? `/${slugify(mode)}` : ''}`;
}

/** The bracket a `rank/<slug>` segment names, or a 404. */
export function resolveBracket(slug: string): RankBracket {
  const bracket = bracketBySlug(slug);
  if (!bracket) notFound();
  return bracket;
}

export async function bracketTierListMetadata(
  bracket: RankBracket,
  modeSlug?: string,
  locale: Locale = 'en',
): Promise<Metadata> {
  if (locale !== 'en') {
    const t = INTL[locale];
    const month = monthYear(locale);
    const rank = rankLabel(bracket, locale);
    let resolved: string | undefined;
    if (modeSlug) {
      const modes = await getFilterableModes(30, 150, 'ranked').catch(() => []);
      resolved = findBySlug(modes, modeSlug, (m) => m.mode)?.mode ?? modeSlug;
    }
    const [title, description] = resolved
      ? t.rankMode((await gameWords(locale)).mode(resolved), rank, month)
      : t.rank(rank, month);
    return { title, description, alternates: alternatesFor(bracketTierListHref(bracket, resolved), locale) };
  }
  const month = currentMonth();
  if (!modeSlug) {
    return {
      // What people type: "brawl stars mythic tier list".
      title: `Brawl Stars ${bracket.label} tier list (${month}): best brawlers at your rank`,
      description: `The best Brawl Stars brawlers in ${bracket.label} Ranked, ${month}. Built only from battles played in ${bracket.label} lobbies, because the meta at your rank is not the meta at the top.`,
      alternates: alternatesFor(bracketTierListHref(bracket), locale),
    };
  }
  const modes = await getFilterableModes(30, 150, 'ranked').catch(() => []);
  const resolved = findBySlug(modes, modeSlug, (m) => m.mode)?.mode ?? modeSlug;
  const label = humanizeMode(resolved);
  return {
    title: `Best ${label} brawlers in ${bracket.label} Ranked (${month}): Brawl Stars tier list`,
    description: `The brawlers winning most in ${label} at ${bracket.label} rank, from real Ranked battles in ${bracket.label} lobbies, refreshed every few hours.`,
    alternates: alternatesFor(bracketTierListHref(bracket, resolved), locale),
  };
}
