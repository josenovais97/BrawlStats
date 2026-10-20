'use client';

import { PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useT } from '@/components/i18n/use-t';

const YOUTUBE_SUBSCRIBE_URL = 'https://www.youtube.com/@brawlzonenet?sub_confirmation=1';

const STATE_KEY = 'brawlzone:yt-card';
const LATER_KEY = 'brawlzone:yt-card-later';

/** Pages with the card a reader has to open before it appears. */
const SHOW_FROM_VIEW = 3;
/** "Later" this many times reads as "no", and the card stops asking. */
const MAX_LATER = 3;

interface CardState {
  views: number;
  later: number;
  done: boolean;
}

function read(): CardState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STATE_KEY) ?? '{}') as Partial<CardState>;
    return { views: raw.views ?? 0, later: raw.later ?? 0, done: raw.done ?? false };
  } catch {
    return { views: 0, later: 0, done: false };
  }
}

function write(state: CardState) {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage disabled: the card behaves as on a first visit, which is fine.
  }
}

/**
 * Asks for a YouTube subscription, quietly (2026-10-20).
 *
 * The Supercell Creator Code needs 100 subscribers, and the footer link was
 * not getting them: nobody reads a footer. This sits in the page like any
 * other block, never over it, and only for someone who has already opened a
 * few of these pages, so it reaches readers who like the site rather than
 * everyone on arrival.
 *
 * The reader decides how often: "Later" hides it until the next visit (the
 * browser session), "Don't show again" for good, and three "Later"s count as
 * the second. Subscribing hides it for good too.
 */
export function YoutubeCard({ className = '' }: { className?: string }) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const state = read();
    if (state.done || state.later >= MAX_LATER) return;
    const next = { ...state, views: state.views + 1 };
    write(next);
    let later = false;
    try {
      later = window.sessionStorage.getItem(LATER_KEY) === '1';
    } catch {
      // No session storage: "Later" just lasts until the page is left.
    }
    if (later || next.views < SHOW_FROM_VIEW) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable in the browser
    setVisible(true);
    window.umami?.track('yt_card_shown');
  }, []);

  function close(how: 'later' | 'never' | 'subscribe') {
    setVisible(false);
    const state = read();
    if (how === 'later') {
      write({ ...state, later: state.later + 1 });
      try {
        window.sessionStorage.setItem(LATER_KEY, '1');
      } catch {
        // See above.
      }
    } else {
      write({ ...state, done: true });
    }
    window.umami?.track(`yt_card_${how}`);
  }

  if (!visible) return null;

  return (
    <aside className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${className}`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
        <PlayCircle aria-hidden className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t('The best Ranked picks, as 30-second Shorts')}</p>
        <p className="text-sm text-muted">
          {t('A new one every few hours: counters, builds, best brawlers per map. Free on YouTube.')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={YOUTUBE_SUBSCRIBE_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => close('subscribe')}
          className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-bold text-[#1a1200]"
        >
          {t('Subscribe')}
        </a>
        <button
          type="button"
          onClick={() => close('later')}
          className="inline-flex min-h-10 items-center rounded-xl border border-border px-3 text-sm font-semibold text-muted hover:text-foreground"
        >
          {t('Later')}
        </button>
        <button
          type="button"
          onClick={() => close('never')}
          className="inline-flex min-h-10 items-center rounded-xl px-2 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("Don't show again")}
        </button>
      </div>
    </aside>
  );
}
