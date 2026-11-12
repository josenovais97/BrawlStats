'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/*
 * Feedback for every tap (2026-11-12). Owner: "make sure every button, card,
 * etc that the user clicks gives feedback and doesn't just stay there".
 *
 * - A thin bar across the top the instant an internal link or a search form
 *   starts a navigation, finished when the new page's path is on screen.
 * - The tapped link or submit button gets `data-pending` until then, which
 *   globals.css draws as a pulsing ring, so the card itself reads as loading.
 * - A light haptic tick on touch for buttons, cards, chips and tabs: the
 *   Bubble app's native haptics inside its panel (window.BrawlZoneApp), else
 *   navigator.vibrate where the browser has it (Android; iOS Safari does not).
 *
 * All from three document listeners, so no component has to opt in.
 */

const TAPPABLE =
  'button, [role="tab"], [role="button"], summary, .btn-game, .bz-chip, .bz-chip-on, .card-interactive, .row-interactive, .brawler-card, .lobby-tile, .tier-chip, [data-haptic]';

type AppBridge = { haptic?: (kind: string) => void };

function tick() {
  try {
    const app = (window as unknown as { BrawlZoneApp?: AppBridge }).BrawlZoneApp;
    if (app?.haptic) {
      app.haptic('tap');
      return;
    }
    navigator.vibrate?.(8);
  } catch {
    // Haptics are a nicety; a browser that refuses is fine.
  }
}

/** Where a click on this anchor goes, when it is an in-site navigation to another page. */
function internalTarget(a: HTMLAnchorElement, e: MouseEvent): URL | null {
  // Not `defaultPrevented`: next/link cancels the click to navigate itself.
  // Handlers that open something in place stop the click before it gets
  // here (the tier list's drawer), or carry data-no-progress.
  if (a.closest('[data-no-progress]')) return null;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  // Same page (a hash or the tab's own query): nothing loads.
  if (url.pathname === window.location.pathname) return null;
  return url;
}

export function NavFeedback() {
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const active = useRef(false);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const done = () => {
    document.querySelectorAll('[data-pending]').forEach((el) => el.removeAttribute('data-pending'));
    const el = bar.current;
    if (!el || !active.current) return;
    active.current = false;
    clear();
    el.style.transition = 'transform 160ms ease-out, opacity 220ms ease 160ms';
    el.style.transform = 'scaleX(1)';
    el.style.opacity = '0';
  };

  const start = () => {
    const el = bar.current;
    if (!el) return;
    clear();
    active.current = true;
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.transform = 'scaleX(0)';
    // Next frame: grow quickly to a third, then creep, never reaching the end
    // on its own. A stuck navigation clears after 12 s.
    requestAnimationFrame(() => {
      el.style.transition = 'transform 400ms cubic-bezier(.2,.8,.2,1)';
      el.style.transform = 'scaleX(0.35)';
      timers.current.push(
        window.setTimeout(() => {
          el.style.transition = 'transform 6s cubic-bezier(.1,.6,.2,1)';
          el.style.transform = 'scaleX(0.88)';
        }, 420),
        window.setTimeout(done, 12_000),
      );
    });
  };

  // The new page is on screen.
  useEffect(() => {
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `done` reads refs only
  }, [pathname]);

  useEffect(() => {
    let tickedOnDown = false;
    const onPointerDown = (e: PointerEvent) => {
      tickedOnDown = false;
      if (e.pointerType !== 'touch') return;
      const hit = (e.target as Element | null)?.closest?.(TAPPABLE);
      // The first tap of a visit does not count as user activation yet on
      // pointerdown, so the browser would refuse; that one ticks on click.
      const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
      if (hit && activated) {
        tick();
        tickedOnDown = true;
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!tickedOnDown && target?.closest?.(TAPPABLE) && window.matchMedia('(pointer: coarse)').matches) tick();
      tickedOnDown = false;
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      if (!internalTarget(a, e)) return;
      a.setAttribute('data-pending', '');
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const form = e.target as HTMLFormElement;
      const action = form.getAttribute('action');
      if (action && !action.startsWith('/')) return;
      e.submitter?.setAttribute('data-pending', '');
      start();
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('bz:navstart', start);
    // Back and forward: no click to start from, but the old page's marks go.
    const onPop = () => document.querySelectorAll('[data-pending]').forEach((el) => el.removeAttribute('data-pending'));
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
      window.removeEventListener('bz:navstart', start);
      window.removeEventListener('popstate', onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once
  }, []);

  return <div ref={bar} aria-hidden className="bz-navbar" />;
}
