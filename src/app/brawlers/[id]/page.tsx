import type { Metadata } from 'next';
import { ArrowLeft, BarChart3, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { BrawlerLeaderboard } from '@/components/brawlers/brawler-leaderboard';
import { BrawlerMatchups } from '@/components/brawlers/brawler-matchups';
import { BrawlerSplits } from '@/components/brawlers/brawler-splits';
import { BrawlerTrend } from '@/components/brawlers/brawler-trend';
import { BuildAndUpgrades } from '@/components/brawlers/build-upgrades';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatCard } from '@/components/ui/stat-card';
import { TableSkeleton } from '@/components/ui/skeletons';
import {
  ClassIcon,
  CombatStatIcon,
  PlayersIcon,
  TrophyIcon,
} from '@/components/game-icons';
import { getBrawler, getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import {
  combatStatLabels,
  getBrawlerWiki,
  getGearDescriptions,
  wikiPageUrl,
} from '@/lib/brawler-wiki';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getActiveMaps } from '@/lib/game-maps';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { slugify } from '@/lib/slugs';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  assignTier,
  getBrawlerAbilityChoices,
  getBrawlerBuffies,
  getBrawlerBuild,
  getBrawlerPairings,
  getBrawlerSplits,
  getBrawlerStat,
  getBrawlerTrend,
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
    title: `${name}, Brawl Stars stats, build and best maps`,
    description,
    alternates: { canonical: `/brawlers/${id}` },
    openGraph: {
      title: `${name}, Brawl Stars stats and build`,
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
  // Which star power and gadget people actually buy first, from players who
  // own exactly one of the pair.
  const abilityChoices = await getBrawlerAbilityChoices(brawlerId);

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
  const statLabels = combatStatLabels(wiki?.stats.attackLabel, wiki?.stats.superLabel);

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
        <div className="relative flex flex-wrap items-center gap-5 p-5 sm:gap-6 sm:p-6">
          <Image
            src={brawler.imageUrl}
            alt={brawler.name}
            width={144}
            height={144}
            sizes="(max-width: 640px) 128px, 144px"
            className="size-28 shrink-0 rounded-2xl object-contain sm:size-36"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
            }}
            priority
            unoptimized
          />

          {/*
            `basis` is what keeps the pills readable on a phone: below about
            15rem of space the whole text column wraps under the portrait and
            gets the full card width, instead of four pills queueing up in the
            160px left beside a 112px portrait.
          */}
          <div className="min-w-0 flex-1 basis-60">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                  <ClassIcon name={className} className="size-4" />
                  {className}
                </span>
              ) : null}
              {/*
                Tier and score are two facts and used to be one pill reading
                "C tier 4.8", which asks the reader to work out what the number
                measures and how it relates to the letter. Split, and the score
                says what it is: 4.8 out of 10 is a meta score, not a rating
                anyone gave this brawler out of five.
              */}
              {tier ? (
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  style={{
                    background: `color-mix(in srgb, ${TIER_COLOR[tier]} 20%, transparent)`,
                    color: TIER_COLOR[tier],
                  }}
                >
                  {tier} tier
                </span>
              ) : null}
              {metaScore !== null ? (
                /* Same scoring pass the Ranked tier list uses, so the number
                   here cannot disagree with the number there. */
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-strong/60 bg-surface-2/80 px-3 py-1 text-xs font-semibold text-muted"
                  title="Adjusted win rate combined with a log-scaled pick rate, calibrated within the Ranked tier list"
                >
                  Meta score
                  <span className="font-bold tabular-nums text-foreground">
                    {metaScore.toFixed(1)}
                    <span className="font-semibold text-muted">/10</span>
                  </span>
                </span>
              ) : null}
            </div>

            <h1 className="display mt-3 text-3xl capitalize sm:text-4xl">
              {brawler.name.toLowerCase()}
            </h1>
            <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">
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
                ['Health', wiki.stats.health, 'health'],
                /* The infobox labels these two independently and often gives
                   them the same words, so the grid used to print "Damage per
                   bullet" twice with different numbers under it. See
                   `combatStatLabels`. The gold Super mark carries the same
                   distinction a second way, in colour. */
                [statLabels.attack, wiki.stats.attack, 'damage'],
                [statLabels.super, wiki.stats.super, 'super-damage'],
                ['Reload', wiki.stats.reload, 'cooldown'],
                ['Range', wiki.stats.attackRange, 'ranged'],
                ['Speed', wiki.stats.movementSpeed, 'speed'],
              ] as const
            )
              // Not every brawler has every stat: a super that deals no direct
              // damage has no super damage, and the infobox simply omits it.
              .filter(([, value]) => Boolean(value))
              .map(([label, value, stat]) => {
                const { main, hint } = splitStat(value!);
                return (
                  <div key={label} className="card p-3">
                    {/* Wraps rather than truncates: the qualified damage
                        labels are the longest text on the card, and clipping
                        one to "Main attack damage per…" puts the ambiguity
                        straight back. So the label gets the full width and the
                        mark sits with the number, which is always short. */}
                    <dt className="text-xs font-medium uppercase leading-tight tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1.5 flex items-center gap-2">
                      <CombatStatIcon stat={stat} className="size-6 shrink-0" />
                      <span className="min-w-0 text-lg font-bold leading-tight tabular-nums">
                        {main}
                      </span>
                    </dd>
                    {hint ? (
                      <dd className="mt-0.5 text-xs leading-tight text-muted">{hint}</dd>
                    ) : null}
                  </div>
                );
              })}
          </dl>
        </section>
      ) : null}

      {/*
        Abilities, upgrades and what owners buy, together and directly after
        the combat stats.
        
        Performance used to come first, which put three win-rate tables between
        a reader and the answer to "what do I build on this". Somebody who has
        just unlocked a brawler wants the kit; the win rates are for deciding
        whether to unlock it at all, and that reader scrolls.
      */}
      <BuildAndUpgrades
        name={name}
        brawler={brawler}
        starPowers={starPowers}
        gadgets={gadgets}
        gears={gears}
        gearNames={gearNames}
        gearText={gearText}
        hyperCharges={hyperCharges}
        hyperchargeName={wiki?.hypercharge?.name ?? null}
        hyperchargeDescription={wiki?.hypercharge?.description ?? null}
        buffieEffects={buffieEffects}
        buffies={buffies}
        build={build}
        abilityChoices={abilityChoices}
        wiki={wiki}
      />

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
              node={<PlayersIcon className="size-6" />}
              label="Pick rate"
              value={formatPercent(stat.usageRate)}
              hint="Last 7 days"
              tone="text-accent"
            />
            <StatCard
              node={<TrophyIcon className="size-6" />}
              label="Avg trophies"
              value={
                stat.avgTrophies === null ? ', ' : formatNumber(Math.round(stat.avgTrophies))
              }
              hint="Across tracked players"
            />
            <StatCard
              icon={Sparkles}
              label="Avg rank"
              value={stat.avgRank === null ? ', ' : stat.avgRank.toFixed(1)}
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
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
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
