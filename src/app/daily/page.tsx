import type { Metadata } from 'next';
import Link from 'next/link';

import { DailyReport, dayLabel, todayIso } from '@/components/daily/daily-report';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';

import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getDailyDiscoveries, listDailyReports, saveDailyReport } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/*
 * Daily, and the framing depends on it. The underlying reads refresh every two
 * hours, so a shorter revalidate would let "today's discoveries" change while
 * someone was reading them. Held for a day, the page is a thing that happened
 * rather than a live query.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'What BrawlZone found in the data today',
  description:
    'Findings pulled from today’s sampled Brawl Stars battles: the pick nobody uses that keeps winning, the popular pick that loses, the most one-sided matchup, and the brawler that behaves differently on one map.',
  alternates: { canonical: '/daily' },
};

export default async function DailyPage() {
  const [discoveries, brawlerMeta] = await Promise.all([
    getDailyDiscoveries().catch(() => []),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
  ]);

  const today = todayIso();

  /*
   * Written on render rather than by a timer.
   *
   * This page regenerates once a day, so the write happens exactly when the
   * day's discoveries are produced — which means the archived copy is the copy
   * that was published, not a second computation that might disagree with it.
   * A scheduled job would need its own retries to make that guarantee.
   */
  await saveDailyReport(today, discoveries);

  const archive = await listDailyReports(2).catch(() => []);
  const previous = archive.find((entry) => entry.day < today);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Daily', path: '/daily' },
        ])}
      />

      <DailyReport
        discoveries={discoveries}
        brawlerMeta={brawlerMeta}
        dateLabel={dayLabel(today)}
        isToday
        prev={
          previous
            ? { href: `/daily/${previous.day}`, label: dayLabel(previous.day) }
            : null
        }
      />

      <section className="card mt-8 p-5 text-sm leading-relaxed text-muted">
        <p>
          <strong className="text-foreground">How these are chosen.</strong> Each card is the
          argmax of a stated quantity over a stated population — the highest win rate among
          brawlers under 1% usage, the widest gap between a brawler and one map, and so on. The
          same data always produces the same set, so nothing here is written by a model or picked
          by hand. Win rates are adjusted against the sample average, so a week where the sampled
          players are stronger does not make every brawler look buffed.
        </p>
        <p className="mt-3">
          Every day is kept at its own address —{' '}
          <Link href="/daily/archive" className="text-brand hover:underline">
            browse the archive
          </Link>{' '}
          or{' '}
          <Link href="/daily/feed.xml" className="text-brand hover:underline">
            subscribe by RSS
          </Link>
          . These findings cannot be recomputed later, so the archive starts from the day it was
          built rather than reaching backwards.
        </p>
      </section>
    </>
  );
}
