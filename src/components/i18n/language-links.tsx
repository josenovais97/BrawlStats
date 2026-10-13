import { Languages } from 'lucide-react';
import Link from 'next/link';

import { HTML_LANG, LOCALE_NAME, type Locale } from '@/lib/i18n';

const ORDER: Locale[] = ['en', 'es', 'pt'];

/**
 * The same page in the other languages, as plain links.
 *
 * On the English page too, not only the translations: a Spanish speaker who
 * lands on English from a link or a search has no other way to learn the page
 * exists in Spanish. Each link names its language in that language, which is
 * what a reader scanning for their own looks for.
 */
export function LanguageLinks({ locale, path }: { locale: Locale; path: string }) {
  return (
    <nav aria-label="Language" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
      <Languages aria-hidden className="size-3.5" />
      {ORDER.map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden>·</span> : null}
          {l === locale ? (
            <span aria-current="true" className="text-foreground">
              {LOCALE_NAME[l]}
            </span>
          ) : (
            <Link
              href={l === 'en' ? path : `/${l}${path}`}
              hrefLang={HTML_LANG[l]}
              lang={HTML_LANG[l]}
              className="hover:text-foreground hover:underline"
            >
              {LOCALE_NAME[l]}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
