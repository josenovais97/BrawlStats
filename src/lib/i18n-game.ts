import 'server-only';

import { bubbleGameNames } from '@/lib/bubble-game-names';
import { bubbleLang } from '@/lib/bubble-langs';
import { humanizeMode, titleCase } from '@/lib/format';
import { nameKey } from '@/lib/game-l10n';
import type { Locale } from '@/lib/i18n';

/**
 * Mode and map names in the game's own words for a translated page.
 *
 * The same names the Bubble shows, from the same cached dictionary (see
 * `bubbleGameNames`), so the site and the overlay never disagree. A name the
 * game files do not have -- a mode only the API calls by that name -- stays in
 * English rather than being guessed at.
 */
export interface GameWords {
  /** An API mode key ("gemGrab") as the player's game writes it. */
  mode: (mode: string) => string;
  /** A map name ("HARD ROCK MINE" or "Hard Rock Mine") likewise. */
  map: (name: string) => string;
}

/** Which of the game's files each locale reads. */
const GAME_LANG: Record<Exclude<Locale, 'en'>, string> = { es: 'es-419', pt: 'pt' };

/**
 * "FÚTBRAWL 5c5" -> "Fútbrawl 5c5". The game shouts a few names, the 5v5
 * modes among them, and `pickName` only calms a name that is capitals all the
 * way through -- the lowercase "c" in "5c5" gets these past it.
 */
function calm(name: string, locale: string): string {
  return name.replace(/\p{Lu}{2,}/gu, (word) => word.charAt(0) + word.slice(1).toLocaleLowerCase(locale));
}

const ENGLISH: GameWords = { mode: (m) => humanizeMode(m), map: (n) => titleCase(n) };

export async function gameWords(locale: Locale): Promise<GameWords> {
  if (locale === 'en') return ENGLISH;
  const lang = bubbleLang(GAME_LANG[locale]);
  const names = lang ? await bubbleGameNames(lang).catch(() => ({}) as Record<string, string>) : {};
  return {
    mode: (m) => calm(names[nameKey(humanizeMode(m))] ?? humanizeMode(m), lang?.code ?? locale),
    map: (n) => calm(names[nameKey(n)] ?? titleCase(n), lang?.code ?? locale),
  };
}
