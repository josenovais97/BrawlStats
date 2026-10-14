import Link from 'next/link';

import { DiscoveryCard } from '@/components/daily/discovery-card';
import { PageHeading } from '@/components/ui/section-heading';
import type { Discovery } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

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
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow={dateLabel}
        title={isToday ? t('What we found today') : t('What we found')}
        subtitle={t('Things the sampled battles say that a ranked table does not. Every one is the largest gap of its kind in the data that day — not an opinion, and not a list sorted by the obvious column.')}
      />

      {discoveries.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">{t('Nothing cleared the evidence floor. Each finding needs at least 300 sampled battles behind it, and the page would rather show nothing than a coincidence.')}</p>
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
              href={lp(prev.href)}
              className="inline-flex items-center gap-2 font-semibold text-muted transition-colors hover:text-foreground"
            >
              <span aria-hidden>←</span>
              {t(prev.label)}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={lp(next.href)}
              className="inline-flex items-center gap-2 font-semibold text-muted transition-colors hover:text-foreground"
            >
              {t(next.label)}
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

/** Today in UTC, which is the day the archive keys on. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
