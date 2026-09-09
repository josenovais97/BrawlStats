'use client';

import type { ReactNode } from 'react';

import { BUBBLE_APP } from '@/lib/bubble-app';

/**
 * The APK link, with a count of who taps it.
 *
 * Counts *intent*, and the distinction matters enough to say out loud: a click
 * is not an install. The browser may refuse the file, Android may refuse the
 * install, and the reader may abandon it at the "Allow from this source"
 * prompt — which, going by how many people the restricted-settings step trips
 * up, is where a real share of them stop. Caddy's access log is the ground
 * truth for bytes actually served; this is the top of that funnel.
 *
 * `from` is what makes the number useful. A tap on the panel's update banner
 * is an existing user upgrading; one on the landing page is a new install; one
 * on the QR-scanned page is a desktop reader who moved to their phone. Same
 * event, three completely different things to learn from.
 *
 * Fires and forgets. The analytics script is production-only and deferred, so
 * it may not be there — telemetry that delays a download is worse than a
 * missing data point, and nothing here blocks the navigation.
 */
export function DownloadButton({
  from,
  className,
  children,
}: {
  from: 'hero' | 'cta' | 'home' | 'panel';
  className?: string;
  children: ReactNode;
}) {
  /*
   * No `download` attribute inside the app, and that is the whole difference
   * between a working button and a dead one.
   *
   * Android's WebView does not implement the HTML5 `download` attribute. A link
   * carrying it is not treated as a navigation, so `shouldOverrideUrlLoading`
   * never fires, the service never gets to hand the URL to a browser, and the
   * button silently does nothing — which is exactly what an out-of-date install
   * saw when it tried to update itself from the panel's own banner.
   *
   * Without it the click is an ordinary navigation to the APK, which every app
   * build since 1.5 already routes out to the browser. That matters more than
   * it looks: this is a *page* change, so it fixes the button on installs that
   * are already out there, which is precisely who is reading an update banner.
   *
   * The attribute stays everywhere else, where it names the saved file properly
   * in a real browser.
   */
  const inApp = from === 'panel';

  return (
    <a
      href={BUBBLE_APP.path}
      download={inApp ? undefined : ''}
      className={className}
      onClick={(event) => {
        try {
          window.umami?.track('apk_download', {
            from,
            version: BUBBLE_APP.version,
          });
        } catch {
          // Analytics blocked or unavailable. Never a reason to stop a download.
        }

        /*
         * In the app, ask the app. Belt to the braces above: newer builds
         * expose a bridge that opens the URL with an Intent directly, which
         * cannot be defeated by whatever a given WebView build decides a link
         * means. Older builds have no bridge and fall through to the plain
         * navigation, which is why both exist.
         */
        if (!inApp) return;
        const bridge = (window as unknown as { BrawlZoneScan?: { openExternal?: (u: string) => void } })
          .BrawlZoneScan;
        if (typeof bridge?.openExternal !== 'function') return;
        try {
          bridge.openExternal(new URL(BUBBLE_APP.path, window.location.origin).toString());
          event.preventDefault();
        } catch {
          // Leave the navigation to happen normally.
        }
      }}
    >
      {children}
    </a>
  );
}
