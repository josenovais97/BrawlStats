import type { ReactNode } from 'react';

/**
 * One named area of a profile.
 *
 * A full profile is eighteen sections and about six screens on a phone, and
 * before this they were a single flat column. The ordering was not careless —
 * nearly every section carries a comment arguing for the one above it — but
 * local adjacency does not add up to a structure, and the symptom was visible
 * in the navigation: the bar offered four anchors while ten sections sat
 * outside any of them, so most of the page could not be reached from the only
 * means it had of moving around.
 *
 * Five groups, each a nav target, and every section inside one. The grouping
 * also separates the two questions the page was answering at once and
 * interleaving: *what is true about this account* and *what should I do about
 * it*. The advice was spread across six places between the facts; it is one
 * area now, and it comes first, because a reader who came to be told what to
 * do should not have to read a trophy history to find it.
 *
 * The number is not decoration. It tells a reader scrolling past how far
 * through they are, which on a page this long is the thing a flat column never
 * says.
 */
export function ProfileGroup({
  id,
  index,
  title,
  subtitle,
  children,
}: {
  id: string;
  /** Position in the page, shown beside the title. */
  index: number;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-anchor-nav">
      <header className="mb-7 flex items-start gap-4 border-t border-border pt-7">
        <span
          aria-hidden
          className="display shrink-0 text-3xl leading-none tabular-nums text-brand/35 sm:text-4xl"
        >
          {String(index).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h2 className="display text-2xl uppercase leading-tight sm:text-3xl">{title}</h2>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
          ) : null}
        </div>
      </header>

      {/*
        Generous and uniform. Each section used to set its own distance from
        the next, so the gap between two readouts and the gap between two
        unrelated areas were the same — which is most of why the page read as
        one undifferentiated run. Inside a group things are close; the rule and
        the padding above are what separate the groups.
      */}
      <div className="space-y-10">{children}</div>
    </section>
  );
}
