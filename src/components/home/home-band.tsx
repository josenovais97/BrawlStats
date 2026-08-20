import type { ReactNode } from 'react';

/**
 * A full-bleed change of ground behind a run of sections.
 *
 * The landing page's problem was not the content, it was that every block sat
 * on the same background inside the same card grid, so the page read as a
 * stack of components rather than as one designed thing. A band costs no extra
 * markup per section and gives the eye somewhere to rest between the live data
 * above it and the snapshot below.
 *
 * Escapes the content column deliberately — `w-screen` centred on the page —
 * which is safe because the body clips horizontal overflow. See `globals.css`.
 */
export function HomeBand({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative py-12 sm:py-14 ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 border-y border-border/50 bg-surface/25"
      />
      {children}
    </div>
  );
}
