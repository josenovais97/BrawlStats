'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { PickerEntry } from '@/lib/brawldle-data';
import { type DailyStats, EMPTY_STATS, currentStreak, recordResult } from '@/lib/brawldle-stats';
import { useT } from '@/components/i18n/use-t';

/**
 * Shadow and Zoom, the two picture puzzles (2026-10-22).
 *
 * Six guesses. Each wrong one costs a heart and, in Zoom, pulls the picture
 * back; the image comes from /api/brawldle/picture already cut, so nothing in
 * the page names the brawler. State and stats live in this browser only, under
 * their own keys, the way the classic board keeps its own.
 */

export type PictureMode = 'shadow' | 'zoom';
export const TRIES = 6;

export interface Guess {
  slug: string;
  name: string;
  imageUrl: string | null;
  correct: boolean;
}

export interface PictureSaved {
  date: string;
  guesses: Guess[];
  solved: boolean;
  answer: { name: string; slug: string; imageUrl: string | null } | null;
}

export const pictureKey = (mode: PictureMode) => `brawlzone-daily-${mode}`;
const statsKey = (mode: PictureMode) => `brawlzone-daily-${mode}-stats`;

export function loadPicture(mode: PictureMode, date: string): PictureSaved | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(pictureKey(mode)) ?? 'null') as PictureSaved | null;
    return parsed?.date === date ? parsed : null;
  } catch {
    return null;
  }
}

function savePicture(mode: PictureMode, state: PictureSaved) {
  try {
    localStorage.setItem(pictureKey(mode), JSON.stringify(state));
  } catch {
    /* Private window: the puzzle still plays, it just forgets. */
  }
}

function loadStats(mode: PictureMode): DailyStats {
  try {
    return { ...EMPTY_STATS, ...(JSON.parse(localStorage.getItem(statsKey(mode)) ?? '{}') as Partial<DailyStats>) };
  } catch {
    return EMPTY_STATS;
  }
}

function saveStats(mode: PictureMode, stats: DailyStats) {
  try {
    localStorage.setItem(statsKey(mode), JSON.stringify(stats));
  } catch {
    /* As above. */
  }
}

const GLOW: Record<PictureMode, string> = {
  shadow: 'from-violet-500/40 via-indigo-500/20 to-transparent',
  zoom: 'from-sky-500/40 via-cyan-500/15 to-transparent',
};

export function PictureBoard({
  mode,
  date,
  picker,
  onChange,
}: {
  mode: PictureMode;
  date: string;
  picker: PickerEntry[];
  onChange?: (state: PictureSaved) => void;
}) {
  const t = useT();
  const [board, setBoard] = useState<PictureSaved | null>(null);
  const [stats, setStats] = useState<DailyStats>(EMPTY_STATS);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // A one-shot read of browser storage; see ChallengeBoard for why it is an effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBoard(loadPicture(mode, date) ?? { date, guesses: [], solved: false, answer: null });
    setStats(loadStats(mode));
  }, [mode, date]);

  const guesses = useMemo(() => board?.guesses ?? [], [board]);
  const misses = guesses.filter((g) => !g.correct).length;
  const solved = board?.solved ?? false;
  const over = solved || misses >= TRIES;
  const step = over ? TRIES : misses;
  const guessed = useMemo(() => new Set(guesses.map((g) => g.slug)), [guesses]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return picker.filter((b) => b.name.toLowerCase().includes(q) && !guessed.has(b.slug)).slice(0, 6);
  }, [query, picker, guessed]);

  function commit(next: PictureSaved, finished: boolean, won: boolean) {
    setBoard(next);
    savePicture(mode, next);
    onChange?.(next);
    if (finished) {
      const updated = recordResult(loadStats(mode), date, won, next.guesses.length);
      saveStats(mode, updated);
      setStats(updated);
    }
  }

  async function submit(entry: PickerEntry) {
    if (busy || over || !board) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/brawldle/guess?mode=${mode}&brawler=${encodeURIComponent(entry.slug)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(t('Could not check that guess.'));
        return;
      }
      const data = (await res.json()) as { correct: boolean; answer: PictureSaved['answer'] };
      const list = [...board.guesses, { slug: entry.slug, name: entry.name, imageUrl: entry.imageUrl, correct: data.correct }];
      const lost = !data.correct && list.filter((g) => !g.correct).length >= TRIES;
      let answer = data.answer;
      if (lost) {
        answer = await fetch(`/api/brawldle/reveal?mode=${mode}`, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.answer ?? null)
          .catch(() => null);
      }
      if (!data.correct) setShake((n) => n + 1);
      commit({ date, guesses: list, solved: data.correct, answer }, data.correct || lost, data.correct);
      setQuery('');
      inputRef.current?.focus();
    } catch {
      setError(t('Could not reach the server. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (!board) return <div className="card h-96 animate-pulse" aria-hidden />;

  const streak = currentStreak(stats, date);

  return (
    <div className="space-y-4">
      <div className="card relative overflow-hidden p-4">
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${GLOW[mode]}`} />
        <div className="relative flex items-center justify-between">
          <p className="label-game text-sm">
            {mode === 'shadow' ? t('Whose shadow is this?') : t('Who is this, up close?')}
          </p>
          {/* Hearts: what a wrong guess costs, visible before it is spent. */}
          <div className="flex gap-1" aria-label={t('{n} guesses left', { n: TRIES - misses })}>
            {Array.from({ length: TRIES }, (_unused, i) => (
              <span key={i} className={`text-lg leading-none transition-opacity ${i < TRIES - misses ? '' : 'opacity-20 grayscale'}`}>
                ❤️
              </span>
            ))}
          </div>
        </div>
        <div
          key={`${step}-${shake}`}
          className={`relative mx-auto mt-3 aspect-square w-full max-w-[22rem] ${
            over ? 'animate-picture-reveal' : shake ? 'animate-picture-shake' : 'animate-picture-in'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a dynamic API image, not a static asset */}
          <img
            src={`/api/brawldle/picture?mode=${mode}&step=${step}&d=${date}`}
            alt={over && board.answer ? board.answer.name : t('Today’s mystery brawler')}
            className={`size-full object-contain ${mode === 'zoom' ? 'rounded-2xl border-4 border-white/80 shadow-2xl' : 'drop-shadow-[0_0_24px_rgba(167,139,250,0.55)]'}`}
          />
        </div>
        {mode === 'zoom' && !over ? (
          <p className="relative mt-2 text-center text-xs text-muted">{t('Every wrong guess zooms out a little.')}</p>
        ) : null}
      </div>

      {!over ? (
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) submit(matches[0]);
            }}
            placeholder={t('Type a brawler name…')}
            aria-label={t('Guess a brawler')}
            autoComplete="off"
            disabled={busy}
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base outline-none placeholder:text-muted focus:border-brand"
          />
          {matches.length > 0 ? (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
              {matches.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => submit(b)}
                    className="row-interactive flex w-full items-center gap-3 px-3 py-2 text-left"
                  >
                    {b.imageUrl ? (
                      <Image src={b.imageUrl} alt="" width={32} height={32} className="size-8 rounded-md bg-surface-2" unoptimized />
                    ) : (
                      <span className="size-8 rounded-md bg-surface-2" />
                    )}
                    <span className="font-semibold capitalize">{b.name.toLowerCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {guesses.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {guesses.map((g, i) => (
            <span
              key={`${g.slug}-${i}`}
              className={`animate-clue-flip flex items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-3 text-xs font-bold capitalize ${
                g.correct ? 'border-emerald-400/70 bg-emerald-500/20' : 'border-rose-400/50 bg-rose-500/15 line-through decoration-rose-300/70'
              }`}
            >
              {g.imageUrl ? (
                <Image src={g.imageUrl} alt="" width={24} height={24} className="size-6 rounded-full bg-surface-2" unoptimized />
              ) : null}
              {g.name.toLowerCase()}
            </span>
          ))}
        </div>
      ) : null}

      {over ? (
        <div className={`card card-glow overflow-hidden ${solved ? '' : 'border-rose-400/40'}`}>
          <span className={`block h-1 w-full ${solved ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <div className="flex items-center gap-4 p-5">
            {board.answer?.imageUrl ? (
              <Image src={board.answer.imageUrl} alt="" width={56} height={56} className="size-14 rounded-xl bg-surface-2" unoptimized />
            ) : null}
            <div>
              <p className="text-lg font-black">
                {solved
                  ? t('Got it in {length}', { length: guesses.length }) + ' ' + (guesses.length === 1 ? t('guess') : t('guesses')) + '!'
                  : t('Out of guesses.')}
              </p>
              {board.answer ? (
                <p className="text-sm text-muted">
                  {t('It was')} <span className="font-bold capitalize text-foreground">{board.answer.name.toLowerCase()}</span>
                  {streak > 1 ? <> · {t('{n}-day streak', { n: streak })} 🔥</> : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
