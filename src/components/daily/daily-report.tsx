import Link from 'next/link';

import { DiscoveryCard } from '@/components/daily/discovery-card';
import { PageHeading } from '@/components/ui/section-heading';
import type { Discovery } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/**
 * One day of discoveries, whether it is today or an archived date.
 *
 * Shared so a stored day and a live one cannot drift apart in wording or
 * layout. The archive exists to be linked to weeks later, and a page that
 * rendered differently on the day it was written would undermine that.
 */
export function DailyReport({
  discoveries,
  brawlerMeta,
  dateLabel,
  isToday,
  prev,
  next,
}: {
  discoveries: Discovery[];
  brawlerMeta: Map<number, BABrawler>;
  dateLabel: string;
  isToday: boolean;
  prev?: { href: string; label: string } | null;
  next?: { href: string; label: string } | null;
}) {
  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow={dateLabel}
        title={isToday ? 'What we found today' : 'What we found'}
        subtitle="Things the sampled battles say that a ranked table does not. Every one is the largest gap of its kind in the data that day — not an opinion, and not a list sorted by the obvious column."
      />

      {discoveries.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          Nothing cleared the evidence floor. Each finding needs at least 300 sampled battles
          behind it, and the page would rather show nothing than a coincidence.
        </p>
      ) : (
        <div className="space-y-4">
          {discoveries.map((discovery, index) => (
            <DiscoveryCard
              key={discovery.kind}
              discovery={discovery}
              brawlerMeta={brawlerMeta}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Older on the left, newer on the right, the way a reader expects a
          timeline to run — and each end simply absent when there is nothing
          there, rather than a disabled control that looks like a mistake. */}
      {prev || next ? (
        <nav className="flex items-center justify-between gap-3 border-t border-border pt-5 text-sm">
          {prev ? (
            <Link
              href={prev.href}
              className="inline-flex items-center gap-2 font-semibold text-muted transition-colors hover:text-foreground"
            >
              <span aria-hidden>←</span>
              {prev.label}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={next.href}
              className="inline-flex items-center gap-2 font-semibold text-muted transition-colors hover:text-foreground"
            >
              {next.label}
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

/** "2 September 2026", UTC-anchored so the server and browser agree. */
export function dayLabel(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Today in UTC, which is the day the archive keys on. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
