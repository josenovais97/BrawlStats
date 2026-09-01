import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CompList } from '@/components/comps/comp-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';

import { getGameModeMap } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { formatNumber, formatPercent } from '@/lib/format';
import { slugify } from '@/lib/slugs';
import { getTeamComps, type ModeComps } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

interface PageProps {
  params: Promise<{ mode: string }>;
}

export const revalidate = 7200;

/* Runtime ISR. See `/brawlers/[slug]` for why the empty array is required. */
export async function generateStaticParams() {
  return [];
}

/**
 * Resolves a mode slug against the modes that actually have comps.
 *
 * Keyed off the comps rather than the full mode list so the route only ever
 * addresses modes with something to show — which is also what keeps the
 * crawlable set equal to the number of modes with data.
 */
async function resolveMode(
  slug: string,
): Promise<{ comps: ModeComps; label: string; slug: string } | null> {
  const [modes, modeMeta] = await Promise.all([
    getTeamComps().catch(() => []),
    getGameModeMap().catch(() => new Map()),
  ]);

  const wanted = slugify(slug);
  for (const mode of modes) {
    const label = modeMeta.get(mode.mode.toLowerCase())?.name ?? mode.mode;
    if (slugify(label) === wanted) return { comps: mode, label, slug: wanted };
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) return { title: 'Team comps' };

  return {
    title: `Best ${resolved.label} comps in Brawl Stars`,
    description: `The three-brawler compositions with the best records in Brawl Stars ${resolved.label}, measured from sampled battles over the last 14 days.`,
    alternates: { canonical: `/comps/${resolved.slug}` },
  };
}

export default async function ModeCompsPage({ params }: PageProps) {
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) notFound();

  const brawlerMeta = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  const { comps } = resolved;

  return (
    <div className="space-y-6">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Team comps', path: '/comps' },
          { name: resolved.label, path: `/comps/${resolved.slug}` },
        ])}
      />

      <Link
        href="/comps"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All modes
      </Link>

      <PageHeading
        title={`Best ${resolved.label} comps`}
        subtitle={`Ranked by how far each trio sits above the mode's own average of ${formatPercent(
          comps.baseline,
        )}, from ${formatNumber(comps.sampleSize)} sampled battles over the last 14 days.`}
      />

      <CompList
        comps={comps.comps}
        brawlerMeta={brawlerMeta}
        emptyLabel="Not enough data for this mode yet."
      />

      <p className="text-xs leading-relaxed text-muted">
        A comp appears here once at least ten different players have used it in at least twenty
        decided battles. The player floor matters more than the battle count: a squad that queues
        together brings the same trio every game, so without it the list ranks strong teams rather
        than strong comps. Ranked and ladder battles both count.
      </p>
    </div>
  );
}
