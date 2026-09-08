'use client';

import { Share2, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

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
 *
 * And it is *driveable*: arrows, swipe and arrow keys, not only dots. A card
 * that changes by itself and offers no way to go back is a trap — see a
 * finding out of the corner of your eye, look up, and it is gone with no
 * affordance for retrieving it. The dots were technically enough (six targets,
 * any of them reachable) but they read as an indicator rather than a control,
 * so nobody uses them to go back one.
 */

/** Long enough to read a two-line claim without hurrying. */
const DWELL_MS = 8000;

/**
 * How far a touch has to travel sideways to count as a swipe.
 *
 * Paired with a ratio test against the vertical distance, because this sits in
 * a scrolling page: a finger dragged down through the card moves a few pixels
 * horizontally on the way, and without the ratio every scroll past the Radar
 * would change the card under the reader.
 */
const SWIPE_PX = 48;
const SWIPE_RATIO = 1.5;

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
  /**
   * Set once, never cleared. Hovering is ambiguous — a cursor can rest on a
   * section by accident — so it only pauses. Choosing a card is not ambiguous,
   * and resuming the carousel under someone who has just steered it is the
   * rudest thing this component could do.
   */
  const [steered, setSteered] = useState(false);
  /** Which way the last move went, so the card enters from the right side. */
  const [dir, setDir] = useState<1 | -1>(1);

  const count = discoveries.length;

  const go = useCallback(
    (delta: 1 | -1) => {
      setSteered(true);
      setDir(delta);
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  // Direction of travel, so the slide matches the dot that was clicked rather
  // than always sliding forward.
  const jump = useCallback(
    (to: number) => {
      setSteered(true);
      setDir(to >= index ? 1 : -1);
      setIndex(to);
    },
    [index],
  );

  useEffect(() => {
    if (held || steered || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => {
      setDir(1);
      setIndex((i) => (i + 1) % count);
    }, DWELL_MS);
    return () => clearInterval(timer);
  }, [held, steered, count]);

  const current = discoveries[Math.min(index, count - 1)];

  const touch = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setHeld(true);
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touch.current;
      touch.current = null;
      if (!start || count < 2) return;

      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;

      // Content follows the finger: dragging left brings the next card in.
      go(dx < 0 ? 1 : -1);
    },
    [count, go],
  );

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
      aria-roledescription="carousel"
      className="reveal"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        touch.current = null;
      }}
      /*
       * Arrow keys work wherever focus already is inside the section, which for
       * a keyboard reader is the arrow buttons or the card's own link. Nothing
       * in here takes typed input, so there is nothing to steal them from.
       */
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(-1);
        }
      }}
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

      {/* Keyed so the wrapper remounts and the slide replays; without it the
          numbers swap in place and the change is easy to miss. The key carries
          the direction, so going back slides back — a card that always enters
          from the right after a "previous" makes the control feel broken.
          `touch-pan-y` leaves vertical scrolling to the browser and claims only
          the horizontal axis for the swipe handler. */}
      <div
        key={`${dir}:${current.kind}${current.brawlerIds.join('-')}`}
        data-dir={dir}
        className="radar-slide touch-pan-y"
      >
        <DiscoveryCard discovery={current} brawlerMeta={brawlerMeta} index={0} />
      </div>

      {count > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous finding"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-brand/50 hover:text-fg"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="flex items-center gap-2">
            {discoveries.map((d, i) => (
              <button
                key={d.kind + d.brawlerIds.join('-')}
                type="button"
                onClick={() => jump(i)}
                aria-label={`Finding ${i + 1} of ${count}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-brand' : 'w-1.5 bg-border-strong hover:bg-muted'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next finding"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-brand/50 hover:text-fg"
          >
            <ChevronRight className="size-4" />
          </button>
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
