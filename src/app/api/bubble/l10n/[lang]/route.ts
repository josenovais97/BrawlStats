import type { NextRequest } from 'next/server';

import { bubbleGameNames } from '@/lib/bubble-game-names';
import { bubbleLang } from '@/lib/bubble-langs';
import { UI_TRANSLATIONS } from '@/lib/bubble-ui';
import { BrawlApiError } from '@/lib/errors';
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
const PACK_VERSION = 2;

const DAY = 86_400;


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  try {
    const lang = bubbleLang((await params).lang);
    if (!lang) return errorResponse(new BrawlApiError('notFound', 'Not a supported language'));

    // English is the panel's own text and the catalogue's own names.
    if (lang.code === 'en') return okResponse({ v: PACK_VERSION, lang: 'en', ui: {}, names: {} }, DAY);

    const names = await bubbleGameNames(lang).catch(() => ({}));
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
