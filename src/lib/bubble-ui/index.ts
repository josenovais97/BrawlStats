import type { UiStrings } from '@/lib/bubble-ui-en';

import ar from './ar';
import de from './de';
import es from './es';
import es419 from './es-419';
import fi from './fi';
import fr from './fr';
import he from './he';
import id from './id';
import it from './it';
import ja from './ja';
import ko from './ko';
import ms from './ms';
import nl from './nl';
import pl from './pl';
import pt from './pt';
import ru from './ru';
import th from './th';
import tr from './tr';
import vi from './vi';
import zhHans from './zh-Hans';
import zhHant from './zh-Hant';

/**
 * Every translation of the panel's own sentences, by `BUBBLE_LANGS` code.
 *
 * Server-only in practice: imported by the l10n route, never by a component,
 * so a phone downloads one language rather than twenty-one.
 */
export const UI_TRANSLATIONS: Record<string, UiStrings> = {
  ar,
  de,
  es,
  'es-419': es419,
  fi,
  fr,
  he,
  id,
  it,
  ja,
  ko,
  ms,
  nl,
  pl,
  pt,
  ru,
  th,
  tr,
  vi,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
};
