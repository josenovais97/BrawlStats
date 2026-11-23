import { useId, type ReactNode } from 'react';

/**
 * A page's written notes: what this week's numbers say, and how they are made
 * (2026-11-23). Pages that were a grid or a tool with a line on top read as
 * thin to a reviewer, and the AdSense rejections were "low value content", so
 * the busiest of them say in prose what the data shows and where it comes
 * from. Every sentence is computed or checked against the code, never filler.
 */
export function PageNotes({ title, paragraphs, children }: { title: string; paragraphs: string[]; children?: ReactNode }) {
  const id = `notes-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <section aria-labelledby={id} className="card space-y-3 p-6 sm:p-8">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {paragraphs.filter(Boolean).map((p, i) => (
        <p key={i} className="max-w-3xl leading-relaxed text-muted">
          {p}
        </p>
      ))}
      {children}
    </section>
  );
}
