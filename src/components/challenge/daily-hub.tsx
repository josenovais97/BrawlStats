'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ChallengeBoard } from '@/components/challenge/challenge-board';
import { PictureBoard, type PictureMode, type PictureSaved, TRIES, loadPicture } from '@/components/challenge/picture-board';
import { useT } from '@/components/i18n/use-t';
import type { PickerEntry } from '@/lib/brawldle-data';
import { formatCountdown, msUntilReset } from '@/lib/brawldle-stats';
import { type DayTally, TALLY_MIN_PLAYERS } from '@/lib/brawldle-tally';

/**
 * Three puzzles a day (2026-10-22): the classic clue board, Shadow and Zoom.
 *
 * One puzzle was over in a minute and gave nobody a reason to stay; three make
 * a short daily habit, and one share card for all three is what gets posted in
 * a group chat. Each board keeps its own state in this browser; the hub only
 * reads where each one stands, for the tabs and the share card.
 *
 * It also reports each finished puzzle to /api/brawldle/tally (2026-10-23) and
 * shows how everybody else did, so "solved in 3" becomes "solved in 3, when
 * only 38% got it at all".
 */

type Mode = 'classic' | PictureMode;

interface Status {
  done: boolean;
  solved: boolean;
  guesses: number;
}

const NONE: Status = { done: false, solved: false, guesses: 0 };
const MODES: { key: Mode; icon: string; label: string }[] = [
  { key: 'classic', icon: '🧩', label: 'Classic' },
  { key: 'shadow', icon: '👤', label: 'Shadow' },
  { key: 'zoom', icon: '🔍', label: 'Zoom' },
];
/** The first daily puzzle went up on 2026-10-02: that is #1. */
const FIRST_DAY = Date.UTC(2026, 9, 1);

function classicStatus(date: string): Status {
  try {
    const s = JSON.parse(localStorage.getItem('brawlzone-daily') ?? 'null') as { date: string; results: unknown[]; solved: boolean } | null;
    if (s?.date !== date) return NONE;
    return { done: s.solved, solved: s.solved, guesses: s.results.length };
  } catch {
    return NONE;
  }
}

function pictureStatus(saved: PictureSaved | null): Status {
  if (!saved) return NONE;
  const misses = saved.guesses.filter((g) => !g.correct).length;
  return { done: saved.solved || misses >= TRIES, solved: saved.solved, guesses: saved.guesses.length };
}

/** A burst of confetti over the page, once per solve. */
function Confetti({ burst }: { burst: number }) {
  if (burst === 0) return null;
  const colors = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#ffffff', '#fb923c'];
  return (
    <div key={burst} className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {Array.from({ length: 60 }, (_unused, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-[-5%] block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 12) * 40}ms`,
            animationDuration: `${1400 + ((i * 53) % 900)}ms`,
            ['--drift' as string]: `${((i * 29) % 160) - 80}px`,
            ['--spin' as string]: `${((i * 71) % 720) - 360}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function DailyHub({ date, picker }: { date: string; picker: PickerEntry[] }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('classic');
  const [status, setStatus] = useState<Record<Mode, Status> | null>(null);
  const [burst, setBurst] = useState(0);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [tally, setTally] = useState<DayTally | null>(null);

  const loadTally = useCallback(() => {
    fetch('/api/brawldle/tally', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { date: string; tally: DayTally } | null) => {
        if (d?.date === date) setTally(d.tally);
      })
      .catch(() => {});
  }, [date]);
  useEffect(loadTally, [loadTally]);

  useEffect(() => {
    const read = {
      classic: classicStatus(date),
      shadow: pictureStatus(loadPicture('shadow', date)),
      zoom: pictureStatus(loadPicture('zoom', date)),
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of browser storage
    setStatus(read);
    // Open on the first puzzle not finished yet, so a returning player lands
    // where they left off.
    const next = MODES.find((m) => !read[m.key].done);
    if (next) setMode(next.key);
  }, [date]);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilReset(new Date())));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Read through a ref so `update` stays stable for the boards' callbacks.
  const current = useRef(status);
  useEffect(() => {
    current.current = status;
  }, [status]);
  const update = useCallback((key: Mode, next: Status) => {
    const before = current.current?.[key] ?? NONE;
    if (next.solved && !before.solved) setBurst((n) => n + 1);
    // Counted once, on the guess that finishes the puzzle; a reload reads the
    // finished board from storage and never comes through here.
    if (next.done && !before.done) {
      fetch('/api/brawldle/tally', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: key, solved: next.solved, guesses: next.guesses }),
      })
        .then(loadTally, () => {});
    }
    setStatus((prev) => ({ ...(prev ?? { classic: NONE, shadow: NONE, zoom: NONE }), [key]: next }));
  }, [loadTally]);

  const number = Math.floor((Date.parse(`${date}T00:00:00Z`) - FIRST_DAY) / 86_400_000);
  const finished = status ? MODES.filter((m) => status[m.key].done).length : 0;
  const crowd = tally?.[mode];
  const crowdLabel = MODES.find((m) => m.key === mode)?.label ?? '';

  function shareText() {
    const line = (m: (typeof MODES)[number]) => {
      const s = status?.[m.key] ?? NONE;
      if (!s.done) return `${m.icon} ${t(m.label)}: —`;
      if (m.key === 'classic') return `${m.icon} ${t(m.label)}: ${s.guesses} ${s.guesses === 1 ? t('guess') : t('guesses')}`;
      const misses = s.solved ? s.guesses - 1 : TRIES;
      const squares = '🟥'.repeat(misses) + (s.solved ? '🟩' : '');
      return `${m.icon} ${t(m.label)}: ${s.solved ? `${s.guesses}/${TRIES}` : `X/${TRIES}`} ${squares}`;
    };
    return [`BrawlZone Daily #${number} 🎯`, ...MODES.map(line), 'brawlzone.net/daily-challenge'].join('\n');
  }

  async function share() {
    const text = shareText();
    // The phone's own share sheet first: that is WhatsApp, in one tap.
    if (typeof navigator !== 'undefined' && navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* Dismissed: fall through to the clipboard. */
      }
    }
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  }

  return (
    <div className="space-y-4">
      <Confetti burst={burst} />

      <div className="grid grid-cols-3 gap-2" role="tablist">
        {MODES.map((m) => {
          const s = status?.[m.key] ?? NONE;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.key)}
              className={`card flex flex-col items-center gap-1 px-2 py-3 transition-transform ${
                active ? 'scale-[1.03] border-brand ring-2 ring-brand/40' : 'opacity-80 hover:opacity-100'
              }`}
            >
              <span className="text-2xl leading-none">{m.icon}</span>
              <span className="text-sm font-black">{t(m.label)}</span>
              <span className={`text-[11px] font-semibold ${s.solved ? 'text-emerald-300' : s.done ? 'text-rose-300' : 'text-muted'}`}>
                {s.solved ? `✓ ${s.guesses}` : s.done ? '✗' : s.guesses > 0 ? t('playing') : t('new')}
              </span>
            </button>
          );
        })}
      </div>

      {crowd && crowd.players >= TALLY_MIN_PLAYERS ? (
        <p className="animate-picture-in text-center text-sm text-muted">
          {mode === 'classic' ? (
            <>
              👥 {t('{n} players solved today’s Classic', { n: crowd.solved })}
              {crowd.average !== null ? <> · {t('average {n} guesses', { n: crowd.average })}</> : null}
            </>
          ) : (
            <>
              👥{' '}
              {t('{pct}% of players solved today’s {mode}', {
                pct: Math.round((crowd.solved / crowd.players) * 100),
                mode: t(crowdLabel),
              })}
              {status?.[mode]?.done && crowd.average !== null ? <> · {t('average {n} guesses', { n: crowd.average })}</> : null}
            </>
          )}
        </p>
      ) : null}

      <div className={mode === 'classic' ? '' : 'hidden'}>
        <ChallengeBoard
          date={date}
          picker={picker}
          onChange={(s) => update('classic', { done: s.solved, solved: s.solved, guesses: s.guesses })}
          onShare={share}
        />
      </div>
      {(['shadow', 'zoom'] as const).map((m) => (
        <div key={m} className={mode === m ? '' : 'hidden'}>
          <PictureBoard mode={m} date={date} picker={picker} onChange={(saved) => update(m, pictureStatus(saved))} />
        </div>
      ))}

      {finished > 0 ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-black">
              {finished === 3 ? t('All three done!') : t('{n} of 3 done', { n: finished })}
            </p>
            <p className="text-xs text-muted">
              {t('New puzzles in')} <span className="font-bold tabular-nums text-foreground">{countdown ?? '—'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={share}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-[#0b0f1d] transition-opacity hover:opacity-90"
          >
            {copied ? t('Copied') : t('Share your results')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
