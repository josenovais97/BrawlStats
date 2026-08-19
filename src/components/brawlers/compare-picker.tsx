'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Two selects and a button, which is the whole interaction.
 *
 * The comparison itself is a server-rendered page at its own URL, so this only
 * has to build that URL — no state to keep, nothing to fetch, and every
 * comparison stays linkable and indexable rather than living behind a widget.
 */
export function ComparePicker({
  brawlers,
  initialA,
  initialB,
}: {
  brawlers: { slug: string; name: string }[];
  initialA?: string;
  initialB?: string;
}) {
  const router = useRouter();
  const [a, setA] = useState(initialA ?? brawlers[0]?.slug ?? '');
  const [b, setB] = useState(initialB ?? brawlers[1]?.slug ?? '');

  const select =
    'min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm font-semibold capitalize text-foreground';

  return (
    <form
      className="card flex flex-wrap items-center gap-2 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (a && b && a !== b) router.push(`/compare/${a}-vs-${b}`);
      }}
    >
      <label className="sr-only" htmlFor="compare-a">
        First brawler
      </label>
      <select
        id="compare-a"
        className={select}
        value={a}
        onChange={(event) => setA(event.target.value)}
      >
        {brawlers.map((brawler) => (
          <option key={brawler.slug} value={brawler.slug}>
            {brawler.name.toLowerCase()}
          </option>
        ))}
      </select>

      <span className="px-1 text-xs font-black uppercase tracking-wide text-muted">vs</span>

      <label className="sr-only" htmlFor="compare-b">
        Second brawler
      </label>
      <select
        id="compare-b"
        className={select}
        value={b}
        onChange={(event) => setB(event.target.value)}
      >
        {brawlers.map((brawler) => (
          <option key={brawler.slug} value={brawler.slug}>
            {brawler.name.toLowerCase()}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={!a || !b || a === b}
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-ink transition-opacity disabled:opacity-40"
      >
        Compare
        <ArrowRight className="size-4" />
      </button>
    </form>
  );
}
