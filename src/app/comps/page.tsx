import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { CompList } from '@/components/comps/comp-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

import { getGameModeMap, modeLabel } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { formatNumber, formatPercent } from '@/lib/format';
import { slugify } from '@/lib/slugs';
import { getTeamComps } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/* Matches READ_CACHE_SECONDS: a longer declaration would be capped by the
   data cache inside it anyway. See trap 2 in AGENTS.md. */
export const revalidate = 7200;

export const metadata: Metadata = {
  title: 'Best team comps in Brawl Stars',
  description:
    'The three-brawler compositions with the best records in each Brawl Stars mode, measured from sampled battles and filtered so one strong premade team cannot skew a comp.',
  alternates: { canonical: '/comps' },
};

/** Enough to show the shape of a mode without becoming the mode page. */
const PREVIEW = 3;

export default async function CompsPage() {
  const [modes, modeMeta, brawlerMeta] = await Promise.all([
    getTeamComps().catch(() => []),
    getGameModeMap().catch(() => new Map()),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
  ]);

  const withComps = modes.filter((mode) => mode.comps.length > 0);

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Team comps', path: '/comps' },
        ])}
      />

      <PageHeading
        title="Best team comps"
        subtitle="The three-brawler combinations that actually win, by mode. Every comp here was used by at least ten different players, so what you are reading is the comp rather than the squad that likes it."
      />

      {withComps.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          No comps have enough data yet. This fills in as battles are sampled.
        </p>
      ) : null}

      {withComps.map((mode) => {
        const label = modeLabel(modeMeta, mode.mode);
        const slug = slugify(label);
        const meta = modeMeta.get(mode.mode.toLowerCase());

        return (
          <section key={mode.mode} className="space-y-3">
            <SectionHeading
              title={label}
              icon={
                meta?.imageUrl ? (
                  <Image
                    src={meta.imageUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 shrink-0 object-contain"
                    unoptimized
                  />
                ) : null
              }
              aside={
                <Link
                  href={`/comps/${slug}`}
                  className="text-xs font-semibold text-brand transition-colors hover:underline"
                >
                  All {mode.comps.length} comps
                </Link>
              }
            />
            <p className="text-xs text-muted">
              {formatNumber(mode.sampleSize)} sampled battles · the mode averages{' '}
              {formatPercent(mode.baseline)}, and the figure on the right is how far above or below
              that a comp sits.
            </p>
            <CompList
              comps={mode.comps.slice(0, PREVIEW)}
              brawlerMeta={brawlerMeta}
              emptyLabel="No data yet."
            />
          </section>
        );
      })}
    </div>
  );
}
