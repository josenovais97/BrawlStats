import type { ReactNode } from 'react';

/**
 * A section as one object: its title and its contents inside a single surface.
 *
 * Thirteen sections of the profile were built the same way — a `SectionHeading`
 * floating above a separate `card` — which renders as heading, gap, box,
 * heading, gap, box all the way down. Every section was two loose parts, so
 * the page read as a pile of them however carefully they were ordered.
 *
 * The other half of the problem was alignment, and it was structural rather
 * than a matter of taste. Put two of those sections in a two-column grid and
 * the grid stretches the `<section>` elements to match, but a `<div>` inside a
 * block-level section is sized by its own content — so the cards ended at
 * different heights and the row looked broken. `flex h-full flex-col` here
 * with a `flex-1` body is what makes two panels beside each other finish on
 * the same line.
 *
 * `h-full` is harmless outside a grid, so a panel can be dropped anywhere
 * without the caller knowing which case it is in.
 */
export function Panel({
  title,
  subtitle,
  aside,
  icon,
  count,
  children,
  /** Extra classes on the body, for panels whose content manages its own padding. */
  bodyClassName = 'p-5 sm:p-6',
  id,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Right-aligned metadata or a link, level with the title. */
  aside?: ReactNode;
  /** Sits before the title, at the size of the type beside it. */
  icon?: ReactNode;
  /** A tally after the title, for sections whose length is worth stating. */
  count?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className="card flex h-full flex-col overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/70 px-5 py-3.5 sm:px-6">
        <h2 className="display flex min-w-0 items-center gap-2 text-base uppercase leading-none tracking-wide sm:text-lg">
          {icon ? (
            <span aria-hidden className="flex shrink-0 items-center">
              {icon}
            </span>
          ) : null}
          <span className="truncate">{title}</span>
          {count !== undefined && count !== null ? (
            <span className="shrink-0 text-xs font-normal normal-case tracking-normal text-muted">
              {count}
            </span>
          ) : null}
        </h2>
        {aside ? <span className="shrink-0 text-xs text-muted">{aside}</span> : null}
        {subtitle ? (
          <p className="w-full text-sm leading-relaxed text-muted">{subtitle}</p>
        ) : null}
      </header>

      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
