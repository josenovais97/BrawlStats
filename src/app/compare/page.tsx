import type { Metadata } from 'next';
import Link from 'next/link';

import { ComparePicker } from '@/components/brawlers/compare-picker';
import { PlayerCompareForm } from '@/components/compare/player-compare-form';
import { PlayerVersus } from '@/components/compare/player-versus';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { getBrawlerMap } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { loadComparison } from '@/lib/player-compare';
import { comparePath } from '@/lib/compare';
import { slugify } from '@/lib/slugs';
import { getMetaIndex } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const comparing = Boolean(params.player1 && params.player2);

  return {
    title: 'Compare Brawl Stars players and brawlers side by side',
    description:
      'Put two Brawl Stars players or two brawlers side by side: trophies, Ranked, skill score, account completion, win rates and head-to-head records.',
    // Always the bare tool page: a specific pairing is one of unbounded many
    // and should consolidate onto the page that explains the tool.
    alternates: { canonical: '/compare' },
    // The tool page is worth indexing; an arbitrary pair of player tags is not
    // — there is one such URL per pair of accounts in existence.
    ...(comparing ? { robots: { index: false, follow: true } } : {}),
  };
}

export const revalidate = 3600;

/** How many of the current top brawlers to pair up as suggestions. */
const SUGGESTION_SEED = 8;

interface PageProps {
  searchParams: Promise<{ player1?: string; player2?: string }>;
}

export default async function CompareIndexPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tagA = params.player1?.trim() ?? '';
  const tagB = params.player2?.trim() ?? '';
  const comparing = Boolean(tagA && tagB);

  // Only loaded when both tags are present, so the bare /compare page costs no
  // player API calls at all — which is what keeps a crawler on this route
  // cheap.
  const comparison = comparing ? await loadComparison(tagA, tagB) : null;
  // Withdrawn brawlers are not comparable options.
  const brawlers = (await getBrawlerCatalog()).current;
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
        title="Compare"
        subtitle="Two players or two brawlers, side by side. Player comparisons live entirely in the URL, so they are shareable and nothing is stored."
      />

      <section>
        <SectionHeading
          title="Compare players"
          subtitle="Pick from the profiles you have looked up on this device, or type a tag. Works with or without the #."
        />
        <PlayerCompareForm initialA={tagA} initialB={tagB} />
      </section>

      {comparison ? (
        <PlayerVersus a={comparison.a} b={comparison.b} />
      ) : null}

      <section>
        <SectionHeading
          title="Compare brawlers"
          subtitle="Win and pick rates, tier, where each performs best, and their head-to-head record."
        />
        <ComparePicker brawlers={options} />
      </section>

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
