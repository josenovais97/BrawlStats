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
  BuffieIcon,
  GadgetIcon,
  GearIcon,
  HyperchargeIcon,
  StarPowerIcon,
} from '@/components/game-icons';
import { gearIconUrl, getBrawler, getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import {
  getBrawlerWiki,
  getGearDescriptions,
  wikiPageUrl,
  type BrawlerWiki,
} from '@/lib/brawler-wiki';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getActiveMaps } from '@/lib/game-maps';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { slugify } from '@/lib/slugs';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  assignTier,
  getBrawlerBuffies,
  getBrawlerBuild,
  getBrawlerPairings,
  getBrawlerSplits,
  getBrawlerStat,
  getBrawlerTrend,
  getHyperChargeOwnership,
  getMetaIndex,
  normalizeWinRate,
} from '@/lib/stats';
import type { BAAccessory, BABrawler } from '@/types/brawlapi';
import type { BSAccessory } from '@/types/brawlstars';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Rendered on demand, never pre-rendered: each page makes a ranking call, and
 * doing that once per brawler during a build risks tripping the API rate limit.
 *
 * Six hours rather than the day this used to be. The page cache is the binding
 * constraint on freshness — a shorter TTL on the wiki fetch underneath it does
 * nothing while the HTML itself is a day old — and a day is the wrong window
 * for two things on this page: combat stats, which move on balance-patch day
 * and are most wrong exactly when they matter most, and our own win rates,
 * which the sampler already recomputes four to six times a day.
 *
 * The cost is one ranking call per brawler per regeneration: ~430 a day across
 * the roster against the ~4,200 the sampler already makes, and only for pages
 * someone actually opens.
 */
export const revalidate = 21600;

/**
 * Balance changes shown, newest first.
 *
 * A brawler can carry ninety of them going back to 2017; the recent ones are
 * what tells a reader whether the numbers above just moved.
 */
const BALANCE_CHANGES_SHOWN = 8;

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
  // Combat stats and resolved ability text. Nothing else publishes these —
  // see lib/brawler-wiki. Null costs the sections that use it, not the page.
  const metaIndex = await getMetaIndex('ranked', 7);
  const catalogEntry = (await getBrawlerCatalog()).byId.get(brawlerId);
  const wiki = await getBrawlerWiki(brawler.name).catch(() => null);
  // One page for the whole game, so this is shared across every brawler.
  const gearText = await getGearDescriptions().catch(() => new Map<string, string>());
  const buffies = await getBrawlerBuffies(brawlerId);
  const hyperChargeOwnership = await getHyperChargeOwnership(brawlerId);

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
  // Tier and meta score come from the same scoring pass the tier lists use, so
  // the chip here cannot disagree with the chip there. Falls back to scoring
  // this brawler's own row when it is not in the index at all.
  const scored = metaIndex.get(brawlerId);
  const tier =
    scored?.tier ??
    (stat && stat.decidedSampleSize >= MIN_SAMPLE_FOR_TIER
      ? assignTier(normalizedWinRate)
      : null);
  const metaScore = scored?.metaScore ?? null;

  /*
   * The artwork source ships at least one malformed colour — Pierce's rarity
   * is "#fff11ev" — and an invalid value inside `color-mix()` drops the whole
   * declaration, taking the header wash with it. Anything that is not a plain
   * hex colour falls back to the neutral accent.
   */
  const rarityColor = brawler.rarity?.color;
  const accent =
    rarityColor && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(rarityColor)
      ? rarityColor
      : '#8b95b8';
  const name = titleCase(brawler.name);

  // "Unknown" is a real value upstream, not a missing one: unclassified
  // brawlers come back as `{ id: 0, name: "Unknown" }`, and a chip reading
  // "Unknown" says less than no chip at all.
  // The artwork source says "Unknown" for every recent brawler; the wiki
  // infobox has the real class, and that page is already fetched above.
  const className =
    (brawler.class?.name && brawler.class.name !== 'Unknown'
      ? brawler.class.name
      : null) ?? wiki?.stats.className ?? null;
  const rarityName =
    (brawler.rarity?.name && brawler.rarity.name !== 'Unknown'
      ? brawler.rarity.name
      : null) ?? wiki?.stats.rarityName ?? null;
  const isLegacy = catalogEntry?.status === 'legacy';

  // A buffie is named for the ability type it upgrades, so each one is listed
  // against the gadget or star power it actually changes.
  const buffieEffects: { kind: string; ability: string; effect: string }[] = [];
  for (const [kind, items] of [
    ['Gadget', gadgets],
    ['Star power', starPowers],
  ] as const) {
    for (const item of items) {
      const effect = wiki?.abilities.get(slugify(item.name))?.buffie;
      if (effect) buffieEffects.push({ kind, ability: item.name, effect });
    }
  }
  if (wiki?.hypercharge?.buffie) {
    buffieEffects.push({
      kind: 'Hypercharge',
      ability: wiki.hypercharge.name,
      effect: wiki.hypercharge.buffie,
    });
  }

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
                {rarityName ?? 'Brawler'}
              </span>
              {isLegacy ? (
                <span
                  className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted"
                  title="No longer available in the game. This page is kept for its history."
                >
                  Legacy
                </span>
              ) : null}
              {className ? (
                <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                  {className}
                </span>
              ) : null}
              {tier ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: `color-mix(in srgb, ${TIER_COLOR[tier]} 20%, transparent)`,
                    color: TIER_COLOR[tier],
                  }}
                >
                  {tier} tier
                  {/* The score the tier is assigned from, on the card rather
                      than three sections down: it is what the tier lists rank
                      by, and a bare letter hides how close the call was. */}
                  {metaScore !== null ? (
                    <span className="tabular-nums opacity-80">
                      {metaScore.toFixed(1)}
                    </span>
                  ) : null}
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

      {wiki && wiki.stats.health ? (
        <section>
          <SectionHeading
            title="Combat stats"
            subtitle="Base values at Power 11, before gears and star powers."
          />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ['Health', wiki.stats.health],
                [wiki.stats.attackLabel ?? 'Attack', wiki.stats.attack],
                [wiki.stats.superLabel ?? 'Super', wiki.stats.super],
                ['Reload', wiki.stats.reload],
                ['Range', wiki.stats.attackRange],
                ['Speed', wiki.stats.movementSpeed],
              ] as const
            )
              // Not every brawler has every stat: a super that deals no direct
              // damage has no super damage, and the infobox simply omits it.
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => {
                const { main, hint } = splitStat(value!);
                return (
                  <div key={label} className="card p-3">
                    <dt className="truncate text-xs font-medium uppercase tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-lg font-bold leading-tight tabular-nums">
                      {main}
                    </dd>
                    {hint ? (
                      <dd className="text-xs leading-tight text-muted">{hint}</dd>
                    ) : null}
                  </div>
                );
              })}
          </dl>
        </section>
      ) : null}

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
        <SectionHeading
          title="Upgrade ownership"
          subtitle="Which upgrades sampled owners have unlocked. The API never reports what anyone equips in a battle, so this is ownership — not usage."
        />
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
          wiki={wiki}
        />
        <AccessoryList
          title="Gadgets"
          node={<GadgetIcon className="size-5" />}
          items={gadgets}
          emptyLabel="No gadgets released."
          wiki={wiki}
        />
      </section>

      {gears.length > 0 || hyperCharges.length > 0 || buffies || buffieEffects.length > 0 ? (
        <section className="grid gap-6 lg:grid-cols-2">
          {gears.length > 0 ? (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
                <GearIcon className="size-5" />
                Gears
              </h2>
              <ul className="card grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                {gears.map((gear) => (
                  <li key={gear.id} className="flex gap-2">
                    <Image
                      src={gearIconUrl(gear.id)}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 object-contain"
                      loading="lazy"
                      unoptimized
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium capitalize">
                        {gear.name.toLowerCase()}
                      </span>
                      {/* The catalogue names a gear but never says what it
                          does, which left this list as six bare words. */}
                      {gearText.get(slugify(gear.name)) ? (
                        <span className="block text-xs leading-snug text-muted">
                          {gearText.get(slugify(gear.name))}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Every gear this brawler can equip, from the official catalogue. Which
                ones sampled owners have unlocked is above — which is not the same as
                which they equip, since the API never reports that.
              </p>
            </div>
          ) : null}

          {hyperCharges.length > 0 || buffies ? (
            <div className="space-y-6">
              {hyperCharges.length > 0 ? (
                <div>
                  <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <HyperchargeIcon className="size-6" />
                    Hypercharge
                  </h2>
                  <ul className="card divide-y divide-border">
                    {hyperCharges.map((hyper) => (
                      <li key={hyper.id} className="flex items-center gap-4 p-4">
                        {/* The game's own hypercharge mark, shipped with the
                            site. There is no per-hypercharge artwork to use:
                            the artwork CDN has no hypercharge set under any
                            path, so one icon stands for the ability. */}
                        <span
                          className="grid size-12 shrink-0 place-items-center rounded-xl"
                          style={{
                            background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                          }}
                        >
                          <HyperchargeIcon className="size-7" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold capitalize">
                            {hyper.name.toLowerCase()}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-muted">
                            {wiki?.hypercharge?.description ??
                              `Unlocked at Power 11. Charges from dealing and taking damage, then boosts ${name}'s speed, damage and shield for a few seconds.`}
                            {hyperChargeOwnership !== null
                              ? ` ${formatPercent(hyperChargeOwnership)} of sampled owners have unlocked it.`
                              : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!wiki?.hypercharge?.description ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      The exact boost percentages vary per brawler and are not published
                      by the game API or by any artwork source, so they are not listed
                      here.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {buffies || buffieEffects.length > 0 ? (
                <div>
                  <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <BuffieIcon className="size-6" />
                    Buffies
                  </h2>

                  {/*
                    What each buffie does, per ability — the question the
                    ownership percentages never answered. A brawler has one
                    buffie per ability type, but its effect differs by which
                    gadget or star power it is buffing, so they are listed
                    against the ability rather than as three flat rows.
                  */}
                  {buffieEffects.length > 0 ? (
                    <ul className="card divide-y divide-border overflow-hidden">
                      {buffieEffects.map((entry) => (
                        <li key={`${entry.kind}-${entry.ability}`} className="p-4">
                          <p className="flex flex-wrap items-baseline gap-2">
                            <span className="font-semibold capitalize">
                              {entry.ability.toLowerCase()}
                            </span>
                            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-muted">
                              {entry.kind}
                            </span>
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-muted">
                            {entry.effect}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (buffies?.none ?? true) ? (
                    <p className="card px-4 py-3 text-sm text-muted">
                      <span className="font-semibold text-foreground">Unreleased.</span>{' '}
                      {name} has no buffies yet.
                    </p>
                  ) : (
                    /* Our own samples say buffies exist here, but the wiki has
                       no text for them — a brand-new release, most likely. */
                    <p className="card px-4 py-3 text-sm text-muted">
                      <span className="font-semibold text-foreground">Released.</span>{' '}
                      {name} has buffies, but their effects have not been documented
                      yet.
                    </p>
                  )}
                </div>
              ) : null}
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

      {wiki && wiki.history.length > 0 ? (
        <section>
          <SectionHeading
            title="Balance history"
            subtitle={`The last changes Supercell made to ${name}. Cosmetic releases are left out.`}
            aside={`${wiki.history.length} recorded`}
          />
          <ol className="card divide-y divide-border overflow-hidden">
            {wiki.history.slice(0, BALANCE_CHANGES_SHOWN).map((change, index) => (
              <li
                key={`${change.date}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="w-20 shrink-0 text-xs tabular-nums text-muted">
                  {change.date}
                </span>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ${
                    change.kind === 'Buff'
                      ? 'bg-victory/15 text-victory'
                      : change.kind === 'Nerf'
                        ? 'bg-defeat/15 text-defeat'
                        : 'bg-surface-2 text-muted'
                  }`}
                >
                  {change.kind}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-relaxed">
                  {change.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {wiki ? (
        /* Attribution, once, for everything on this page that came from the
           wiki: the combat stats, the resolved ability text, the hypercharge
           effect and the buffie effects. Their text is CC-BY-SA. */
        <p className="text-xs leading-relaxed text-muted">
          Combat stats, ability and gear descriptions, hypercharge and buffie effects,{' '}
          and balance history from the{' '}
          <a
            href={wikiPageUrl(wiki.title)}
            rel="noreferrer noopener"
            target="_blank"
            className="font-medium text-brand hover:underline"
          >
            Brawl Stars Wiki
          </a>
          , CC-BY-SA. Win rates, pick rates and matchups are our own.
        </p>
      ) : null}

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

/**
 * Splits a wiki stat into a headline number and its qualifier.
 *
 * The infobox writes these as one string — "0.7 seconds (Very Fast)",
 * "7.67 (Long)" — which at heading size in a six-across grid truncated to
 * something unreadable on every card. The parenthetical is the part that can
 * wrap to a second line, and "seconds" shortens to "s" so the number itself
 * always fits.
 */
function splitStat(value: string): { main: string; hint: string | null } {
  const match = /^(.*?)\s*\((.+)\)\s*$/.exec(value);
  const main = (match ? match[1] : value).replace(/\s*seconds?$/i, 's');
  return { main: main.trim() || value, hint: match ? match[2].trim() : null };
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
  wiki,
}: {
  title: string;
  node: React.ReactNode;
  items: BAAccessory[];
  emptyLabel: string;
  wiki: BrawlerWiki | null;
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
                  {/*
                    The wiki's copy of the in-game text has its numbers filled
                    in; the artwork source ships the same sentence with the
                    game's own placeholders still in it, which we can only
                    render as "?". Prefer the readable one, fall back to ours.
                  */}
                  {wiki?.abilities.get(slugify(item.name))?.description ?? item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
