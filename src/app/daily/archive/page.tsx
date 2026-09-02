import type { Metadata } from 'next';
import Link from 'next/link';

import { dayLabel } from '@/components/daily/daily-report';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';

import { listDailyReports } from '@/lib/stats';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Daily findings archive',
  description:
    'Every day of BrawlZone findings, kept at its own address. What the sampled Brawl Stars battles showed on each date, from the strongest unused pick to the most one-sided matchup.',
  alternates: { canonical: '/daily/archive' },
};

/**
 * Every day the site has kept.
 *
 * Deliberately a plain list rather than a grid of cards. The reader arriving
 * here already knows what a daily report is — they came from one — and what
 * they want is a date, so the page gives them dates and gets out of the way.
 */
export default async function DailyArchivePage() {
  const reports = await listDailyReports(400).catch(() => []);

  return (
    <div className="space-y-6">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Daily', path: '/daily' },
          { name: 'Archive', path: '/daily/archive' },
        ])}
      />

      <PageHeading
        title="Daily archive"
        subtitle="Each day's findings kept at its own address. They cannot be recomputed once their windows roll past, so this reaches back only as far as the day it started."
        aside={
          <Link
            href="/daily/feed.xml"
            className="text-xs font-semibold text-brand transition-colors hover:underline"
          >
            RSS
          </Link>
        }
      />

      {reports.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          Nothing archived yet. Today&rsquo;s report is written as it is published, so the first
          entry appears once{' '}
          <Link href="/daily" className="text-brand hover:underline">
            today&rsquo;s findings
          </Link>{' '}
          have been generated.
        </p>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {reports.map((report) => (
            <li key={report.day}>
              <Link
                href={`/daily/${report.day}`}
                className="row-interactive flex items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1 font-semibold">{dayLabel(report.day)}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {report.findings} {report.findings === 1 ? 'finding' : 'findings'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
