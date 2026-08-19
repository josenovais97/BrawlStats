'use client';

import { ArrowLeftRight, Share2, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Two tag inputs, a swap and a share.
 *
 * The comparison itself is server-rendered at a URL carrying both tags, so
 * this only builds that URL — no fetching, no state to keep, and every
 * comparison stays linkable. Tags are normalised here as well as on the server
 * so the address bar shows the tidy form the user can copy.
 */
export function PlayerCompareForm({
  initialA = '',
  initialB = '',
  recent = [],
}: {
  initialA?: string;
  initialB?: string;
  /** Previously viewed tags, if the browser has any stored. */
  recent?: { tag: string; name?: string }[];
}) {
  const router = useRouter();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [copied, setCopied] = useState(false);

  // Uppercase, strip the hash and the characters Supercell never uses, so
  // "#2v0ul0gqv8" and "2V0UL0GQV8" both work.
  const clean = (value: string) => value.trim().replace(/^#/, '').toUpperCase();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const one = clean(a);
    const two = clean(b);
    if (!one || !two) return;
    router.push(`/compare?player1=${encodeURIComponent(one)}&player2=${encodeURIComponent(two)}`);
  };

  const swap = () => {
    setA(b);
    setB(a);
    const one = clean(b);
    const two = clean(a);
    if (one && two) {
      router.push(`/compare?player1=${encodeURIComponent(one)}&player2=${encodeURIComponent(two)}`);
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

  const field =
    'w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm uppercase outline-none transition-colors focus:border-brand/60';

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      {/* Stacked on a phone, side by side from `sm`: two tag fields plus a
          swap control does not fit on one 320px line without shrinking the
          inputs past usefulness. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="compare-p1" className="mb-1 block text-xs font-medium text-muted">
            Player 1
          </label>
          <input
            id="compare-p1"
            className={field}
            value={a}
            onChange={(event) => setA(event.target.value)}
            placeholder="#2V0UL0GQV8"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <button
          type="button"
          onClick={swap}
          aria-label="Swap the two players"
          title="Swap"
          className="grid h-11 w-11 shrink-0 place-items-center self-center rounded-xl border border-border text-muted transition-colors hover:border-brand/50 hover:text-foreground sm:self-end"
        >
          <ArrowLeftRight className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <label htmlFor="compare-p2" className="mb-1 block text-xs font-medium text-muted">
            Player 2
          </label>
          <input
            id="compare-p2"
            className={field}
            value={b}
            onChange={(event) => setB(event.target.value)}
            placeholder="#V8LLPPC"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Recent:</span>
          {recent.slice(0, 6).map((entry) => (
            <button
              key={entry.tag}
              type="button"
              onClick={() => (a ? setB(entry.tag) : setA(entry.tag))}
              className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium transition-colors hover:text-brand"
            >
              {entry.name ?? `#${entry.tag}`}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!clean(a) || !clean(b)}
          className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink transition-opacity disabled:opacity-40"
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
