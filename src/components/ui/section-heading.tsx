import type { ReactNode } from 'react';

/**
 * One heading treatment for every section, so pages share a rhythm instead of
 * each inventing its own. The accent rule gives sections a clear left edge to
 * scan down.
 *
 * `icon` and `count` exist because the alternative was pages opting out. The
 * events and profile pages each wanted an icon beside the title or a tally
 * after it, the component had nowhere to put either, and so both hand-rolled
 * their own `text-2xl font-bold` heading instead — which is how a site ends up
 * with two heading systems. Anything a section legitimately needs belongs here
 * rather than in a private copy.
 */
export function SectionHeading({
  title,
  subtitle,
  icon,
  count,
  aside,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Sits before the title, at the size of the type beside it. */
  icon?: ReactNode;
  /** A tally after the title, for sections whose length is worth stating. */
  count?: ReactNode;
  /** Right-aligned metadata or a link. */
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="rule mt-1" aria-hidden />
        <div className="min-w-0">
          <h2 className="display flex flex-wrap items-center gap-2 text-2xl uppercase">
            {icon ? (
              <span aria-hidden className="flex shrink-0 items-center">
                {icon}
              </span>
            ) : null}
            {title}
            {count !== undefined && count !== null ? (
              <span className="text-base normal-case tracking-normal text-muted">
                {count}
              </span>
            ) : null}
          </h2>
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
  eyebrow,
  subtitle,
  aside,
}: {
  title: string;
  /** Small label above the title, matching the landing page's treatment. */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-2.5 flex items-center gap-2.5">
            <span aria-hidden className="rule h-4" />
            <span className="eyebrow">{eyebrow}</span>
          </p>
        ) : null}
        <h1 className="display text-3xl uppercase sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-muted">{subtitle}</p> : null}
      </div>
      {aside}
    </header>
  );
}
