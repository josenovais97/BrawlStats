'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Entrance animations for the whole site, in the game's motion (2026-10-30).
 *
 * Each element plays its whole animation once, the moment it comes into
 * view: headings slam in, panels pop up and settle, tier badges are stamped
 * on, the home page's event tiles are dealt like cards, lists cascade. The
 * first version was tied to the scroll position itself, so anything a reader
 * stopped on sat half-faded and tilted, and scrolling back up undid it; the
 * owner called that buggy, and it was.
 *
 * What it never does: hide something that was already on screen when the
 * page opened (no flash, and no delay to the largest paint Google measures),
 * run for anyone who asked for reduced motion, or run in the Bubble panel
 * inside the Android app. Without this script everything is simply visible:
 * the hiding rule only applies once `fx-ready` is on <html>.
 *
 * Elements are found by selector, so every page gets the same treatment
 * without each one opting in; `data-fx="<kind>"` picks a kind by hand,
 * `data-fx-cascade` on a list animates its children, `data-fx-off` opts a
 * subtree out.
 */
const AUTO: [string, string][] = [
  ['main h1.display, main h2.display', 'slam'],
  ['main .card, main .reward-tile', 'pop'],
  ['main .tier-badge', 'stamp'],
  ['main [data-fx-cascade] > *', 'rise'],
];

/** Kinds that should land a beat after the panel they sit on. */
const LATE: Record<string, number> = { stamp: 260 };

const STEP_MS = 70;
const MAX_STEPS = 7;

export function ScrollFx() {
  const path = usePathname() ?? '/';

  useEffect(() => {
    if (/^\/(?:es\/|pt\/)?bubble\/(?:panel|test)/.test(path)) return;
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    root.classList.add('fx-ready');
    const seen = new WeakSet<Element>();
    // Opening: what is on screen shows as it is. Streaming: sections arriving
    // after the first paint animate in. After that, anything new (a tool
    // re-rendering as it is used -- the tier maker, the draft) just shows:
    // an entrance on every tap would be noise, not motion.
    let phase: 'opening' | 'streaming' | 'settled' = 'opening';

    const io = new IntersectionObserver(
      (entries) => {
        let step = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const kind = el.dataset.fx ?? '';
          el.style.setProperty('--fx-delay', `${Math.min(step, MAX_STEPS) * STEP_MS + (LATE[kind] ?? 0)}ms`);
          el.classList.add('fx-in');
          io.unobserve(el);
          step++;
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.12 },
    );

    const take = (el: Element, kind: string) => {
      if (seen.has(el) || el.closest('[data-fx-off]')) return;
      seen.add(el);
      if (!(el as HTMLElement).dataset.fx) (el as HTMLElement).dataset.fx = kind;
      if (phase === 'settled') {
        el.classList.add('fx-in', 'fx-instant');
        return;
      }
      const box = el.getBoundingClientRect();
      // Already on screen as the page opens: shown as it is, never hidden.
      if (phase === 'opening' && box.top < window.innerHeight && box.bottom > 0) {
        el.classList.add('fx-in', 'fx-instant');
        return;
      }
      io.observe(el);
    };

    const scan = () => {
      document.querySelectorAll('[data-fx]').forEach((el) => take(el, (el as HTMLElement).dataset.fx ?? 'pop'));
      for (const [selector, kind] of AUTO) document.querySelectorAll(selector).forEach((el) => take(el, kind));
    };

    scan();
    const stream = window.setTimeout(() => {
      phase = 'streaming';
    }, 400);
    const settle = window.setTimeout(() => {
      phase = 'settled';
    }, 3000);
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    });
    mo.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(stream);
      window.clearTimeout(settle);
      mo.disconnect();
      io.disconnect();
    };
  }, [path]);

  return null;
}
