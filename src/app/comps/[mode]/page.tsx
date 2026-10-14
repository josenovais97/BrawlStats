import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CompList } from '@/components/comps/comp-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';

import { getGameModeMap, modeLabel } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { formatNumber, formatPercent } from '@/lib/format';
import { slugify } from '@/lib/slugs';
import { getTeamComps, type ModeComps } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

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
): Promise<{ comps: ModeComps; label: string; slug: string; icon?: string } | null> {
  const [modes, modeMeta] = await Promise.all([
    getTeamComps().catch(() => []),
    getGameModeMap().catch(() => new Map()),
  ]);

  const wanted = slugify(slug);
  for (const mode of modes) {
    const label = modeLabel(modeMeta, mode.mode);
    if (slugify(label) === wanted) {
      return {
        comps: mode,
        label,
        slug: wanted,
        icon: modeMeta.get(mode.mode.toLowerCase())?.imageUrl,
      };
    }
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getT(requestLocale());
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) return { title: t('Team comps') };

  return {
    title: t('Best {label} comps in Brawl Stars', { label: resolved.label }),
    description: t('The three-brawler compositions with the best records in Brawl Stars {label}, measured from sampled battles over the last 14 days.', { label: resolved.label }),
    alternates: { canonical: `/comps/${resolved.slug}` },
  };
}

export default async function ModeCompsPage({ params }: PageProps) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
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
        href={lp('/comps')}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />{t('All modes')}</Link>

      <PageHeading
        eyebrow={
          resolved.icon ? (
            <span className="inline-flex items-center gap-2">
              <Image
                src={resolved.icon}
                alt=""
                width={18}
                height={18}
                className="size-[18px] shrink-0 object-contain"
                unoptimized
              />
              {t(resolved.label)}
            </span>
          ) : (
            resolved.label
          )
        }
        title={t('Best {label} comps', { label: resolved.label })}
        subtitle={t('Ranked by how far each trio sits above the mode\'s own average of {baseline}, from {sampleSize} sampled battles over the last 14 days.', { baseline: formatPercent(
          comps.baseline,
        ), sampleSize: formatNumber(comps.sampleSize) })}
      />

      <CompList
        comps={comps.comps}
        brawlerMeta={brawlerMeta}
        emptyLabel={t('Not enough data for this mode yet.')}
      />

      <p className="text-xs leading-relaxed text-muted">{t('A comp appears here once at least fifteen different players have used it across at least forty decided battles. The player floor matters more than the battle count: a squad that queues together brings the same trio every game, so without it the list ranks strong teams rather than strong comps. Ranked and ladder battles both count.')}</p>
    </div>
  );
}
