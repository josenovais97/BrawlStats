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
const PACK_VERSION = 1;
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
 * The language switch: a small chip showing the current language, opening the
 * game's full list in each language's own name.
 *
 * Offered on every open rather than buried in settings, because the game has
 * its own language setting and the phone's is only a guess at it -- the
 * person whose guess is wrong is exactly the one who needs to find this.
 */
export function LanguagePicker() {
  const { lang, setLang, t } = usePanelI18n();
  const [open, setOpen] = useState(false);
  const current = bubbleLang(lang);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('lang.title')}
        className="bz-chip inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[10px]"
      >
        <span aria-hidden>🌐</span>
        {current?.code === 'en' ? 'EN' : (current?.label.split(' ')[0] ?? 'EN')}
      </button>
      {open ? (
        <div className="bz-panel absolute inset-x-1 top-full z-30 mt-1 p-2">
          <p className="display text-[13px] uppercase">{t('lang.title')}</p>
          <p className="mb-1.5 text-[10px] leading-snug text-muted">{t('lang.hint')}</p>
          <div className="grid grid-cols-2 gap-1">
            {BUBBLE_LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                dir={l.rtl ? 'rtl' : 'ltr'}
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
                aria-pressed={l.code === lang}
                className={`truncate px-2 py-1 text-start text-[11px] ${l.code === lang ? 'bz-chip-on' : 'bz-chip'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
