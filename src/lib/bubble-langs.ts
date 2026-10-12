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
  /**
   * A flag beside the name, for whoever cannot read the list itself -- the
   * player who opened the panel in a language they do not speak. A language
   * is not a country, so this is the flag players most associate with it
   * (Brazil for the game's Brazilian Portuguese, Mexico for its Latin
   * American Spanish), and the English name sits under it as well.
   */
  flag: string;
  /** The language's name in English, the second way to find it. */
  english: string;
  file: string;
  rtl?: boolean;
}

export const BUBBLE_LANGS: BubbleLang[] = [
  { code: 'en', flag: '🇬🇧', english: 'English', label: 'English', file: 'texts' },
  { code: 'fr', flag: '🇫🇷', english: 'French', label: 'Français', file: 'fr' },
  { code: 'de', flag: '🇩🇪', english: 'German', label: 'Deutsch', file: 'de' },
  { code: 'es', flag: '🇪🇸', english: 'Spanish', label: 'Español', file: 'es' },
  { code: 'es-419', flag: '🇲🇽', english: 'Spanish (Latin America)', label: 'Español (Latinoamérica)', file: 'es-419' },
  { code: 'it', flag: '🇮🇹', english: 'Italian', label: 'Italiano', file: 'it' },
  { code: 'pt', flag: '🇧🇷', english: 'Portuguese', label: 'Português', file: 'pt' },
  { code: 'nl', flag: '🇳🇱', english: 'Dutch', label: 'Nederlands', file: 'nl' },
  { code: 'pl', flag: '🇵🇱', english: 'Polish', label: 'Polski', file: 'pl' },
  { code: 'tr', flag: '🇹🇷', english: 'Turkish', label: 'Türkçe', file: 'tr' },
  { code: 'fi', flag: '🇫🇮', english: 'Finnish', label: 'Suomi', file: 'fi' },
  { code: 'ru', flag: '🇷🇺', english: 'Russian', label: 'Русский', file: 'ru' },
  { code: 'zh-Hans', flag: '🇨🇳', english: 'Chinese (Simplified)', label: '简体中文', file: 'cn' },
  { code: 'zh-Hant', flag: '🇹🇼', english: 'Chinese (Traditional)', label: '繁體中文', file: 'cnt' },
  { code: 'ja', flag: '🇯🇵', english: 'Japanese', label: '日本語', file: 'jp' },
  { code: 'ko', flag: '🇰🇷', english: 'Korean', label: '한국어', file: 'kr' },
  { code: 'ms', flag: '🇲🇾', english: 'Malay', label: 'Bahasa Melayu', file: 'ms' },
  { code: 'id', flag: '🇮🇩', english: 'Indonesian', label: 'Bahasa Indonesia', file: 'id' },
  { code: 'vi', flag: '🇻🇳', english: 'Vietnamese', label: 'Tiếng Việt', file: 'vi' },
  { code: 'th', flag: '🇹🇭', english: 'Thai', label: 'ภาษาไทย', file: 'th' },
  { code: 'ar', flag: '🇸🇦', english: 'Arabic', label: 'العربية', file: 'ar', rtl: true },
  { code: 'he', flag: '🇮🇱', english: 'Hebrew', label: 'עברית', file: 'he', rtl: true },
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
