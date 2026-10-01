import type { ReactNode } from 'react';

export interface StatItem {
  /** Pre-rendered mark, for the game's own artwork. */
  node?: ReactNode;
  label: string;
  value: string;
  hint?: string;
}

/**
 * A row of reference figures on one surface.
 *
 * The profile used to draw each of these as its own `card card-glow` with an
 * icon in a rounded tile — ten of them in the account area alone, each
 * carrying a border, a gradient, a 48px drop shadow and three lines of type.
 * Ten boxes is ten things to look at, and none of them was worth looking at
 * individually: these are lifetime counters and personal bests, the sort of
 * number you look up rather than open a profile to find.
 *
 * So the chrome collapses to one panel and the data stays exactly as it was.
 * Nothing is hidden or cut; what goes away is nine borders, nine shadows and
 * ten icon tiles.
 *
 * The game's own marks are kept, small and inline with the label rather than
 * boxed. That was a deliberate choice when these were cards — it is what makes
 * the row read as Brawl Stars instead of a generic dashboard — and dropping
 * the artwork to make things quieter would have thrown away the wrong half.
 *
 * Separated by whitespace rather than rules. Hairlines in a grid whose column
 * count changes with the viewport leave the divider showing through wherever
 * the last row is short, and the fix for that is filler cells that have to
 * know the breakpoint. Space has no such problem and is quieter anyway.
 */
export function StatStrip({ items }: { items: StatItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="card p-5 sm:p-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {item.node ? (
                <span aria-hidden className="flex shrink-0 items-center opacity-90">
                  {item.node}
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
            </dt>
            <dd className="mt-1.5 truncate text-xl font-bold tabular-nums leading-none">
              {item.value}
            </dd>
            {item.hint ? (
              <dd className="mt-1 truncate text-xs text-muted">{item.hint}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
