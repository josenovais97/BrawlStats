'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LocaleFlags } from '@/components/i18n/flags';
import { isTranslatedPath, localeOfPath, localePath, stripLocale, type Locale } from '@/lib/i18n';

/**
 * "This page is also in Portuguese" -- for a visitor whose browser asks for
 * Spanish or Portuguese and who landed on another language, usually English
 * from a search or a shared link.
 *
 * A suggestion, never a redirect. Sending people somewhere by their browser
 * language confuses search engines (the crawler reads English) and annoys
 * anyone who chose the English page on purpose. Any choice is remembered in
 * this browser -- picking a language here or in the header menu, or closing
 * the bar -- and the bar does not come back after one.
 */

const KEY = 'bz-lang';

/** Remember the reader's choice so the bar stops asking. */
export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Private mode or blocked storage: the bar may ask again, which is fine.
  }
}

function remembered(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The language the browser asks for, if it is one the site has. */
function browserLocale(): Locale | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'es' || base === 'pt' || base === 'en') return base;
  }
  return null;
}

const COPY: Record<Locale, { text: string; go: string; close: string }> = {
  en: { text: 'This page is also in English.', go: 'Read in English', close: 'Close' },
  es: { text: 'Esta página también está en español.', go: 'Ver en español', close: 'Cerrar' },
  pt: { text: 'Esta página também está em português.', go: 'Ver em português', close: 'Fechar' },
};

export function LanguageSuggest() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [target, setTarget] = useState<Locale | null>(null);

  useEffect(() => {
    const current = localeOfPath(pathname);
    const wanted = browserLocale();
    const english = stripLocale(pathname);
    // Read after mount: storage and browser language do not exist on the
    // server, and the page must render the same there as on first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget(!remembered() && wanted && wanted !== current && isTranslatedPath(english) ? wanted : null);
  }, [pathname]);

  if (!target) return null;
  const copy = COPY[target];
  const current = localeOfPath(pathname);

  return (
    <div lang={target} className="border-b border-border/70 bg-surface-2/80">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <LocaleFlags locale={target} />
        <span className="min-w-0 flex-1 text-muted">{copy.text}</span>
        <button
          type="button"
          onClick={() => {
            rememberLocale(target);
            setTarget(null);
            router.push(localePath(target, stripLocale(pathname)));
          }}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-ink hover:bg-brand-strong"
        >
          {copy.go}
        </button>
        <button
          type="button"
          aria-label={copy.close}
          onClick={() => {
            rememberLocale(current);
            setTarget(null);
          }}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
