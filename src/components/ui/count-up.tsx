'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { compactNumber } from '@/lib/format';

/**
 * A number that counts up to itself when it first comes into view.
 *
 * The rail under the hero is the site's evidence — a hundred and forty
 * thousand battles is the whole claim — and a number that arrives already
 * finished reads as a figure someone typed. Watching it climb reads as a
 * readout.
 *
 * Three things keep that from costing anything:
 *
 * The server renders the *final* value, so the number is correct in the HTML
 * for a crawler, for a reader with JavaScript off, and for the first paint.
 * The ramp is a client-side embellishment on top of a correct document, never
 * the thing that produces it.
 *
 * The drop to zero happens in a layout effect rather than a passive one, which
 * is the difference between a ramp and a flicker: layout effects run after the
 * DOM is updated but *before* the browser paints, so the finished value never
 * reaches the screen ahead of the animation that is supposed to arrive at it.
 *
 * And it only runs once the element is actually on screen, so a figure three
 * screens down has already counted by the time it is scrolled to rather than
 * having quietly finished while nobody was looking.
 */

/** React warns about `useLayoutEffect` during the server pass; it has none. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function CountUp({
  value,
  className,
  duration = 1400,
}: {
  value: number;
  className?: string;
  /** Milliseconds for the whole ramp. */
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  /** null means "show the real value" — the state before and after the ramp. */
  const [shown, setShown] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;

    // Motion for its own sake, which is the one kind this query switches off.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setShown(0);

    let frame = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        // Ease-out cubic: most of the distance early, so it settles rather
        // than stopping dead on the last digit.
        const eased = 1 - (1 - t) ** 3;
        setShown(t < 1 ? Math.round(value * eased) : null);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === 'undefined') {
      run();
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        run();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {compactNumber(shown ?? value)}
    </span>
  );
}
