'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Gap between one place lighting and the next. */
const STEP_MS = 650;

/**
 * The reveal around the home podium (2026-10-30): when the podium comes into
 * view, the spotlight lights third place, then second, then first, one after
 * another, from a single scroll.
 *
 * The first version pinned the stage and spent a stretch of scrolling on each
 * place; the owner found three scrolls for three places too many, so the
 * whole sequence now plays on its own once the podium is on screen. It plays
 * once and stays.
 *
 * The podium is complete in the server HTML. It only becomes a reveal when
 * this script arms it, and it arms only while the section is still below the
 * screen, so no one ever sees it hide; reduced motion, a page opened scrolled
 * past it, or no JavaScript all get the plain podium. Moving focus into it
 * lights everything at once, so a keyboard never lands on a silhouette.
 *
 * The attributes are set on the DOM directly rather than through state: the
 * podium's markup comes from the server and nothing here needs to render.
 */
export function PodiumScroll({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    // Third place first.
    const slots = [...el.querySelectorAll<HTMLElement>('[data-podium-slot]')].sort(
      (a, b) => Number(b.dataset.rank) - Number(a.dataset.rank),
    );
    const row = el.querySelector('.podium-row');
    if (!row || slots.length === 0) return;

    el.dataset.armed = '';
    el.dataset.beat = '0';
    const timers: number[] = [];

    const light = (beat: number) => {
      slots[beat - 1]?.classList.add('is-lit');
      if (Number(el.dataset.beat) < beat) el.dataset.beat = String(beat);
    };
    const play = (gap: number) => {
      io.disconnect();
      el.removeEventListener('focusin', onFocus);
      slots.forEach((_, i) => timers.push(window.setTimeout(() => light(i + 1), i * gap)));
    };
    const onFocus = () => play(0);

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) play(STEP_MS);
      },
      { threshold: 0.6 },
    );
    io.observe(row);
    el.addEventListener('focusin', onFocus);

    return () => {
      io.disconnect();
      el.removeEventListener('focusin', onFocus);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
