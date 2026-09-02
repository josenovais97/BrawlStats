import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { DailyReport, dayLabel, todayIso } from '@/components/daily/daily-report';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';

import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getDailyReport, listDailyReports } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

interface PageProps {
  params: Promise<{ date: string }>;
}

/**
 * One archived day of discoveries.
 *
 * Dated URLs rather than a single page that overwrites itself, because the
 * findings are the one thing on this site that genuinely expire: they are the
 * largest gap of their kind *on that day*, and tomorrow's answer is a different
 * one. A report worth reading is worth linking to a month later.
 *
 * The set stays bounded on its own — one URL a day, forever, is 365 a year
 * against a crawlable surface already past a thousand — but only days with
 * enough findings are indexed. That is the rule that keeps this from becoming
 * the thin-page farm the August outage was about.
 */
export const revalidate = 86400;

/* Runtime ISR. See `/brawlers/[slug]` for why the empty array is required. */
export async function generateStaticParams() {
  return [];
}

/** A day is only worth indexing when it actually found something. */
const MIN_FINDINGS_TO_INDEX = 4;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  if (!ISO_DATE.test(date)) return { title: 'Daily' };

  const report = await getDailyReport(date).catch(() => null);
  const label = dayLabel(date);

  return {
    title: `What BrawlZone found on ${label}`,
    description: report
      ? `${report.findings} findings from Brawl Stars battles sampled on ${label}, including the strongest pick nobody used and the most one-sided matchup of the day.`
      : `Brawl Stars findings for ${label}.`,
    alternates: { canonical: `/daily/${date}` },
    /*
     * A thin day is served but not indexed. The point of dated reports is fresh
     * entry points, and a page with one finding on it is neither fresh nor an
     * entry — it is the kind of near-empty URL that costs crawl budget across
     * the whole set.
     */
    robots: {
      index: (report?.findings ?? 0) >= MIN_FINDINGS_TO_INDEX,
      follow: true,
    },
  };
}

export default async function DailyArchivePage({ params }: PageProps) {
  const { date } = await params;
  if (!ISO_DATE.test(date)) notFound();

  // Today lives at /daily, which is the canonical address for the live report.
  if (date === todayIso()) redirect('/daily');

  const [report, brawlerMeta, archive] = await Promise.all([
    getDailyReport(date).catch(() => null),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    listDailyReports(400).catch(() => []),
  ]);

  if (!report) notFound();

  // `archive` is newest first, so "previous" is the next entry down the list.
  const older = archive.find((entry) => entry.day < date);
  const newer = [...archive].reverse().find((entry) => entry.day > date);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Daily', path: '/daily' },
          { name: dayLabel(date), path: `/daily/${date}` },
        ])}
      />

      <DailyReport
        discoveries={report.discoveries}
        brawlerMeta={brawlerMeta}
        dateLabel={dayLabel(date)}
        isToday={false}
        prev={older ? { href: `/daily/${older.day}`, label: dayLabel(older.day) } : null}
        next={
          newer
            ? { href: `/daily/${newer.day}`, label: dayLabel(newer.day) }
            : { href: '/daily', label: 'Today' }
        }
      />
    </>
  );
}
