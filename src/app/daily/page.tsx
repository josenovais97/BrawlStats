import type { Metadata } from 'next';
import Link from 'next/link';

import { DiscoveryCard } from '@/components/daily/discovery-card';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';

import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getDailyDiscoveries } from '@/lib/stats';
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
    'Six findings pulled from today’s sampled Brawl Stars battles: the pick nobody uses that keeps winning, the popular pick that loses, the most one-sided matchup, and the brawler that behaves differently on one map.',
  alternates: { canonical: '/daily' },
};

export default async function DailyPage() {
  const [discoveries, brawlerMeta] = await Promise.all([
    getDailyDiscoveries().catch(() => []),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
  ]);

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Daily', path: '/daily' },
        ])}
      />

      <PageHeading
        eyebrow={today}
        title={`What we found today`}
        subtitle="Six things the sampled battles say that a ranked table does not. Every one is the largest gap of its kind in the data right now — not an opinion, and not a list sorted by the obvious column."
      />

      {discoveries.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          Nothing cleared the evidence floor today. Each finding needs at least 300 sampled
          battles behind it, and the page would rather show nothing than a coincidence.
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

      <section className="card p-5 text-sm leading-relaxed text-muted">
        <p>
          <strong className="text-foreground">How these are chosen.</strong> Each card is the
          argmax of a stated quantity over a stated population — the highest win rate among
          brawlers under 1% usage, the widest gap between a brawler and one map, and so on. The
          same data always produces the same six, so nothing here is written by a model or picked
          by hand. Win rates are adjusted against the sample average, so a week where the sampled
          players are stronger does not make every brawler look buffed.
        </p>
        <p className="mt-3">
          Want the underlying numbers? They are on the{' '}
          <Link href="/tier-list/ranked" className="text-brand hover:underline">
            tier list
          </Link>
          ,{' '}
          <Link href="/comps" className="text-brand hover:underline">
            team comps
          </Link>{' '}
          and each{' '}
          <Link href="/brawlers" className="text-brand hover:underline">
            brawler page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
