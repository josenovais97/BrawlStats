/**
 * The languages the Bubble panel speaks: exactly the ones Brawl Stars ships.
 *
 * Matching the game is the point. A player drafting in French sees "Rocher de
 * la belle" and "El Costo" on the draft screen, and a panel that says "Belle's
 * Rock" and "El Primo" makes them translate in their head under a timer -- or
 * not recognise the map at all. So every map, mode, brawler and build name
 * comes from the game's own localisation files (see `lib/game-l10n`), and only
 * the panel's own sentences are ours.
 *
 * `file` is the game's name for each file, which is not a language tag: `jp`,
 * `kr`, `cn` (simplified) and `cnt` (traditional) among them.
 *
 * Client-safe: no translations here, so the panel bundle stays small. Each
 * language arrives in one request, only when it is chosen.
 */
export interface BubbleLang {
  code: string;
  /** What the player sees in the picker: the language's own name. */
  label: string;
  file: string;
  rtl?: boolean;
}

export const BUBBLE_LANGS: BubbleLang[] = [
  { code: 'en', label: 'English', file: 'texts' },
  { code: 'fr', label: 'Français', file: 'fr' },
  { code: 'de', label: 'Deutsch', file: 'de' },
  { code: 'es', label: 'Español', file: 'es' },
  { code: 'es-419', label: 'Español (Latinoamérica)', file: 'es-419' },
  { code: 'it', label: 'Italiano', file: 'it' },
  { code: 'pt', label: 'Português', file: 'pt' },
  { code: 'nl', label: 'Nederlands', file: 'nl' },
  { code: 'pl', label: 'Polski', file: 'pl' },
  { code: 'tr', label: 'Türkçe', file: 'tr' },
  { code: 'fi', label: 'Suomi', file: 'fi' },
  { code: 'ru', label: 'Русский', file: 'ru' },
  { code: 'zh-Hans', label: '简体中文', file: 'cn' },
  { code: 'zh-Hant', label: '繁體中文', file: 'cnt' },
  { code: 'ja', label: '日本語', file: 'jp' },
  { code: 'ko', label: '한국어', file: 'kr' },
  { code: 'ms', label: 'Bahasa Melayu', file: 'ms' },
  { code: 'id', label: 'Bahasa Indonesia', file: 'id' },
  { code: 'vi', label: 'Tiếng Việt', file: 'vi' },
  { code: 'th', label: 'ภาษาไทย', file: 'th' },
  { code: 'ar', label: 'العربية', file: 'ar', rtl: true },
  { code: 'he', label: 'עברית', file: 'he', rtl: true },
];

export const BUBBLE_LANG_CODES = new Set(BUBBLE_LANGS.map((l) => l.code));

export function bubbleLang(code: string | null | undefined): BubbleLang | null {
  return BUBBLE_LANGS.find((l) => l.code === code) ?? null;
}

/**
 * The panel's language from the phone's, for a player who has not chosen one.
 *
 * The WebView reports the device locale. Usually that is the game's language
 * too, and the picker covers the rest: the game has its own language setting,
 * so a phone in English can run the game in Spanish.
 */
export function detectBubbleLang(preferred: readonly string[]): string {
  for (const raw of preferred) {
    const tag = raw.toLowerCase();
    const [base, region = ''] = tag.split('-');
    if (base === 'zh') {
      return /hant|tw|hk|mo/.test(tag) ? 'zh-Hant' : 'zh-Hans';
    }
    // Spain gets Castilian; every other Spanish-speaking region the game's
    // Latin American file.
    if (base === 'es') return region === '' || region === 'es' ? 'es' : 'es-419';
    // Older Android still reports the pre-1989 codes for these two.
    if (base === 'iw') return 'he';
    if (base === 'in') return 'id';
    if (base === 'ja' || base === 'ko' || BUBBLE_LANG_CODES.has(base)) return base;
  }
  return 'en';
}
