'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BrawlerPicker } from '@/components/brawlers/brawler-picker';

/**
 * Two brawler pickers and a button, which is the whole interaction.
 *
 * The comparison itself is a server-rendered page at its own URL, so this only
 * has to build that URL — no state to keep, nothing to fetch, and every
 * comparison stays linkable and indexable rather than living behind a widget.
 *
 * The pickers were native selects until the audit: 107 options each, drawn by
 * the OS rather than by the site, and unsearchable. See `BrawlerPicker`.
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

  return (
    <form
      className="card flex flex-wrap items-center gap-2 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (a && b && a !== b) router.push(`/compare/${a}-vs-${b}`);
      }}
    >
      <BrawlerPicker
        id="compare-a"
        label="First brawler"
        brawlers={brawlers}
        value={a}
        onChange={setA}
        exclude={b}
      />

      <span className="px-1 text-xs font-black uppercase tracking-wide text-muted">vs</span>

      <BrawlerPicker
        id="compare-b"
        label="Second brawler"
        brawlers={brawlers}
        value={b}
        onChange={setB}
        exclude={a}
      />

      {/* Disabled is its own colour, not the live one faded — see the player
          form on the same page for why. */}
      <button
        type="submit"
        disabled={!a || !b || a === b}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors enabled:bg-brand enabled:text-brand-ink enabled:hover:bg-brand-strong disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface-2 disabled:text-muted"
      >
        Compare
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </form>
  );
}
