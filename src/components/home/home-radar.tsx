'use client';

import { Share2, Check } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { DiscoveryCard } from '@/components/daily/discovery-card';
import type { Discovery } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/**
 * The day's findings, on the landing page.
 *
 * These were four screens down on `/daily`, which is the same mistake
 * `HomeSplit` documents: the one thing on this site a competitor cannot copy
 * was the one thing a bouncing visitor never saw. A tier list is a table
 * anyone can build from the same API. "Almost nobody picks Nita. It is winning
 * anyway." is a claim only this project's own sampling can make, and it is the
 * kind of thing people repeat to each other.
 *
 * One at a time rather than a grid of six. A grid of six surprising claims is
 * not six times as surprising — the eye picks one and skims the rest — and at
 * this width six cards would push everything else off the page.
 *
 * It advances on its own because a card that never changes stops being read
 * after the first visit. It stops advancing the moment anyone touches it,
 * hovers it, or tabs into it, because a panel that moves under a reader who is
 * mid-sentence is worse than one that never moves at all. Under
 * `prefers-reduced-motion` it never advances by itself.
 */

/** Long enough to read a two-line claim without hurrying. */
const DWELL_MS = 8000;

export function HomeRadar({
  discoveries,
  brawlerMeta,
}: {
  discoveries: Discovery[];
  brawlerMeta: Map<number, BABrawler>;
}) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [copied, setCopied] = useState(false);

  const count = discoveries.length;

  useEffect(() => {
    if (held || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => setIndex((i) => (i + 1) % count), DWELL_MS);
    return () => clearInterval(timer);
  }, [held, count]);

  const current = discoveries[Math.min(index, count - 1)];

  /*
   * Share the discovery, not the page.
   *
   * `navigator.share` on a phone opens the sheet people already use to send
   * things to a club chat, which is where this kind of claim actually travels.
   * Everywhere else it falls back to the clipboard, and the button says so
   * rather than appearing to do nothing.
   */
  const share = useCallback(async () => {
    if (!current) return;
    const url = new URL(current.href, window.location.origin).toString();
    const text = `${headlineFor(current)} — BrawlZone`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'BrawlZone', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The sheet was dismissed, or the clipboard is blocked. Neither is worth
      // interrupting the page for.
    }
  }, [current]);

  if (count === 0) return null;

  return (
    <section
      aria-labelledby="radar"
      className="reveal"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      onTouchStart={() => setHeld(true)}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2.5">
            <span aria-hidden className="rule h-4" />
            <span className="eyebrow flex items-center gap-2 text-accent-2">
              <span className="live-dot" />
              Discovered today
            </span>
          </p>
          <h2 id="radar" className="display mt-2.5 text-2xl uppercase sm:text-4xl">
            BrawlZone Radar
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Things our own sampling turned up that no tier list would tell you.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-semibold transition-colors hover:border-brand/50"
          >
            {copied ? <Check className="size-4 text-victory" /> : <Share2 className="size-4" />}
            {copied ? 'Copied' : 'Share'}
          </button>
          <Link
            href="/daily"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-semibold transition-colors hover:border-brand/50"
          >
            All findings
          </Link>
        </div>
      </div>

      {/* Keyed so the card remounts and its entrance animation replays; without
          it the numbers swap in place and the change is easy to miss. */}
      <DiscoveryCard
        key={current.kind + current.brawlerIds.join('-')}
        discovery={current}
        brawlerMeta={brawlerMeta}
        index={0}
      />

      {count > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {discoveries.map((d, i) => (
            <button
              key={d.kind + d.brawlerIds.join('-')}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Finding ${i + 1} of ${count}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-brand' : 'w-1.5 bg-border-strong hover:bg-muted'
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * A one-line version of the card's own headline, for the share text.
 *
 * Deliberately not imported from the card's copy table: that table renders
 * JSX-adjacent strings for a card that has the numbers beside it, and a link
 * pasted into a chat has none of that context. This says the finding and the
 * brawler, which is what makes someone tap.
 */
function headlineFor(d: Discovery): string {
  const [a, b] = d.brawlerNames.map((n) => n.charAt(0) + n.slice(1).toLowerCase());
  switch (d.kind) {
    case 'secret-pick':
      return `Almost nobody picks ${a}. It is winning anyway.`;
    case 'meta-trap':
      return `${a} is picked constantly and losing.`;
    case 'giant-killer':
      return `${a} owns ${b}.`;
    case 'secret-duo':
      return `${a} and ${b} belong together.`;
    case 'map-surprise':
      return `${a} is a different brawler on ${d.context ?? 'this map'}.`;
    case 'overnight-rise':
      return `${a} climbed overnight.`;
  }
}
