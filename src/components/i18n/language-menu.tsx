'use client';

import { Check, ChevronDown, Languages } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { HTML_LANG, LOCALE_NAME, localeOfPath, stripLocale, type Locale } from '@/lib/i18n';

const ORDER: Locale[] = ['en', 'es', 'pt'];

const LABEL: Record<Locale, string> = { en: 'Language', es: 'Idioma', pt: 'Idioma' };

/** The current page's address in another language. */
function pathIn(locale: Locale, englishPath: string): string {
  if (locale === 'en') return englishPath;
  return englishPath === '/' ? `/${locale}` : `/${locale}${englishPath}`;
}

/**
 * The language switch in the header, on every page.
 *
 * Each option is a plain link to the same page in that language, so it works
 * without JavaScript and a choice is just an address -- shareable, and what a
 * search engine already indexes. Every language is named in itself, which is
 * what a reader scanning for their own looks for.
 */
export function LanguageMenu({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname() ?? '/';
  const locale = localeOfPath(pathname);
  const english = stripLocale(pathname);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on navigation, on a click elsewhere, and on Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${LABEL[locale]}: ${LOCALE_NAME[locale]}`}
        className={
          compact
            ? 'grid h-10 min-w-10 place-items-center gap-1 rounded-lg border border-border px-2 text-xs font-bold uppercase text-muted transition-colors hover:text-foreground'
            : 'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground'
        }
      >
        <span className="flex items-center gap-1">
          <Languages aria-hidden className="size-4" />
          <span className="uppercase">{locale}</span>
          {compact ? null : <ChevronDown aria-hidden className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />}
        </span>
      </button>

      {open ? (
        <ul className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface shadow-lg shadow-black/40">
          {ORDER.map((l) => (
            <li key={l}>
              <Link
                href={pathIn(l, english)}
                hrefLang={HTML_LANG[l]}
                lang={HTML_LANG[l]}
                aria-current={l === locale ? 'true' : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  l === locale ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-surface-2 hover:text-foreground'
                }`}
              >
                {LOCALE_NAME[l]}
                {l === locale ? <Check aria-hidden className="size-4" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
