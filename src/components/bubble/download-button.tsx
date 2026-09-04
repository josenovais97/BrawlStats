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
  return (
    <a
      href={BUBBLE_APP.path}
      download
      className={className}
      onClick={() => {
        try {
          window.umami?.track('apk_download', {
            from,
            version: BUBBLE_APP.version,
          });
        } catch {
          // Analytics blocked or unavailable. Never a reason to stop a download.
        }
      }}
    >
      {children}
    </a>
  );
}
