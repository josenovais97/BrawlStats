import type { ReactNode } from 'react';

/**
 * A head-to-head metric list that does not become a table on a phone.
 *
 * A three-column table is the obvious way to build a comparison and the wrong
 * one below about 500px: the metric label needs room, both values need room,
 * and at 320px something has to give — usually by scrolling sideways, which
 * hides half the comparison behind a gesture nobody discovers.
 *
 * So each metric is a row of its own with the two values side by side under a
 * label, and the header carries the identities. Nothing scrolls horizontally at
 * any width, and both sides stay on screen together, which is the entire point
 * of a comparison.
 *
 * Rendered as a description list rather than a table because that is what it
 * is once the grid is gone — a set of labelled pairs, not tabular data with
 * meaningful row and column headers.
 */

export interface VersusMetric {
  label: string;
  a: string;
  b: string;
  /**
   * Which side is ahead, when "ahead" is meaningful.
   *
   * Null for anything that is a property rather than a score — rarity, class,
   * a favourite mode — because marking one of those as winning is nonsense.
   */
  leader: 'a' | 'b' | null;
  /** Optional clarification shown under the row. */
  hint?: string;
  /**
   * The two raw values, when a picture helps: draws one track under the row,
   * each side filled in its colour by its share of the pair. Only for scores
   * where the size of the gap is the point -- win rate, pick rate.
   */
  values?: [number | null, number | null];
}

export interface VersusSection {
  title: string;
  metrics: VersusMetric[];
}

export function VersusList({
  sections,
  labelA,
  labelB,
  accentA = 'var(--brand)',
  accentB = 'var(--accent-2)',
}: {
  sections: VersusSection[];
  labelA: ReactNode;
  labelB: ReactNode;
  accentA?: string;
  accentB?: string;
}) {
  const visible = sections.filter((section) => section.metrics.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-6">
      {visible.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
            {section.title}
          </h3>

          <dl className="card divide-y divide-border overflow-hidden">
            {/* Sticky within its own card so the reader never loses track of
                which column is whom while scanning a long section. */}
            <div className="sticky top-0 z-10 grid grid-cols-2 gap-2 bg-surface-2/95 px-3 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur">
              <span className="truncate" style={{ color: accentA }}>
                {labelA}
              </span>
              <span className="truncate text-right" style={{ color: accentB }}>
                {labelB}
              </span>
            </div>

            {section.metrics.map((metric) => (
              <div key={metric.label} className="px-3 py-2.5">
                <dt className="text-xs font-medium text-muted">{metric.label}</dt>
                <dd className="mt-0.5 grid grid-cols-2 items-baseline gap-2">
                  <span
                    className={`min-w-0 truncate text-sm tabular-nums ${
                      metric.leader === 'a' ? 'font-bold text-victory' : 'font-medium'
                    }`}
                  >
                    {metric.a}
                  </span>
                  <span
                    className={`min-w-0 truncate text-right text-sm tabular-nums ${
                      metric.leader === 'b' ? 'font-bold text-victory' : 'font-medium'
                    }`}
                  >
                    {metric.b}
                  </span>
                </dd>
                {metric.values &&
                metric.values[0] !== null &&
                metric.values[1] !== null &&
                metric.values[0] + metric.values[1] > 0 ? (
                  <span aria-hidden className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="h-full transition-[width]"
                      style={{
                        width: `${(metric.values[0] / (metric.values[0] + metric.values[1])) * 100}%`,
                        background: accentA,
                        opacity: metric.leader === 'b' ? 0.45 : 1,
                      }}
                    />
                    <span className="h-full w-0.5 shrink-0 bg-background" />
                    <span
                      className="h-full flex-1"
                      style={{ background: accentB, opacity: metric.leader === 'a' ? 0.45 : 1 }}
                    />
                  </span>
                ) : null}
                {metric.hint ? (
                  <p className="mt-0.5 text-xs leading-snug text-muted">
                    {metric.hint}
                  </p>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
