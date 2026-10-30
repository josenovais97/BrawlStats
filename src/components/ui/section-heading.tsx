import type { ReactNode } from 'react';
import { getUT } from '@/lib/t-universal';

/**
 * One heading treatment for every section, so pages share a rhythm instead of
 * each inventing its own: the game's lettering, outlined, in the case it is
 * written in (2026-10-30; was capitals behind a gold rule).
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
  const t = getUT();
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
          <h2 className="display text-game-stroke flex flex-wrap items-center gap-2 text-2xl sm:text-3xl">
            {icon ? (
              <span aria-hidden className="flex shrink-0 items-center">
                {icon}
              </span>
            ) : null}
            {t(title)}
            {count !== undefined && count !== null ? (
              <span className="font-sans text-base tracking-normal text-muted [-webkit-text-stroke:0] [text-shadow:none]">
                {count}
              </span>
            ) : null}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-muted">{t(subtitle)}</p> : null}
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
  /** Context the title needs, such as a date; shown small, above it. */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  const t = getUT();
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow mb-2">{t(eyebrow)}</p> : null}
        <h1 className="display text-game-stroke text-4xl leading-tight sm:text-5xl">{t(title)}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-muted">{t(subtitle)}</p> : null}
      </div>
      {aside}
    </header>
  );
}
