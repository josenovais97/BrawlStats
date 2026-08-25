'use client';

import { ArrowLeftRight, Check, Clock, Share2, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useId, useState, useSyncExternalStore } from 'react';

import { PlayersIcon } from '@/components/game-icons';
import { playerIconUrl } from '@/lib/brawlapi';
import {
  clearRecentSearches,
  readRecentSearches,
  serverRecentSearches,
  subscribeRecentSearches,
  type RecentSearch,
} from '@/lib/recent-searches';

/**
 * Two tag inputs, fed by the profiles this device has already looked at.
 *
 * The comparison itself is server-rendered at a URL carrying both tags, so
 * this only builds that URL — no fetching, no state to keep, and every
 * comparison stays linkable. Tags are normalised here as well as on the server
 * so the address bar shows the tidy form the user can copy.
 *
 * The recent list is the site's own `brawlstats:recent-searches` store, the
 * same one the header search and the homepage read, rather than a private copy
 * in a second format: a tag looked up anywhere on the site is offered here,
 * and clearing it anywhere clears it here.
 */

/** Enough to cover "me and the people I actually check", short enough to scan. */
const RECENT_SHOWN = 6;

export function PlayerCompareForm({
  initialA = '',
  initialB = '',
}: {
  initialA?: string;
  initialB?: string;
}) {
  const router = useRouter();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [copied, setCopied] = useState(false);
  const fieldA = useId();
  const fieldB = useId();

  const stored = useSyncExternalStore(
    subscribeRecentSearches,
    readRecentSearches,
    serverRecentSearches,
  );
  // Clubs live in the same store and are not comparable here.
  const recent = stored.filter((entry) => entry.kind === 'player').slice(0, RECENT_SHOWN);

  // Uppercase, strip the hash, so "#2v0ul0gqv8" and "2V0UL0GQV8" both work.
  const clean = (value: string) => value.trim().replace(/^#/, '').toUpperCase();
  const one = clean(a);
  const two = clean(b);

  // A path, not a query string: the pairing is its own route so that the tool
  // page it navigates from can stay static. See `/compare/players/[a]/[b]`.
  const go = (first: string, second: string) => {
    router.push(
      `/compare/players/${encodeURIComponent(first)}/${encodeURIComponent(second)}`,
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!one || !two) return;
    go(one, two);
  };

  const swap = () => {
    setA(b);
    setB(a);
    if (one && two) go(two, one);
  };

  /** Assigning a profile already on the other side would compare it to itself. */
  const pick = (side: 'a' | 'b', entry: RecentSearch) => {
    if (side === 'a') {
      if (clean(b) === entry.tag) setB('');
      setA(entry.tag);
    } else {
      if (clean(a) === entry.tag) setA('');
      setB(entry.tag);
    }
  };

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Brawl Stars player comparison', url });
        return;
      } catch {
        // Cancelling the sheet rejects; fall through so the click still does
        // something rather than appearing broken.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be refused outright; the button then does
      // nothing rather than throwing an error up for a non-essential action.
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      {/* Stacked on a phone, side by side from `sm`: two tag fields plus a
          swap control does not fit on one 320px line without shrinking the
          inputs past usefulness. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Side
          id={fieldA}
          label="Player 1"
          value={a}
          onChange={setA}
          placeholder="#2V0UL0GQV8"
          recent={recent}
          selected={one}
          otherSelected={two}
          onPick={(entry) => pick('a', entry)}
        />

        {/* Labelled where there is room for a label. In the stacked phone
            layout an unlabelled 44px square between two fields is a guess. */}
        <button
          type="button"
          onClick={swap}
          disabled={!one && !two}
          aria-label="Swap the two players"
          title="Swap players"
          className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-muted transition-colors enabled:hover:border-brand/50 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:text-muted/45 sm:mt-6 sm:w-11 sm:self-start"
        >
          <ArrowLeftRight className="size-4" />
          <span className="sm:hidden">Swap players</span>
        </button>

        <Side
          id={fieldB}
          label="Player 2"
          value={b}
          onChange={setB}
          placeholder="#V8LLPPC"
          recent={recent}
          selected={two}
          otherSelected={one}
          onPick={(entry) => pick('b', entry)}
        />
      </div>

      {recent.length === 0 ? (
        /* Says how the list fills up rather than showing an empty box. */
        <p className="rounded-lg bg-surface-2/60 px-3 py-2.5 text-xs leading-relaxed text-muted">
          Look a player up from the search box and they are remembered on this device,
          ready to pick here without typing the tag again. Nothing is sent to the
          server.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock aria-hidden className="size-3.5" />
            Looked up on this device
          </p>
          <button
            type="button"
            onClick={clearRecentSearches}
            className="min-h-9 rounded-lg px-2 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          >
            Clear recent
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/*
          The disabled state is its own set of colours, not the live one faded.
          `bg-brand` at 40% over a dark surface resolves to a muddy olive that
          is in no palette on the site — as the widest object on the page it
          read as a rendering fault rather than as a control waiting for input.
        */}
        <button
          type="submit"
          disabled={!one || !two}
          className="min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition-colors enabled:bg-brand enabled:text-brand-ink enabled:hover:bg-brand-strong disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface-2 disabled:text-muted"
        >
          Compare
        </button>

        {initialA && initialB ? (
          <>
            <button
              type="button"
              onClick={share}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
            >
              {copied ? (
                <Check className="size-4 text-victory" />
              ) : (
                <Share2 className="size-4" />
              )}
              {copied ? 'Copied' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => {
                setA('');
                setB('');
                router.push('/compare');
              }}
              aria-label="Clear the comparison"
              className="grid min-h-11 w-11 place-items-center rounded-xl border border-border text-muted transition-colors hover:border-defeat/50 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}

/** One half of the comparison: a tag field with its own recent list under it. */
function Side({
  id,
  label,
  value,
  onChange,
  placeholder,
  recent,
  selected,
  otherSelected,
  onPick,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  recent: RecentSearch[];
  /** Normalised tag currently in this field. */
  selected: string;
  /** Normalised tag on the other side, which cannot be picked twice. */
  otherSelected: string;
  onPick: (entry: RecentSearch) => void;
}) {
  const chosen = recent.find((entry) => entry.tag === selected);

  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 pr-9 font-mono text-sm uppercase outline-none transition-colors focus:border-brand/60"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={chosen ? `${id}-name` : undefined}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Names the tag once it matches something known, so the field is not
          eight characters of hex with no confirmation attached. */}
      {chosen?.name ? (
        <p id={`${id}-name`} className="mt-1 truncate text-xs font-semibold text-brand">
          {chosen.name}
        </p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
          {recent.map((entry) => {
            const isSelected = entry.tag === selected;
            const onOtherSide = entry.tag === otherSelected;
            return (
              <li key={entry.tag}>
                <button
                  type="button"
                  onClick={() => onPick(entry)}
                  aria-pressed={isSelected}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    isSelected
                      ? 'border-brand/60 bg-brand/10'
                      : 'border-transparent hover:border-border hover:bg-surface-2'
                  }`}
                >
                  {entry.icon ? (
                    <Image
                      src={playerIconUrl(entry.icon)}
                      alt=""
                      width={28}
                      height={28}
                      className="size-7 shrink-0 rounded-md bg-surface-2"
                      loading="lazy"
                      unoptimized
                    />
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
                      <PlayersIcon className="size-4" />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {entry.name || `#${entry.tag}`}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted">
                      #{entry.tag}
                    </span>
                  </span>

                  {/* Both states are worth showing: one says "this is the
                      choice", the other says "picking it moves it here". */}
                  {isSelected ? (
                    <Check aria-hidden className="size-4 shrink-0 text-brand" />
                  ) : onOtherSide ? (
                    <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-xs font-semibold text-muted">
                      Other side
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
