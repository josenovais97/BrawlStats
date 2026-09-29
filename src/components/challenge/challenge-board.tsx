'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ClassIcon, GadgetIcon, StarPowerIcon } from '@/components/game-icons';
import type { Clue, GuessResult } from '@/lib/brawldle';
import type { PickerEntry } from '@/lib/brawldle-data';
import { TIER_COLOR } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

/**
 * The board.
 *
 * State lives in `localStorage`, keyed by date, so a player can close the tab
 * and come back — and so the puzzle cannot be replayed by refreshing, which is
 * most of what makes a daily a daily. Nothing is stored server-side and there
 * is no account, which is the same bargain the rest of the site makes.
 *
 * Every read and write is wrapped: storage throws in a private window and in
 * some embedded browsers, and a puzzle that refuses to load because it cannot
 * remember is worse than one that forgets.
 */

const VERDICT_CLASS: Record<Clue['verdict'], string> = {
  hit: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-100',
  near: 'bg-amber-400/20 border-amber-300/60 text-amber-100',
  miss: 'bg-rose-500/15 border-rose-400/40 text-rose-100',
};

const ARROW: Record<'up' | 'down', string> = { up: '▲', down: '▼' };

interface Saved {
  date: string;
  results: GuessResult[];
  solved: boolean;
}

function load(date: string): Saved | null {
  try {
    const raw = localStorage.getItem('brawlzone-daily');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Saved;
    return parsed?.date === date ? parsed : null;
  } catch {
    return null;
  }
}

function save(state: Saved) {
  try {
    localStorage.setItem('brawlzone-daily', JSON.stringify(state));
  } catch {
    /* Private window, or storage disabled. The game still plays. */
  }
}

/**
 * One clue.
 *
 * A word alone makes the player do the work: "Fast" means nothing until you
 * remember there are five speeds and that Fast is the fourth. The meter shows
 * that, so the tile answers "how close" at a glance and the word only confirms
 * it. Ordered clues get a meter; rarity and tier also get the game's own
 * colour, so an Epic tile looks Epic.
 */
function ClueTile({ clue, animate, delayMs }: { clue: Clue; animate: boolean; delayMs: number }) {
  const tint =
    clue.key === 'tier' && clue.value in TIER_COLOR
      ? TIER_COLOR[clue.value as Tier]
      : clue.color;

  return (
    <div
      style={animate ? { animationDelay: `${delayMs}ms` } : undefined}
      className={`flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-center ${
        VERDICT_CLASS[clue.verdict]
      } ${animate ? 'animate-clue-flip' : ''}`}
    >
      {/* A real per-class image, not a generic glyph. Returns null for a class
          it has no art for, so the tile falls back to the word alone. */}
      {clue.key === 'class' ? <ClassIcon name={clue.value} className="size-5" /> : null}

      <span
        className="text-[12px] font-bold leading-tight"
        /* The game's own colour, but only as the text: tinting the whole tile
           would fight the green/amber/red, which is the thing the player is
           actually reading. */
        style={tint ? { color: tint } : undefined}
      >
        {clue.value}
      </span>

      {clue.scale ? (
        <span className="flex items-center gap-[3px]" aria-hidden>
          {Array.from({ length: clue.scale.of }, (_unused, n) => (
            <span
              key={n}
              className={`h-1 w-1.5 rounded-full ${
                n <= (clue.scale?.index ?? -1) ? 'bg-current opacity-90' : 'bg-current opacity-25'
              }`}
            />
          ))}
        </span>
      ) : null}

      {clue.direction ? (
        <span
          aria-label={clue.direction === 'up' ? 'higher' : 'lower'}
          className="text-sm leading-none opacity-80"
        >
          {ARROW[clue.direction]}
        </span>
      ) : null}
    </div>
  );
}

interface Hints {
  thresholds: { starPower: number; gadget: number };
  starPower: string | null;
  gadget: string | null;
}

/**
 * Hints, as pictures.
 *
 * The star power at four guesses and the gadget at eight, drawn from the game
 * itself. Names are never fetched: "Come To Papa" is searchable and would end
 * the puzzle, where the icon is a memory test — which is what a hint is for.
 */
function HintPanel({ hints, guesses }: { hints: Hints | null; guesses: number }) {
  if (!hints) return null;
  const rows = [
    { key: 'sp', at: hints.thresholds.starPower, url: hints.starPower, label: 'Star power', Icon: StarPowerIcon },
    { key: 'gd', at: hints.thresholds.gadget, url: hints.gadget, label: 'Gadget', Icon: GadgetIcon },
  ];

  return (
    <div className="card flex flex-wrap items-center gap-4 p-4">
      {rows.map(({ key, at, url, label, Icon }) => {
        const left = at - guesses;
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface-2">
              {url ? (
                <Image src={url} alt={label} width={40} height={40} className="size-10" unoptimized />
              ) : (
                <Icon className="size-5 opacity-30" />
              )}
            </div>
            <div className="text-xs leading-tight">
              <p className="font-semibold">{label}</p>
              <p className="text-muted">
                {url ? 'Revealed' : `in ${left} ${left === 1 ? 'guess' : 'guesses'}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChallengeBoard({ date, picker }: { date: string; picker: PickerEntry[] }) {
  /*
   * One state object, hydrated once. `board === null` means localStorage has
   * not been read yet, which is a third state distinct from "no guesses" --
   * without it a solved board flashes empty on every load.
   */
  const [board, setBoard] = useState<Saved | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hints, setHints] = useState<Hints | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * Read on mount rather than during render.
   *
   * localStorage does not exist on the server, so reading it in the render
   * body would make the server and the first client render disagree and
   * produce a hydration mismatch. An effect is the supported way to sync from
   * a browser-only store, which is what this is.
   *
   * eslint-disable below: the rule warns about cascading renders from setState
   * in an effect, which is aimed at state derivable from props. This is a
   * one-shot hydration from an external store and runs once per date.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBoard(load(date) ?? { date, results: [], solved: false });
  }, [date]);

  // Memoised so the `??` does not hand useMemo a fresh array every render.
  const results = useMemo(() => board?.results ?? [], [board]);
  const solved = board?.solved ?? false;
  const ready = board !== null;

  /*
   * Hints are asked for by guess count, so this refires as the count changes
   * and a hint appears the moment it is earned. The endpoint returns the
   * thresholds even when nothing is unlocked, which is what lets the panel say
   * "in 3 guesses" rather than hiding until it has something.
   */
  useEffect(() => {
    if (!ready || solved) return;
    let cancelled = false;
    fetch(`/api/brawldle/hint?after=${results.length}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Hints | null) => {
        if (!cancelled && data) setHints(data);
      })
      .catch(() => {
        /* A missing hint panel is not worth an error message. */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, solved, results.length]);

  const guessed = useMemo(() => new Set(results.map((r) => r.brawler.slug)), [results]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return picker
      .filter((b) => b.name.toLowerCase().includes(q) && !guessed.has(b.slug))
      .slice(0, 6);
  }, [query, picker, guessed]);

  async function submit(slug: string) {
    if (busy || solved) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/brawldle/guess?brawler=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(res.status === 404 ? 'That is not a current brawler.' : 'Could not check that guess.');
        return;
      }
      const data = (await res.json()) as GuessResult & { correct: boolean };
      const next: Saved = {
        date,
        results: [...results, data],
        solved: data.correct || solved,
      };
      setBoard(next);
      save(next);
      setQuery('');
      inputRef.current?.focus();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function share() {
    const square: Record<Clue['verdict'], string> = { hit: '🟩', near: '🟨', miss: '🟥' };
    const rows = results.map((r) => r.clues.map((c) => square[c.verdict]).join(''));
    const text = [
      `BrawlZone Daily ${date} — ${solved ? `${results.length}/∞` : 'X'}`,
      ...rows,
      'brawlzone.net/daily-challenge',
    ].join('\n');
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setError('Could not copy. Select the grid and copy it by hand.'),
    );
  }

  // Nothing until localStorage has been read, or a solved board flashes as
  // empty on every load.
  if (!ready) {
    return <div className="card h-40 animate-pulse" aria-hidden />;
  }

  return (
    <div className="space-y-4">
      {!solved ? (
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) submit(matches[0].slug);
            }}
            placeholder="Type a brawler name…"
            aria-label="Guess a brawler"
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
                    onClick={() => submit(b.slug)}
                    className="row-interactive flex w-full items-center gap-3 px-3 py-2 text-left"
                  >
                    {b.imageUrl ? (
                      <Image
                        src={b.imageUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 rounded-md bg-surface-2"
                        unoptimized
                      />
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

      {!solved && results.length > 0 ? (
        <HintPanel hints={hints} guesses={results.length} />
      ) : null}

      {results.length > 0 ? (
        /* Seven columns do not fit a phone at a readable size, and shrinking
           the type until "Very Fast" fits is how a board becomes unreadable.
           It scrolls sideways instead. */
        <div className="-mx-4 space-y-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {/* Column headings once, so five labels are not repeated on every row */}
          <div className="grid min-w-[620px] grid-cols-[3rem_repeat(7,1fr)] gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <span />
            <span className="text-center">Rarity</span>
            <span className="text-center">Class</span>
            <span className="text-center">Movement</span>
            <span className="text-center">Range</span>
            <span className="text-center">Reload</span>
            <span className="text-center">Released</span>
            <span className="text-center">Tier</span>
          </div>

          {[...results].reverse().map((r, i) => (
            <div
              key={`${r.brawler.slug}-${i}`}
              className="grid min-w-[620px] grid-cols-[3rem_repeat(7,1fr)] items-stretch gap-1.5"
            >
              <div className="flex items-center justify-center">
                {r.brawler.imageUrl ? (
                  <Image
                    src={r.brawler.imageUrl}
                    alt={r.brawler.name}
                    width={40}
                    height={40}
                    className="size-10 rounded-lg bg-surface-2"
                    unoptimized
                  />
                ) : null}
              </div>
              {r.clues.map((c, col) => (
                <ClueTile key={c.key} clue={c} animate={i === 0} delayMs={col * 90} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="card p-4 text-sm leading-relaxed text-muted">
          Guess today&rsquo;s brawler. Each guess shows how close you are on five clues — green is
          exact, amber is one step away, and an arrow points toward the answer.
        </p>
      )}

      {solved ? (
        <div className="card card-glow overflow-hidden">
          <span className="block h-1 w-full bg-emerald-400" />
          <div className="space-y-3 p-5">
            <p className="text-lg font-black">
              Got it in {results.length} {results.length === 1 ? 'guess' : 'guesses'}.
            </p>
            <p className="text-sm text-muted">A new brawler at midnight UTC.</p>
            <button
              type="button"
              onClick={share}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-[#0b0f1d] transition-opacity hover:opacity-90"
            >
              {copied ? 'Copied' : 'Copy result'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
