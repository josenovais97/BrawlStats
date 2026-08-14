import type { ReactNode } from 'react';

/**
 * One heading treatment for every section, so pages share a rhythm instead of
 * each inventing its own. The accent rule gives sections a clear left edge to
 * scan down.
 */
export function SectionHeading({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  /** Right-aligned metadata or a link. */
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="rule mt-1" aria-hidden />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {aside ? <div className="shrink-0 text-sm text-muted">{aside}</div> : null}
    </div>
  );
}

/** Page-level title, used once at the top of a route. */
export function PageHeading({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-3xl text-muted">{subtitle}</p>
        ) : null}
      </div>
      {aside}
    </header>
  );
}
