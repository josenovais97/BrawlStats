import type { Metadata } from 'next';
import { ArrowLeft, BarChart3, Sparkles, Trophy, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { BrawlerLeaderboard } from '@/components/brawlers/brawler-leaderboard';
import { BrawlerMatchups } from '@/components/brawlers/brawler-matchups';
import { BrawlerSplits } from '@/components/brawlers/brawler-splits';
import { BrawlerTrend } from '@/components/brawlers/brawler-trend';
import { PopularBuild } from '@/components/brawlers/popular-build';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatCard } from '@/components/ui/stat-card';
import { TableSkeleton } from '@/components/ui/skeletons';
import {
  GadgetIcon,
  GearIcon,
  HyperchargeIcon,
  StarPowerIcon,
} from '@/components/game-icons';
import { gearIconUrl, getBrawler, getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import { getActiveMaps } from '@/lib/game-maps';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { slugify } from '@/lib/slugs';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  assignTier,
  getBrawlerBuild,
  getBrawlerPairings,
  getBrawlerSplits,
  getBrawlerStat,
  getBrawlerTrend,
  normalizeWinRate,
} from '@/lib/stats';
import type { BAAccessory, BABrawler } from '@/types/brawlapi';
import type { BSAccessory } from '@/types/brawlstars';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Rendered on demand and cached for a day, rather than pre-rendering all ~90
 * brawlers at build time — each page makes a ranking call, and doing that once
 * per brawler during a build risks tripping the API rate limit.
 */
export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const brawlerId = Number(id);
  const brawler = await getBrawler(brawlerId).catch(() => undefined);
  if (!brawler) return { title: 'Brawler' };

  const name = titleCase(brawler.name);
  const stat = await getBrawlerStat(brawlerId);
  const adjusted = stat
    ? normalizeWinRate(stat.winRate, stat.baselineWinRate, stat.decidedSampleSize)
    : null;

  /*
   * The flavour text used to be the description, and it carries no search
   * intent at all — "Edgar believes nobody understands him" answers nothing
   * anyone typed. What people want from a snippet is the number, so the number
   * leads whenever there is one.
   */
  const description =
    stat && adjusted !== null
      ? `${name} has a ${formatPercent(adjusted)} adjusted win rate and ${formatPercent(stat.usageRate)} pick rate in Brawl Stars, from ${formatNumber(stat.decidedSampleSize)} sampled battles. Best modes and maps, star powers, gadgets, gears and the most popular build.`
      : `${name} in Brawl Stars: star powers, gadgets, gears, the most popular build and where the brawler performs best, from sampled battles.`;

  return {
    // The brawler's name alone loses to every wiki and fan site. People search
    // "shelly brawl stars", so the title carries both.
    title: `${name} — Brawl Stars stats, build and best maps`,
    description,
    alternates: { canonical: `/brawlers/${id}` },
    openGraph: {
      title: `${name} — Brawl Stars stats and build`,
      description,
    },
  };
}

export default async function BrawlerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const brawlerId = Number(id);

  if (!Number.isFinite(brawlerId)) {
    return (
      <ErrorState
        code="notFound"
        title="Unknown brawler"
        detail="That brawler id is not valid."
        backHref="/brawlers"
        backLabel="Back to brawlers"
      />
    );
  }

  const brawler = await getBrawler(brawlerId).catch(() => undefined);

  if (!brawler) {
    return (
      <ErrorState
        code="notFound"
        title="Brawler not found"
        detail="No brawler exists with that id."
        backHref="/brawlers"
        backLabel="Back to brawlers"
      />
    );
  }

  // Sequential database reads keep the page to a single connection.
  const stat = await getBrawlerStat(brawlerId);
  const build = await getBrawlerBuild(brawlerId);

  // The official catalogue is the authority on which kit belongs to whom, and
  // it is also the only place gear names appear.
  const official = await getOfficialBrawlers()
    .then((r) => r.items.find((b) => b.id === brawlerId))
    .catch(() => undefined);

  const gearNames = new Map((official?.gears ?? []).map((g) => [g.id, g.name]));
  const starPowers = ownedBy(brawler.starPowers, official?.starPowers);
  const gadgets = ownedBy(brawler.gadgets, official?.gadgets);
  const gears = official?.gears ?? [];
  const hyperCharges = official?.hyperCharges ?? [];

  // Where the brawler is strong, how it has moved, and who it beats. All three
  // degrade to empty on their own, so a missing database costs sections rather
  // than the page.
  const splits = await getBrawlerSplits(brawlerId);
  const trend = await getBrawlerTrend(brawlerId);
  const pairings = await getBrawlerPairings(brawlerId);

  // Maps come and go from rotation; a split naming a retired one still has a
  // real record behind it, so the row stays and only the link is dropped.
  const activeMaps = await getActiveMaps().catch(() => []);
  const brawlerMeta = await getBrawlerMap().catch(() => new Map<number, BABrawler>());

  const normalizedWinRate = stat
    ? normalizeWinRate(stat.winRate, stat.baselineWinRate, stat.decidedSampleSize)
    : null;
  const tier =
    stat && stat.decidedSampleSize >= MIN_SAMPLE_FOR_TIER
      ? assignTier(normalizedWinRate)
      : null;
  const accent = brawler.rarity?.color ?? '#8b95b8';
  const name = titleCase(brawler.name);

  // Built from what the page renders, never in addition to it: a FAQ block
  // that only exists in the markup is the thing Google demotes sites for, and
  // it would also be a lie to the reader.
  const faq = [
    {
      question: `Is ${name} good in Brawl Stars?`,
      answer:
        stat && normalizedWinRate !== null
          ? `${name} has a ${formatPercent(normalizedWinRate)} adjusted win rate and a ${formatPercent(stat.usageRate)} pick rate over ${formatNumber(stat.decidedSampleSize)} sampled decided battles${tier ? `, which puts it in ${tier} tier` : ''}.`
          : `${name} has not been sampled enough yet for a win rate. The tier lists cover every brawler with enough battles behind it.`,
    },
    ...(splits.modes.length > 0
      ? [
          {
            question: `What is the best mode for ${name}?`,
            answer: `${name} performs best in ${humanizeMode(splits.modes[0].mode)}, with a ${formatPercent(splits.modes[0].winRate)} raw win rate over ${formatNumber(splits.modes[0].decidedSampleSize)} sampled battles there.`,
          },
        ]
      : []),
    ...(splits.maps.length > 0 && splits.maps[0].mapName
      ? [
          {
            question: `What is the best map for ${name}?`,
            answer: `${splits.maps[0].mapName} (${humanizeMode(splits.maps[0].mode)}) is where ${name} has the strongest sampled record, at ${formatPercent(splits.maps[0].winRate)} over ${formatNumber(splits.maps[0].decidedSampleSize)} battles.`,
          },
        ]
      : []),
    ...(pairings && pairings.weakAgainst.length > 0
      ? [
          {
            question: `What counters ${name}?`,
            answer: `${pairings.weakAgainst
              .slice(0, 3)
              .map((p) => titleCase(brawlerMeta.get(p.brawlerId)?.name ?? `#${p.brawlerId}`))
              .join(', ')} pull ${name} furthest below its own ${formatPercent(pairings.baseline)} average in sampled team battles.`,
          },
        ]
      : []),
    {
      question: `What star powers and gadgets does ${name} have?`,
      answer: `${name} has ${listOf(starPowers.map((a) => titleCase(a.name)))} as star powers and ${listOf(gadgets.map((a) => titleCase(a.name)))} as gadgets.`,
    },
  ];

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Brawlers', path: '/brawlers' },
          { name, path: `/brawlers/${brawlerId}` },
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <Link
        href="/brawlers"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All brawlers
      </Link>

      {/* The rarity colour used to be a one-pixel rule, which made a hundred
          brawler pages look like one template with a different portrait. It now
          washes the header and tints the portrait's plate, so an Epic reads as
          purple at a glance and a Legendary as gold. */}
      <header className="card card-glow relative overflow-hidden">
        <span className="block h-1 w-full" style={{ background: accent }} />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 12% 0%, color-mix(in srgb, ${accent} 26%, transparent) 0%, transparent 62%)`,
          }}
        />
        <div className="relative flex flex-wrap items-center gap-6 p-6">
          <Image
            src={brawler.imageUrl}
            alt={brawler.name}
            width={144}
            height={144}
            sizes="(max-width: 640px) 128px, 144px"
            className="size-32 shrink-0 rounded-2xl object-contain sm:size-36"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
            }}
            priority
            unoptimized
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                  color: accent,
                }}
              >
                {brawler.rarity?.name ?? 'Unknown'}
              </span>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                {brawler.class?.name ?? 'Unknown'}
              </span>
              {tier ? (
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: `color-mix(in srgb, ${TIER_COLOR[tier]} 20%, transparent)`,
                    color: TIER_COLOR[tier],
                  }}
                >
                  {tier} tier
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-4xl font-black capitalize tracking-tight">
              {brawler.name.toLowerCase()}
            </h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted">
              {brawler.description}
            </p>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Performance</h2>
        {stat ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={BarChart3}
              label="Win rate"
              value={formatPercent(normalizedWinRate)}
              hint={`${formatNumber(stat.decidedSampleSize)} battles`}
              tone="text-victory"
            />
            <StatCard
              icon={Users}
              label="Pick rate"
              value={formatPercent(stat.usageRate)}
              hint="Last 7 days"
              tone="text-accent"
            />
            <StatCard
              icon={Trophy}
              label="Avg trophies"
              value={
                stat.avgTrophies === null ? '—' : formatNumber(Math.round(stat.avgTrophies))
              }
              hint="Across tracked players"
            />
            <StatCard
              icon={Sparkles}
              label="Avg rank"
              value={stat.avgRank === null ? '—' : stat.avgRank.toFixed(1)}
              hint="Across tracked players"
            />
          </div>
        ) : (
          /* An empty state that ends the visit is a wasted one. This says what
             is missing and offers the two pages that do have an answer. */
          <div className="card p-6">
            <p className="text-sm leading-relaxed text-muted">
              Not enough sampled battles for {name} yet. The sampler works through the
              global leaderboard pool continuously, so newly released brawlers fill in
              over the following days.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/tier-list/ranked"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
              >
                Ranked tier list
              </Link>
              <Link
                href="/brawlers"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
              >
                Browse all brawlers
              </Link>
            </div>
          </div>
        )}

        {trend.length > 0 ? (
          <div className="mt-3">
            <BrawlerTrend points={trend} accent={accent} />
          </div>
        ) : null}
      </section>

      {splits.modes.length > 0 || splits.maps.length > 0 ? (
        <section>
          <SectionHeading
            title="Where it performs"
            subtitle="Each mode and map is scored against its own average, so a showdown record and a gem grab one can be read in the same list."
          />
          <BrawlerSplits
            modes={splits.modes}
            maps={splits.maps}
            mapSlugFor={(split) => {
              const match = activeMaps.find(
                (m) =>
                  m.mapSlug === slugify(split.mapName ?? '') &&
                  m.scHash === split.mode,
              );
              return match ? `/maps/${match.modeSlug}/${match.mapSlug}` : null;
            }}
          />
        </section>
      ) : null}

      {pairings ? (
        <section>
          <SectionHeading
            title="Matchups"
            subtitle={`Which brawlers ${name.toLowerCase()} beats, which ones win the matchup, and who to draft alongside.`}
          />
          <BrawlerMatchups
            pairings={pairings}
            brawlerName={brawler.name}
            brawlerMeta={brawlerMeta}
          />
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Popular build</h2>
        <PopularBuild
          build={build}
          meta={{ ...brawler, starPowers, gadgets }}
          gearNames={gearNames}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <AccessoryList
          title="Star powers"
          node={<StarPowerIcon className="size-5" />}
          items={starPowers}
          emptyLabel="No star powers released."
        />
        <AccessoryList
          title="Gadgets"
          node={<GadgetIcon className="size-5" />}
          items={gadgets}
          emptyLabel="No gadgets released."
        />
      </section>

      {gears.length > 0 || hyperCharges.length > 0 ? (
        <section className="grid gap-6 lg:grid-cols-2">
          {gears.length > 0 ? (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
                <GearIcon className="size-5" />
                Gears
              </h2>
              <ul className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                {gears.map((gear) => (
                  <li key={gear.id} className="flex items-center gap-2">
                    <Image
                      src={gearIconUrl(gear.id)}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 object-contain"
                      loading="lazy"
                      unoptimized
                    />
                    <span className="min-w-0 truncate text-sm font-medium capitalize">
                      {gear.name.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Every gear this brawler can equip, from the official catalogue. Which
                ones players actually run is in the popular build above.
              </p>
            </div>
          ) : null}

          {hyperCharges.length > 0 ? (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
                <HyperchargeIcon className="size-5" />
                Hypercharge
              </h2>
              <ul className="card divide-y divide-border">
                {hyperCharges.map((hyper) => (
                  <li key={hyper.id} className="p-4">
                    <p className="font-bold capitalize">{hyper.name.toLowerCase()}</p>
                    {/* No description and no artwork: the official API publishes
                        the name only, and the artwork CDN has no hypercharge
                        set at all. Stating that beats an empty card. */}
                    <p className="mt-1 text-sm text-muted">
                      Unlocked at power 11. Neither the game API nor the artwork source
                      publishes hypercharge effects, so only the name is available.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">
          Top players with {brawler.name.toLowerCase()}
        </h2>
        <Suspense fallback={<TableSkeleton rows={5} />}>
          <BrawlerLeaderboard brawlerId={brawlerId} />
        </Suspense>
      </section>

      <section>
        <SectionHeading title={`${name} FAQ`} />
        <dl className="card divide-y divide-border">
          {faq.map((item) => (
            <div key={item.question} className="p-4">
              <dt className="font-semibold">{item.question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/**
 * The artwork source occasionally lists an accessory under the wrong brawler
 * (Bolt carries two of Brock's gadgets), so membership is taken from the
 * official catalogue and the artwork source only supplies the art. Falls back
 * to the artwork source when the official entry is missing, which is the case
 * for limited-time brawlers it never lists.
 */
function ownedBy(items: BAAccessory[], official: BSAccessory[] | undefined): BAAccessory[] {
  if (!official?.length) return items;
  const allowed = new Set(official.map((a) => a.id));
  return items.filter((item) => allowed.has(item.id));
}

/** "HARD LANDING" -> "Hard Landing", for prose that quotes an API name. */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase());
}

/** ["A", "B", "C"] -> "A, B and C". Returns "none yet" for an empty list. */
function listOf(items: string[]): string {
  if (items.length === 0) return 'none yet';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function AccessoryList({
  title,
  node,
  items,
  emptyLabel,
}: {
  title: string;
  node: React.ReactNode;
  items: BAAccessory[];
  emptyLabel: string;
}) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
        {node}
        {title}
      </h2>

      {items.length === 0 ? (
        <p className="card p-6 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="card flex gap-4 p-4">
              <Image
                src={item.imageUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 object-contain"
                unoptimized
              />
              <div className="min-w-0">
                <p className="font-bold capitalize">{item.name.toLowerCase()}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {/* Descriptions carry inline markup tokens; the plain text field is safe to render as-is. */}
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
