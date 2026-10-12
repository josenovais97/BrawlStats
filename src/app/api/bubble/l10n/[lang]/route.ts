import { unstable_cache } from 'next/cache';
import type { NextRequest } from 'next/server';

import { getGameModes, getMaps } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { bubbleLang } from '@/lib/bubble-langs';
import { UI_TRANSLATIONS } from '@/lib/bubble-ui';
import { BrawlApiError } from '@/lib/errors';
import { buildGameNames } from '@/lib/game-l10n';
import { errorResponse, okResponse } from '@/lib/route-helpers';

/**
 * GET /api/bubble/l10n/fr -- everything the panel needs to speak one language.
 *
 *   { lang, ui: { 'tab.meta': 'Méta', ... }, names: { hardrockmine: 'Mine hard-rock', ... } }
 *
 * One request per language, made once by the panel and kept in its storage,
 * so switching language costs a fetch and opening the panel costs nothing.
 *
 * `names` covers every map in the catalogue, every brawler, mode, star power,
 * gadget and gear: what the panel can show. Built from the game's files a
 * language at a time and cached for a day, which is also how a new map or
 * brawler gets its translations without anyone touching this -- the next
 * day's rebuild finds it in both the catalogue and the game's files.
 *
 * Under `/api/`, which robots.txt already disallows.
 */

/** Bumped when the shape changes, so panels drop a stored pack of the old one. */
const PACK_VERSION = 1;

const DAY = 86_400;

/** The English names the panel can display, from the catalogues it reads. */
async function displayableNames(): Promise<string[]> {
  const [maps, modes, brawlers, official] = await Promise.all([
    getMaps().catch(() => []),
    getGameModes().catch(() => []),
    getBrawlerArtMap().catch(() => new Map()),
    getOfficialBrawlers()
      .then((r) => r.items)
      .catch(() => []),
  ]);
  const names: string[] = ['Star Power', 'Gadget', 'Gear'];
  for (const m of maps) names.push(m.name);
  for (const m of modes) names.push(m.name);
  for (const b of brawlers.values()) {
    names.push(b.name);
    for (const a of [...(b.starPowers ?? []), ...(b.gadgets ?? [])]) names.push(a.name);
  }
  for (const b of official) {
    for (const g of b.gears ?? []) names.push(g.name);
  }
  return names;
}

const cachedNames = unstable_cache(
  async (file: string, locale: string) => buildGameNames(file, locale, await displayableNames()),
  ['bubble-l10n-names'],
  { revalidate: DAY },
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  try {
    const lang = bubbleLang((await params).lang);
    if (!lang) return errorResponse(new BrawlApiError('notFound', 'Not a supported language'));

    // English is the panel's own text and the catalogue's own names.
    if (lang.code === 'en') return okResponse({ v: PACK_VERSION, lang: 'en', ui: {}, names: {} }, DAY);

    const names = await cachedNames(lang.file, lang.code).catch(() => ({}));
    return okResponse(
      { v: PACK_VERSION, lang: lang.code, ui: UI_TRANSLATIONS[lang.code] ?? {}, names },
      // A day at the edge: names change when a map or brawler is added, which
      // is weeks apart, and the panel keeps its own copy anyway.
      Object.keys(names).length > 0 ? DAY : 60,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
