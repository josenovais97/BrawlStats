'use client';

import { useEffect } from 'react';

/**
 * Whether the app is installed, and whether installing changed anything.
 *
 * Three events, and the third is the one that matters. `pwa_install` counts
 * intent, `pwa_first_launch` counts the install actually completing into
 * something someone opened, and `pwa_launch` counts whether they came back —
 * which is the only figure that says the install was worth having. An install
 * that never produces a second launch is a bookmark nobody clicked.
 *
 * "First" is decided by a local flag rather than by the analytics side. The
 * distinction is a property of this device — the same person installing on a
 * phone and a tablet has two first launches, and that is the truthful count.
 */

const FIRST_LAUNCH_KEY = 'brawlzone:pwa-launched';

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

/**
 * Fires an event if analytics is present, and does nothing if it is not.
 *
 * The script is production-only and `defer`red, so it may not have loaded when
 * a launch event happens. Rather than queue or retry — telemetry that outlives
 * the thing it measures is worse than a missing data point — this simply skips.
 */
function track(event: string): void {
  try {
    window.umami?.track(event);
  } catch {
    // Analytics blocked or unavailable. Never a reason to break a page.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the media query and still uses this.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function PwaTelemetry() {
  useEffect(() => {
    /*
     * Fired by the browser once the install completes, whether it came from our
     * own banner or from the address bar. Counting only our banner would miss
     * every install the browser prompted on its own.
     */
    const onInstalled = () => track('pwa_install');
    window.addEventListener('appinstalled', onInstalled);

    if (isStandalone()) {
      let first = false;
      try {
        first = window.localStorage.getItem(FIRST_LAUNCH_KEY) !== '1';
        if (first) window.localStorage.setItem(FIRST_LAUNCH_KEY, '1');
      } catch {
        /*
         * Storage disabled. Every launch then looks like a return visit, which
         * understates first launches rather than inventing them — the safer
         * direction for a number used to judge whether installs are working.
         */
      }
      track(first ? 'pwa_first_launch' : 'pwa_launch');
    }

    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  return null;
}
