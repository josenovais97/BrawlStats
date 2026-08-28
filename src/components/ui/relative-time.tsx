"use client";

import { useMemo, useSyncExternalStore } from "react";

import { relativeTime } from "@/lib/format";

/**
 * "2 hours ago", corrected in the reader's browser.
 *
 * This exists because a relative timestamp and a cached page are a bad pair.
 * `/ranked` is statically generated with a one-hour revalidate, so its HTML —
 * including the words "Sampled 40 minutes ago" — is frozen when the page is
 * built, and Next serves the stale copy while it regenerates in the
 * background. On a quiet day the visitor who triggers that rebuild reads a
 * string that was true hours earlier. `/tier-list/ranked` takes `searchParams`
 * and is rendered per request, so its copy of the very same database row was
 * always right, and the two pages disagreed by hours about one number.
 *
 * What goes in the markup is the absolute instant, in `datetime`, so the fact
 * is stored rather than a sentence about it. The browser turns it into words
 * on mount. The page stays static — no per-request function, no cost — and
 * the number stops drifting.
 *
 * `fallback` is what the server rendered, and it is passed in rather than
 * recomputed so that hydration has something deterministic to match: it is
 * also what a reader without JavaScript keeps, which is why it is the real
 * server-side string and not a placeholder.
 */

/** There is no store here — the clock is read once, after hydration. */
const subscribe = () => () => {};

export function RelativeTime({
  iso,
  fallback,
  className,
}: {
  /** ISO 8601 instant. */
  iso: string;
  /** The label as the server rendered it, for SSR and for no-JS readers. */
  fallback: string;
  className?: string;
}) {
  // Cached per instant: `getSnapshot` is called repeatedly and must not return
  // a fresh value each time, or React treats the store as perpetually changed.
  const getSnapshot = useMemo(() => {
    let cached: string | undefined;
    return () => (cached ??= relativeTime(iso));
  }, [iso]);

  const getServerSnapshot = useMemo(() => () => fallback, [fallback]);

  const label = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <time dateTime={iso} className={className}>
      {label}
    </time>
  );
}
