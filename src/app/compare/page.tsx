import type { Metadata } from 'next';
import Link from 'next/link';

import { ComparePicker } from '@/components/brawlers/compare-picker';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { getBrawlerMap, getBrawlers } from '@/lib/brawlapi';
import { comparePath } from '@/lib/compare';
import { slugify } from '@/lib/slugs';
import { getMetaIndex } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

export const metadata: Metadata = {
  title: 'Compare Brawl Stars brawlers side by side',
  description:
    'Put any two Brawl Stars brawlers side by side: win rates, pick rates, tiers, best modes and their head-to-head record from sampled battles.',
  alternates: { canonical: '/compare' },
};

export const revalidate = 3600;

/** How many of the current top brawlers to pair up as suggestions. */
const SUGGESTION_SEED = 8;

export default async function CompareIndexPage() {
  const brawlers = await getBrawlers().catch(() => [] as BABrawler[]);
  const meta = await getBrawlerMap().catch(() => new Map<number, BABrawler>());
  const metaIndex = await getMetaIndex('ranked', 7);

  // Suggestions are drawn from the current top of the meta rather than picked
  // by hand: those are the brawlers people are choosing between this week, and
  // the list re-sorts itself as the meta moves.
  const top = [...metaIndex.entries()]
    .sort((a, b) => (b[1].metaScore ?? 0) - (a[1].metaScore ?? 0))
    .map(([id]) => meta.get(id))
    .filter((brawler): brawler is BABrawler => Boolean(brawler))
    .slice(0, SUGGESTION_SEED);

  const suggestions: [BABrawler, BABrawler][] = [];
  for (let i = 0; i + 1 < top.length; i += 2) {
    suggestions.push([top[i], top[i + 1]]);
  }

  const options = brawlers.map((brawler) => ({
    slug: slugify(brawler.name),
    name: brawler.name,
  }));

  return (
    <div className="space-y-8">
      <JsonLd data={breadcrumbSchema([{ name: 'Compare', path: '/compare' }])} />

      <PageHeading
        title="Compare brawlers"
        subtitle="Two brawlers side by side: win and pick rates, tier, where each one performs best, and how they do against each other in sampled battles."
      />

      <ComparePicker brawlers={options} />

      {suggestions.length > 0 ? (
        <section>
          <SectionHeading
            title="Comparisons worth making"
            subtitle="Drawn from the current top of the Ranked tier list, so it follows the meta rather than a fixed list."
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {suggestions.map(([a, b]) => (
              <li key={`${a.id}-${b.id}`}>
                <Link
                  href={comparePath(a, b)}
                  className="card card-interactive flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold capitalize"
                >
                  {a.name.toLowerCase()}
                  <span className="text-xs font-black uppercase text-muted">vs</span>
                  {b.name.toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
