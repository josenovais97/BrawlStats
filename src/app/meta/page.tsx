import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { CompList } from '@/components/comps/comp-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

import { brawlerIconUrl, getGameModeMap } from '@/lib/brawlapi';
import { getBrawlerArtMap, getBrawlerCatalog } from '@/lib/brawler-catalog';
import { formatNumber, formatPercent } from '@/lib/format';
import { CHANGE_LABEL, changesFromNotes, getLatestReleaseNotes } from '@/lib/release-notes';
import { brawlerPath, slugify } from '@/lib/slugs';
import { getMetaMovers, getTeamComps } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { MetaMover } from '@/types/stats';

/* Daily: the movers are recomputed from each day's snapshot, so a weekly page
   that only changed on Mondays would sit stale for six days out of seven. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'This week in the Brawl Stars meta',
  description:
    'What moved in the Brawl Stars meta this week: the brawlers rising and falling, the tiers they crossed, what the latest update changed, and the team comps winning right now.',
  alternates: { canonical: '/meta' },
};

const SHOWN = 5;

/**
 * The week in one page.
 *
 * Everything here exists elsewhere on the site — the tier list has the scores,
 * the brawler pages have the trends, /comps has the comps. What it does not
 * have anywhere is a *reading*: which of those numbers moved, and whether the
 * update explains it. That is the thing worth publishing weekly, and the thing
 * a reader cannot assemble by opening four pages.
 *
 * Assembled from cached reads rather than its own queries, so the page costs
 * roughly nothing beyond what the tier list already pays for.
 */
export default async function MetaReportPage() {
  const [movers, modes, modeMeta, brawlerMeta, catalogue] = await Promise.all([
    getMetaMovers(7).catch(() => [] as MetaMover[]),
    getTeamComps().catch(() => []),
    getGameModeMap().catch(() => new Map()),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getBrawlerCatalog().catch(() => null),
  ]);

  const notes = await getLatestReleaseNotes().catch(() => null);
  const changes = notes
    ? changesFromNotes(
        notes,
        (catalogue?.current ?? []).map((b) => b.name),
      )
    : [];

  const risers = movers.filter((m) => m.metaScoreDelta > 0).slice(0, SHOWN);
  const fallers = [...movers]
    .filter((m) => m.metaScoreDelta < 0)
    .sort((a, b) => a.metaScoreDelta - b.metaScoreDelta)
    .slice(0, SHOWN);
  const crossings = movers.filter((m) => m.tierNow !== m.tierBefore).slice(0, 6);

  // The single best-evidenced comp from each mode that has any.
  const topComps = modes
    .filter((mode) => mode.comps.length > 0)
    .map((mode) => ({ mode, comp: mode.comps[0] }))
    .slice(0, 4);

  const window = movers[0];

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Meta report', path: '/meta' },
        ])}
      />

      <PageHeading
        title="This week in the meta"
        subtitle={
          window
            ? `What moved between ${window.fromDate} and ${window.toDate}, measured from sampled battles.`
            : 'What moved this week, measured from sampled battles.'
        }
      />

      {movers.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          Not enough comparable snapshots yet. This fills in once a week of daily snapshots has
          been collected under a stable sample.
        </p>
      ) : null}

      {crossings.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading title="Tier changes" />
          <ul className="card divide-y divide-border overflow-hidden">
            {crossings.map((mover) => (
              <li key={mover.brawlerId}>
                <Link
                  href={brawlerPath(mover.brawlerId, mover.brawlerName)}
                  prefetch={false}
                  className="row-interactive flex items-center gap-3 px-4 py-3"
                >
                  <Image
                    src={brawlerMeta.get(mover.brawlerId)?.imageUrl ?? brawlerIconUrl(mover.brawlerId)}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-lg bg-surface-2"
                    loading="lazy"
                    unoptimized
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold capitalize">
                    {mover.brawlerName.toLowerCase()}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    <span className="text-muted">{mover.tierBefore}</span>
                    <span className="mx-1.5 text-muted">→</span>
                    <span
                      className={
                        mover.metaScoreDelta > 0 ? 'text-victory' : 'text-defeat'
                      }
                    >
                      {mover.tierNow}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <MoverColumn title="Rising" movers={risers} brawlerMeta={brawlerMeta} up />
        <MoverColumn title="Falling" movers={fallers} brawlerMeta={brawlerMeta} up={false} />
      </div>

      {changes.length > 0 && notes ? (
        <section className="space-y-3">
          <SectionHeading title="What the update changed" aside={notes.title} />
          <ul className="card divide-y divide-border overflow-hidden">
            {changes.map((change) => (
              <li key={change.category} className="px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {CHANGE_LABEL[change.category]}
                </p>
                <p className="mt-1 text-sm capitalize leading-relaxed">
                  {change.brawlers.map((n) => n.toLowerCase()).join(', ')}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            A brawler listed here has a dashed marker on its own trend chart, so you can see what
            the change actually did.
          </p>
        </section>
      ) : null}

      {topComps.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading
            title="Comps winning now"
            aside={
              <Link
                href="/comps"
                className="text-xs font-semibold text-brand transition-colors hover:underline"
              >
                All comps
              </Link>
            }
          />
          {topComps.map(({ mode, comp }) => {
            const label = modeMeta.get(mode.mode.toLowerCase())?.name ?? mode.mode;
            return (
              <div key={mode.mode} className="space-y-1.5">
                <p className="text-xs font-semibold text-muted">
                  <Link
                    href={`/comps/${slugify(label)}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>{' '}
                  · mode average {formatPercent(mode.baseline)}
                </p>
                <CompList comps={[comp]} brawlerMeta={brawlerMeta} emptyLabel="No data yet." />
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

function MoverColumn({
  title,
  movers,
  brawlerMeta,
  up,
}: {
  title: string;
  movers: MetaMover[];
  brawlerMeta: Map<number, BABrawler>;
  up: boolean;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading title={title} />
      {movers.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Nothing moved enough to report.</p>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {movers.map((mover) => (
            <li key={mover.brawlerId}>
              <Link
                href={brawlerPath(mover.brawlerId, mover.brawlerName)}
                prefetch={false}
                className="row-interactive flex items-center gap-3 px-4 py-3"
              >
                <Image
                  src={brawlerMeta.get(mover.brawlerId)?.imageUrl ?? brawlerIconUrl(mover.brawlerId)}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-lg bg-surface-2"
                  loading="lazy"
                  unoptimized
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold capitalize">
                    {mover.brawlerName.toLowerCase()}
                  </span>
                  <span className="block text-xs tabular-nums text-muted">
                    {formatNumber(mover.sampleSize)} battles · {formatPercent(mover.winRateNow)} win
                    rate
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    up ? 'text-victory' : 'text-defeat'
                  }`}
                >
                  {up ? '+' : '−'}
                  {Math.abs(mover.metaScoreDelta).toFixed(1)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
