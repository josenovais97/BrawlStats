'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { BUBBLE_LANGS, bubbleLang, detectBubbleLang } from '@/lib/bubble-langs';
import { fill, UI_EN, type UiKey, type UiStrings } from '@/lib/bubble-ui-en';
import { nameKey, titleCaseIn } from '@/lib/game-l10n';
import { panelTrack } from '@/lib/panel-telemetry';

/**
 * The panel's language: which one, and the strings and game names for it.
 *
 * The page is one cached URL for everybody, so it renders in English and the
 * language is applied here, in the client. A chosen language is kept in
 * storage with its pack (`/api/bubble/l10n/<lang>`), so after the first open
 * the panel draws in that language straight away, with no request, and
 * refreshes the pack in the background once it is a day old.
 *
 * The first open in a new language shows English for the moment the request
 * takes. That is the honest fallback: every string has an English original,
 * and a panel that waited for the pack before drawing anything would be a
 * blank overlay over a draft timer.
 */

const STORED_LANG = 'brawlzone.bubble.lang';
const STORED_PACK = 'brawlzone.bubble.l10n.';
/** Must match PACK_VERSION in the route. */
const PACK_VERSION = 2;
const STALE_MS = 24 * 60 * 60 * 1000;

interface Pack {
  v: number;
  at: number;
  ui: UiStrings;
  names: Record<string, string>;
}

interface PanelI18n {
  lang: string;
  rtl: boolean;
  setLang: (code: string) => void;
  /** One of the panel's own sentences. */
  t: (key: UiKey, vars?: Record<string, string | number>) => string;
  /** A sentence with React nodes in its placeholders, e.g. a bold map name. */
  tx: (key: UiKey, vars: Record<string, ReactNode>) => ReactNode[];
  /** A map, mode, brawler or build name as the game shows it. */
  name: (english: string) => string;
}

const english = (text: string) => titleCaseIn(text, 'en');

const Ctx = createContext<PanelI18n>({
  lang: 'en',
  rtl: false,
  setLang: () => undefined,
  t: (key, vars) => fill(UI_EN[key], vars),
  tx: (key, vars) => splice(UI_EN[key], vars),
  name: english,
});

export function usePanelI18n(): PanelI18n {
  return useContext(Ctx);
}

/** `{name}` placeholders replaced by nodes; strings around them kept as text. */
function splice(template: string, vars: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key && key in vars ? <span key={i}>{vars[key]}</span> : part;
  });
}

function readPack(code: string): Pack | null {
  try {
    const raw = window.localStorage.getItem(STORED_PACK + code);
    if (!raw) return null;
    const pack = JSON.parse(raw) as Pack;
    return pack.v === PACK_VERSION ? pack : null;
  } catch {
    return null;
  }
}

function writePack(code: string, pack: Pack) {
  try {
    // One stored pack at a time: they are ~40 KB each and a player uses one.
    for (const l of BUBBLE_LANGS) {
      if (l.code !== code) window.localStorage.removeItem(STORED_PACK + l.code);
    }
    window.localStorage.setItem(STORED_PACK + code, JSON.stringify(pack));
  } catch {
    // Full or blocked storage: the panel still works, it just fetches again.
  }
}

export function PanelI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState('en');
  const [pack, setPack] = useState<Pack | null>(null);

  /* The saved choice, else the phone's language. Read after mount, as with
     every other stored preference, so server and client render the same. */
  useEffect(() => {
    let chosen = 'en';
    try {
      const saved = window.localStorage.getItem(STORED_LANG);
      chosen = bubbleLang(saved)?.code ?? detectBubbleLang(navigator.languages ?? [navigator.language]);
    } catch {
      chosen = detectBubbleLang(typeof navigator === 'undefined' ? [] : (navigator.languages ?? []));
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(chosen);
  }, []);

  /* The pack for the language: stored copy first, network when missing or old. */
  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === 'en') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPack(null);
      return;
    }
    const stored = readPack(lang);
    setPack(stored);
    if (stored && Date.now() - stored.at < STALE_MS) return;

    const controller = new AbortController();
    fetch(`/api/bubble/l10n/${encodeURIComponent(lang)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Omit<Pack, 'at'>) => {
        const fresh: Pack = { v: data.v, at: Date.now(), ui: data.ui ?? {}, names: data.names ?? {} };
        // An empty name table means the game's files were unreachable; keep
        // the strings for now but do not store it, so the next open retries.
        if (Object.keys(fresh.names).length > 0) writePack(lang, fresh);
        setPack(fresh);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [lang]);

  const setLang = useCallback((code: string) => {
    if (!bubbleLang(code)) return;
    try {
      window.localStorage.setItem(STORED_LANG, code);
    } catch {
      // ignored
    }
    panelTrack('panel_lang', { lang: code });
    setLangState(code);
  }, []);

  const value = useMemo<PanelI18n>(() => {
    const ui = pack?.ui ?? {};
    const names = pack?.names ?? {};
    return {
      lang,
      rtl: Boolean(bubbleLang(lang)?.rtl),
      setLang,
      t: (key, vars) => fill(ui[key] ?? UI_EN[key], vars),
      tx: (key, vars) => splice(ui[key] ?? UI_EN[key], vars),
      name: (text) => names[nameKey(text)] ?? english(text),
    };
  }, [lang, pack, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The panel's outermost box, turned right-to-left for Arabic and Hebrew. */
export function PanelRoot({ children }: { children: ReactNode }) {
  const { rtl } = usePanelI18n();
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="bz-screen min-h-dvh px-2 py-2">
      {children}
    </div>
  );
}

/** One of the panel's sentences, for the server-rendered parts of the page. */
export function PanelText({ k }: { k: UiKey }) {
  const { t } = usePanelI18n();
  return <>{t(k)}</>;
}

/**
 * The language setting: a chip (or a full row, on the first-open screen)
 * showing the current language, opening a sheet with all twenty-two.
 *
 * Offered on every open rather than buried in settings, because the game has
 * its own language setting and the phone's is only a guess at it -- and the
 * person whose guess was wrong is reading a panel in a language they may not
 * understand. Hence the flags, and each language's English name under its
 * own: three ways to find yours, two of which need no reading at all.
 *
 * A sheet over the whole panel rather than a dropdown: the overlay is ~375dp
 * tall in landscape, and twenty-two languages in a dropdown would be a list
 * inside a list, scrolled with a thumb that is also holding the game.
 */
export function LanguagePicker({ variant = 'chip' }: { variant?: 'chip' | 'row' }) {
  const { lang, setLang, t } = usePanelI18n();
  const [open, setOpen] = useState(false);
  const current = bubbleLang(lang) ?? BUBBLE_LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {variant === 'chip' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`${t('lang.title')}: ${current.label}`}
          className="bz-chip inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[11px]"
        >
          <span aria-hidden className="text-sm leading-none">{current.flag}</span>
          <span>{current.code.split('-')[0].toUpperCase()}</span>
          <span aria-hidden className="text-[8px] opacity-70">▼</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="bz-chip flex w-full items-center gap-2 px-3 py-2 text-start"
        >
          <span aria-hidden className="text-lg leading-none">🌐</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[13px]">{t('lang.title')}</span>
            <span className="block truncate font-sans text-[11px] font-normal text-muted [text-shadow:none]">
              {current.flag} {current.label}
            </span>
          </span>
          <span aria-hidden className="text-xs opacity-70">{current.flag} ▸</span>
        </button>
      )}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('lang.title')}
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#050a1f]/75 p-2 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="bz-panel flex w-full max-w-xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span aria-hidden className="text-2xl leading-none">🌐</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="display block text-base uppercase">{t('lang.title')}</span>
                {/* "Language" in English as well, for the reader who opened
                    this because they cannot read the line above it. */}
                {lang !== 'en' ? (
                  <span className="block text-[10px] text-muted">Language</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="bz-chip grid size-8 shrink-0 place-items-center text-sm"
              >
                ✕
              </button>
            </header>

            <p className="px-3 pt-2 text-[11px] leading-snug text-muted">{t('lang.hint')}</p>

            <ul className="grid flex-1 grid-cols-2 content-start gap-1.5 overflow-y-auto p-2.5 sm:grid-cols-3">
              {BUBBLE_LANGS.map((l) => {
                const on = l.code === lang;
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setLang(l.code);
                        setOpen(false);
                      }}
                      aria-pressed={on}
                      lang={l.code}
                      className={`relative flex w-full items-center gap-2 px-2 py-1.5 text-start ${
                        on ? 'bz-chip-on' : 'bz-chip'
                      }`}
                    >
                      <span aria-hidden className="text-[22px] leading-none">{l.flag}</span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span dir={l.rtl ? 'rtl' : 'ltr'} className="block truncate text-[12px]">
                          {l.label}
                        </span>
                        <span className="block truncate font-sans text-[9px] font-normal opacity-75 [text-shadow:none]">
                          {l.english}
                        </span>
                      </span>
                      {on ? (
                        <span aria-hidden className="shrink-0 text-xs font-black">✓</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
