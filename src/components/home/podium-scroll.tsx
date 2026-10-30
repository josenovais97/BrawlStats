'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** How far through the pinned stretch each place is revealed: #3, #2, #1. */
const BEATS = [0.06, 0.34, 0.62];

/** Gap between places when one fast scroll passes several beats at once. */
const CATCH_UP_MS = 380;

/** The sticky site header the stage pins under (`h-16`, and `top: 4rem` in globals.css). */
const HEADER_PX = 64;

/**
 * The scroll story around the home podium (2026-10-30): the stage holds
 * still while the page scrolls past it, and each stretch of scrolling lights
 * the next place -- third, then second, then first.
 *
 * Every reveal plays whole, once, and stays: scrolling back up shows the
 * finished podium rather than unwinding it, because a scene tied directly to
 * the scroll position left half-lit figures wherever a reader stopped (see
 * scroll-fx.tsx).
 *
 * The podium is complete in the server HTML. It only becomes a scene when
 * this script arms it, and it arms only while the section is still below the
 * screen, so no one ever sees it hide; reduced motion, a page opened scrolled
 * past it, or no JavaScript all get the plain podium at its natural height.
 * Moving focus into it lights everything, so a keyboard never lands on a
 * figure that is still a silhouette.
 *
 * The attributes are set on the DOM directly rather than through state: the
 * podium's markup comes from the server and nothing here needs to render.
 */
export function PodiumScroll({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    const stage = el.firstElementChild as HTMLElement | null;
    // Revealed third place first.
    const slots = [...el.querySelectorAll<HTMLElement>('[data-podium-slot]')].sort(
      (a, b) => Number(b.dataset.rank) - Number(a.dataset.rank),
    );
    if (!stage || slots.length !== BEATS.length) return;
    // A screen too short to hold the whole podium (a phone on its side)
    // keeps it plain: a pinned stage there would cut off its own figures.
    if (stage.offsetHeight > window.innerHeight - HEADER_PX) return;

    el.dataset.armed = '';
    el.dataset.beat = '0';
    let beat = 0;
    let frame = 0;

    const advance = (to: number) => {
      for (let b = beat + 1; b <= to; b++) {
        const slot = slots[b - 1];
        slot.style.setProperty('--lit-delay', `${(b - beat - 1) * CATCH_UP_MS}ms`);
        slot.classList.add('is-lit');
      }
      beat = to;
      el.dataset.beat = String(to);
      if (beat === BEATS.length) stop();
    };

    const update = () => {
      frame = 0;
      const travel = el.offsetHeight - stage.offsetHeight;
      // The stage pins once the track's top reaches the header, not the screen's top.
      const progress = travel > 0 ? (HEADER_PX - el.getBoundingClientRect().top) / travel : 0;
      const next = BEATS.filter((at) => progress >= at).length;
      if (next > beat) advance(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onFocus = () => advance(BEATS.length);

    const stop = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      el.removeEventListener('focusin', onFocus);
      if (frame) cancelAnimationFrame(frame);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    el.addEventListener('focusin', onFocus);
    return stop;
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
