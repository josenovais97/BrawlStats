import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import { type HiddenPick, type MapEdgePick, getHiddenMeta } from '@/lib/hidden-meta';
import { brawlerPath, slugify } from '@/lib/slugs';
import { titleCaseLabel } from '@/lib/format';

/**
 * The four questions the tier list does not answer.
 *
 * A tier list ranks by strength, so it is answered entirely by the top of one
 * column and everything interesting underneath is invisible: the brawler that
 * wins and nobody plays, the one everybody plays that does not win, and the
 * two map-specific versions of the same gap.
 *
 * All of it comes from numbers already on the site. That is the point -- this
 * is not a second opinion about the meta, it is the same measurements asked a
 * different question, which is why every card carries its sample.
 *
 * Matched to the tier list's own cadence: the underlying reads are the scored
 * roster and the ranked map picks, both of which move when the sampler runs.
 * A longer revalidate here would serve numbers that disagree with
 * /tier-list/ranked, which is the one thing this page cannot afford -- see
 * AGENTS.md trap 2 on a route's revalidate being the shortest cache inside it.
 */

export const revalidate = 10800;

export const metadata: Metadata = {
  title: 'Underrated and overrated Brawl Stars brawlers',
  description:
    'Who is everyone sleeping on. Strong brawlers almost nobody picks, popular brawlers the results do not justify, and the map-specific gems and traps the overall tier list hides — measured from sampled ranked battles, not opinion.',
  alternates: { canonical: '/hidden-meta' },
};

function Row({
  pick,
  right,
  sub,
}: {
  pick: HiddenPick;
  right: React.ReactNode;
  sub: string;
}) {
  return (
    <li>
      <Link
        href={brawlerPath(pick.brawlerId, pick.brawlerName)}
        prefetch={false}
        className="row-interactive flex items-center gap-3 px-4 py-3"
      >
        <Image
          src={pick.imageUrl ?? brawlerIconUrl(pick.brawlerId)}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg bg-surface-2"
          loading="lazy"
          unoptimized
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold capitalize">
            {pick.brawlerName.toLowerCase()}
          </span>
          <span className="block text-xs tabular-nums text-muted">{sub}</span>
        </span>
        <span className="shrink-0 text-right">{right}</span>
      </Link>
    </li>
  );
}

function Section({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading title={title} subtitle={subtitle} />
      {empty ? (
        /* An empty section is a real answer and says so, rather than being
           hidden. "Nothing qualifies this week" is information: it means the
           meta is being played roughly the way it measures. */
        <p className="card p-4 text-sm leading-relaxed text-muted">
          Nothing clears the bar this week, which means the meta is being played roughly the way
          it measures.
        </p>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">{children}</ul>
      )}
    </section>
  );
}

const mapHref = (e: MapEdgePick) => `/maps/${slugify(e.mode)}/${slugify(e.mapName)}`;

export default async function HiddenMetaPage() {
  const data = await getHiddenMeta().catch(() => null);

  if (!data) {
    return (
      <div className="space-y-8">
        <PageHeading
          title="The hidden meta"
          subtitle="Who is everyone sleeping on, measured from sampled ranked battles."
        />
        <p className="card p-6 text-sm leading-relaxed text-muted">
          Not enough sampled battles yet to answer this honestly. It fills in once enough
          brawlers clear the sample floor.
        </p>
      </div>
    );
  }

  const { sleepers, overrated, gems, traps, cuts, rated, windowDays } = data;

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Hidden meta', path: '/hidden-meta' },
        ])}
      />

      <PageHeading
        title="The hidden meta"
        subtitle={`Who is everyone sleeping on. Read from ${rated} brawlers with enough ranked battles to judge, over the last ${windowDays} days.`}
      />

      <Section
        title="Sleeper picks"
        subtitle={`Strong, and almost nobody picks them — under ${formatPercent(cuts.lowUsage)} pick rate.`}
        empty={sleepers.length === 0}
      >
        {sleepers.map((p) => (
          <Row
            key={p.brawlerId}
            pick={p}
            sub={`${formatPercent(p.winRate)} win rate · ${formatPercent(p.usageRate)} picked · ${formatNumber(p.sampleSize)} battles`}
            right={
              <span className="text-lg font-black tabular-nums text-brand">
                {p.metaScore.toFixed(1)}
              </span>
            }
          />
        ))}
      </Section>

      <Section
        title="Overrated"
        subtitle={`Everybody picks them and the results do not justify it — over ${formatPercent(cuts.highUsage)} pick rate.`}
        empty={overrated.length === 0}
      >
        {overrated.map((p) => (
          <Row
            key={p.brawlerId}
            pick={p}
            sub={`${formatPercent(p.winRate)} win rate · ${formatNumber(p.sampleSize)} battles`}
            right={
              <span className="text-lg font-black tabular-nums text-foreground">
                {formatPercent(p.usageRate)}
              </span>
            }
          />
        ))}
      </Section>

      <Section
        title="Hidden gems"
        subtitle="Far better on one map than their overall form suggests. The number is win-rate points above their own average, so general strength is already taken out."
        empty={gems.length === 0}
      >
        {gems.map((e) => (
          <Row
            key={`${e.brawlerId}-${e.mapName}`}
            pick={e}
            sub={`${titleCaseLabel(e.mapName)} · ${formatNumber(e.sampleSize)} battles on this map`}
            right={
              <span className="text-lg font-black tabular-nums text-emerald-400">
                +{(e.edge * 100).toFixed(1)} pts
              </span>
            }
          />
        ))}
      </Section>

      <Section
        title="Trap picks"
        subtitle="Fine overall, but losing win-rate points on a map that is in rotation right now."
        empty={traps.length === 0}
      >
        {traps.map((e) => (
          <Row
            key={`${e.brawlerId}-${e.mapName}`}
            pick={e}
            sub={`${titleCaseLabel(e.mapName)} · ${formatNumber(e.sampleSize)} battles on this map`}
            right={
              <span className="text-lg font-black tabular-nums text-rose-400">
                {(e.edge * 100).toFixed(1)} pts
              </span>
            }
          />
        ))}
      </Section>

      {/* The working, because the whole claim of the page is that it is
          measured rather than asserted. The cuts move with the roster, so a
          fixed number in this paragraph would rot -- they are printed live. */}
      <section className="space-y-3">
        <SectionHeading title="How this is decided" />
        <div className="card space-y-2 p-5 text-sm leading-relaxed text-muted">
          <p>
            Every brawler here has at least 300 decided ranked battles. These lists are selected
            extremes, and picking a maximum out of many small samples produces extremes by
            accident rather than by merit — the floor is what stops that.
          </p>
          <p>
            &ldquo;Low pick rate&rdquo; and &ldquo;strong&rdquo; are percentiles of the live
            roster, not fixed numbers, so the question stays the same while the answers move.
            Today they resolve to under {formatPercent(cuts.lowUsage)} picked and a rating of{' '}
            {cuts.strong.toFixed(1)} or better.
          </p>
          <p>
            Map gems and traps compare a brawler&rsquo;s score on one map against its own overall
            form, so the list is not a second copy of the{' '}
            <Link href="/tier-list/ranked" className="font-medium text-brand hover:underline">
              tier list
            </Link>
            . Only maps currently in rotation are included.
          </p>
          <p>
            {gems.length > 0 ? (
              <Link href={mapHref(gems[0])} className="font-medium text-brand hover:underline">
                See every pick on {titleCaseLabel(gems[0].mapName)}
              </Link>
            ) : null}
          </p>
        </div>
      </section>
    </div>
  );
}
