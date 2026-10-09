import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { VersusList } from '@/components/compare/versus-list';
import { SectionHeading } from '@/components/ui/section-heading';
import { fullBodyArt } from '@/lib/brawler-art';
import { brawlerPath } from '@/lib/slugs';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import { resolvePair } from '@/lib/compare';
import { currentMonth } from '@/lib/site';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  assignTier,
  getBrawlerSplits,
  getBrawlerStat,
  getHeadToHead,
  getIndexablePairs,
  normalizeWinRate,
  type BrawlerSplit,
} from '@/lib/stats';
import { realBrawlerClass } from '@/lib/brawlapi';
import type { BABrawler } from '@/types/brawlapi';
import type { BrawlerStatRow, Tier } from '@/types/stats';

interface PageProps {
  params: Promise<{ pair: string }>;
}

/*
 * Three hours, matching both the sampler and `READ_CACHE_SECONDS`.
 *
 * Declaring longer achieves nothing: these pages read cached aggregates, and a
 * route's revalidate is the shortest-lived cache inside it. This value was
 * briefly 43200, which the build reported as 1h.
 */
export const revalidate = 7200;

/*
 * Runtime ISR. See `/brawlers/[slug]` for why the empty array is required.
 *
 * 435 pairings are indexable and every one of the 5,565 is reachable, so a
 * cache that fills on first visit is the only version of this page that does
 * not pay the full render cost per request.
 */
export async function generateStaticParams() {
  return [];
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pair } = await params;
  const resolved = await resolvePair(pair).catch(() => null);
  if (!resolved) return { title: 'Compare brawlers' };

  const a = titleCase(resolved.a.name);
  const b = titleCase(resolved.b.name);

  /*
   * Indexable only for the bounded set in `getIndexablePairs`.
   *
   * Every combination renders and is shareable; that is not the question. The
   * question is which are worth a crawler's budget, and the answer cannot be
   * "all of them": there are 5,565, each server-rendered against the database.
   */
  const indexable = await getIndexablePairs()
    .then((pairs) =>
      pairs.some(
        ([x, y]) =>
          (x === resolved.a.id && y === resolved.b.id) ||
          (x === resolved.b.id && y === resolved.a.id),
      ),
    )
    .catch(() => false);

  return {
    /*
     * Dated like every other high-intent page — see `currentMonth`. A "which
     * is better" answer is exactly the kind a reader wants to know is current,
     * and this one is: both sides come from the same rolling 21-day window the
     * pairing threshold uses.
     */
    title: `${a} vs ${b}: which is better in Brawl Stars? (${currentMonth()})`,
    description: `${a} vs ${b} in Brawl Stars, ${currentMonth()}: win rates, pick rates, tiers and best modes side by side, plus their head-to-head record when they actually met — measured from sampled battles rather than opinion.`,
    alternates: { canonical: `/compare/${resolved.slug}` },
    /*
     * Indexable pages must be a deliberate set, and this is how that set is
     * drawn: both brawlers popular enough to be searched for, and the pairing
     * itself actually measured. Everything else stays out — the combinations
     * are effectively unbounded, and a crawler walking them costs real
     * function and database budget for pages nobody searched for.
     *
     * `follow` either way, so the links out of an unindexed comparison still
     * pass value to the brawler pages that matter.
     */
    robots: { index: indexable, follow: true },
  };
}

/** One brawler's side of the comparison. */
interface Side {
  brawler: BABrawler;
  stat: BrawlerStatRow | null;
  adjusted: number | null;
  tier: Tier | null;
  splits: BrawlerSplit[];
}

export default async function ComparePage({ params }: PageProps) {
  const { pair } = await params;
  const resolved = await resolvePair(pair).catch(() => null);
  if (!resolved) notFound();

  // "Shelly-VS-Colt" and "shelly-vs-colt" are the same page; only one of them
  // should be indexed, so anything that is not already canonical is sent there.
  if (pair !== resolved.slug) redirect(`/compare/${resolved.slug}`);

  // Sequential database reads keep the page to a single connection.
  const sides: [Side, Side] = [
    await loadSide(resolved.a),
    await loadSide(resolved.b),
  ];
  const [left, right] = sides;

  // Both directions, because they are different samples: each is counted from
  // the side of whichever player happened to be the sampled one.
  const leftVsRight = await getHeadToHead(left.brawler.id, right.brawler.id);
  const rightVsLeft = await getHeadToHead(right.brawler.id, left.brawler.id);

  const nameA = titleCase(left.brawler.name);
  const nameB = titleCase(right.brawler.name);

  const [leftArt, rightArt] = await Promise.all([
    fullBodyArt(left.brawler.id, left.brawler.name, left.brawler.imageUrl),
    fullBodyArt(right.brawler.id, right.brawler.name, right.brawler.imageUrl),
  ]);
  const verdict = buildVerdict(left, right);
  const faq = [
    {
      question: `Is ${nameA} better than ${nameB}?`,
      answer: verdict,
    },
    ...(leftVsRight
      ? [
          {
            question: `What is the ${nameA} vs ${nameB} head-to-head record?`,
            answer: `${nameA} wins ${formatPercent(leftVsRight.winRate)} of the ${formatNumber(leftVsRight.decidedSampleSize)} sampled battles where ${nameB} was on the other team.`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Compare', path: '/compare' },
          { name: `${nameA} vs ${nameB}`, path: `/compare/${resolved.slug}` },
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <Link
        href="/compare"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All comparisons
      </Link>

      {/* A face-off: both brawlers full-body on their rarity colours, and the
          verdict inside the card it is about. Two 112px squares and a "vs"
          read as a form; this reads as the matchup. */}
      <header className="card card-glow relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, ${left.brawler.rarity?.color ?? '#8b95b8'} 24%, transparent), transparent 45%, transparent 55%, color-mix(in srgb, ${right.brawler.rarity?.color ?? '#8b95b8'} 24%, transparent))`,
          }}
        />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-end gap-2 px-4 pt-5 sm:gap-4 sm:px-6">
          <Portrait side={left} align="end" art={leftArt} />
          <span className="display mb-16 text-3xl uppercase text-brand sm:mb-24 sm:text-5xl">vs</span>
          <Portrait side={right} align="start" art={rightArt} />
        </div>
        <p className="relative border-t border-border/70 px-4 py-3.5 text-center leading-relaxed sm:px-6">
          {verdict}
        </p>
      </header>

      <section>
        <SectionHeading
          title="Side by side"
          subtitle="Win rate is adjusted against the sample average, so both columns are on the same scale."
        />
        {/* Stacked rows rather than a three-column table: at 320px a table
            either scrolls sideways or crushes the labels, and a comparison
            with half of it off-screen is not a comparison. */}
        <VersusList
          labelA={nameA}
          labelB={nameB}
          accentA={left.brawler.rarity?.color ?? 'var(--brand)'}
          // Two brawlers of one rarity share a colour, which made both halves
          // of a bar the same red; the right side takes the brand gold then.
          accentB={
            right.brawler.rarity?.color && right.brawler.rarity.color !== left.brawler.rarity?.color
              ? right.brawler.rarity.color
              : 'var(--brand)'
          }
          sections={[
            {
              title: 'Performance',
              metrics: [
                {
                  label: 'Adjusted win rate',
                  a: formatPercent(left.adjusted),
                  b: formatPercent(right.adjusted),
                  leader: compareLeader(left.adjusted, right.adjusted),
                  values: [left.adjusted, right.adjusted],
                },
                {
                  label: 'Pick rate',
                  a: formatPercent(left.stat?.usageRate ?? null),
                  b: formatPercent(right.stat?.usageRate ?? null),
                  leader: compareLeader(
                    left.stat?.usageRate ?? null,
                    right.stat?.usageRate ?? null,
                  ),
                  values: [left.stat?.usageRate ?? null, right.stat?.usageRate ?? null],
                },
                {
                  label: 'Tier',
                  a: left.tier ?? '–',
                  b: right.tier ?? '–',
                  leader: null,
                },
                {
                  label: 'Sampled battles',
                  a: formatNumber(left.stat?.decidedSampleSize ?? null),
                  b: formatNumber(right.stat?.decidedSampleSize ?? null),
                  leader: null,
                  hint: 'More battles means a more reliable rate, not a better brawler.',
                },
              ],
            },
            {
              title: 'Profile',
              metrics: [
                {
                  label: 'Rarity',
                  a: left.brawler.rarity?.name ?? '–',
                  b: right.brawler.rarity?.name ?? '–',
                  leader: null,
                },
                {
                  label: 'Class',
                  a: realBrawlerClass(left.brawler.class?.name) ?? '–',
                  b: realBrawlerClass(right.brawler.class?.name) ?? '–',
                  leader: null,
                },
                {
                  label: 'Best mode',
                  a: left.splits[0] ? humanizeMode(left.splits[0].mode) : '–',
                  b: right.splits[0] ? humanizeMode(right.splits[0].mode) : '–',
                  leader: null,
                },
              ],
            },
          ]}
        />
      </section>

      <section>
        <SectionHeading
          title="Head to head"
          subtitle="Battles where one was on each team, counted once from the sampled player's side."
        />
        {/* Why both can be above 50%: each figure is from a different set of
            players -- the left from players of the first brawler, the right
            from players of the second -- so they are two samples, not two
            halves of one. Said once, here, instead of left to look like a bug. */}
        {leftVsRight && rightVsLeft ? (
          <p className="-mt-1 mb-3 text-xs leading-relaxed text-muted">
            Each figure comes from a different set of sampled players, so the two do not add up to
            100%.
          </p>
        ) : null}
        {leftVsRight || rightVsLeft ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <HeadToHeadCard
              subject={nameA}
              opponent={nameB}
              record={leftVsRight}
              accent={left.brawler.rarity?.color ?? '#8b95b8'}
            />
            <HeadToHeadCard
              subject={nameB}
              opponent={nameA}
              record={rightVsLeft}
              accent={right.brawler.rarity?.color ?? '#8b95b8'}
            />
          </div>
        ) : (
          <p className="card p-6 text-sm leading-relaxed text-muted">
            These two have not met often enough in sampled battles to report a record.
            Matchup data is collected from team modes only and needs a while to build
            up for any specific pairing.
          </p>
        )}
      </section>

      <section>
        <SectionHeading title="Where each one performs" />
        <div className="grid gap-4 sm:grid-cols-2">
          {sides.map((side) => (
            <div key={side.brawler.id}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                {titleCase(side.brawler.name)}
              </h3>
              {side.splits.length === 0 ? (
                <p className="card p-4 text-sm text-muted">
                  Not enough battles in any one mode yet.
                </p>
              ) : (
                <ul className="card divide-y divide-border overflow-hidden">
                  {side.splits.slice(0, 5).map((split) => (
                    <li
                      key={split.mode}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        {humanizeMode(split.mode)}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-victory">
                        {formatPercent(split.score)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title={`${nameA} vs ${nameB} FAQ`} />
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

async function loadSide(brawler: BABrawler): Promise<Side> {
  const stat = await getBrawlerStat(brawler.id);
  const splits = await getBrawlerSplits(brawler.id).then((s) => s.modes);
  const adjusted = stat
    ? normalizeWinRate(stat.winRate, stat.baselineWinRate, stat.decidedSampleSize)
    : null;

  return {
    brawler,
    stat,
    adjusted,
    tier:
      stat && stat.decidedSampleSize >= MIN_SAMPLE_FOR_TIER ? assignTier(adjusted) : null,
    splits,
  };
}

/**
 * The one-line answer to the question the page is titled with.
 *
 * Deliberately hedged when the gap is small: two brawlers half a point apart
 * are not "better" and "worse", and saying so would be the most-read sentence
 * on the page being the least defensible one.
 */
function buildVerdict(left: Side, right: Side): string {
  const nameA = titleCase(left.brawler.name);
  const nameB = titleCase(right.brawler.name);

  if (left.adjusted === null || right.adjusted === null) {
    return `There is not enough sampled data to rank ${nameA} against ${nameB} yet. Both pages list what has been collected so far.`;
  }

  const gap = Math.abs(left.adjusted - right.adjusted);
  const [ahead, behind] =
    left.adjusted >= right.adjusted ? [nameA, nameB] : [nameB, nameA];

  // A rate built on a handful of battles is shrunk hard toward the average, so
  // it is never wild — but it is also not evidence, and the sentence people
  // read first should not pretend otherwise.
  const thin = [left, right].filter(
    (side) => (side.stat?.decidedSampleSize ?? 0) < MIN_SAMPLE_FOR_TIER,
  );
  if (thin.length > 0) {
    const names = thin.map((side) => titleCase(side.brawler.name)).join(' and ');
    return `Too little data to call this one: ${names} ${thin.length === 1 ? 'has' : 'have'} fewer than ${MIN_SAMPLE_FOR_TIER} sampled decided battles, which is below the floor either tier list uses. The table below shows what has been collected so far.`;
  }

  if (gap < 0.005) {
    return `${nameA} and ${nameB} are level on current data. Their adjusted win rates are within half a percentage point of each other, which is inside the noise of the sample. Pick on mode and map instead.`;
  }

  const aheadSide = left.adjusted >= right.adjusted ? left : right;
  const mode = aheadSide.splits[0] ? humanizeMode(aheadSide.splits[0].mode) : null;

  return `${ahead} is ahead of ${behind} on current data, by ${(gap * 100).toFixed(1)} percentage points of adjusted win rate${mode ? `, and is strongest in ${mode}` : ''}. Both numbers are re-centred on the sample average, so this compares the brawlers rather than who happened to be playing them.`;
}

/** Which side leads, or null when they are level or a value is missing. */
function compareLeader(a: number | null, b: number | null): 'a' | 'b' | null {
  if (a === null || b === null || Math.abs(a - b) < 0.002) return null;
  return a > b ? 'a' : 'b';
}

function HeadToHeadCard({
  subject,
  opponent,
  record,
  accent,
}: {
  subject: string;
  opponent: string;
  record: { winRate: number; decidedSampleSize: number } | null;
  accent: string;
}) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        <span aria-hidden className="size-2 rounded-full" style={{ background: accent }} />
        {subject} vs {opponent}
      </p>
      {record ? (
        <>
          <p className="mt-1 text-sm">
            <span className="font-semibold">{subject}</span> wins
          </p>
          <p className="display text-4xl tabular-nums">{formatPercent(record.winRate)}</p>
          <p className="mt-1 text-xs text-muted">
            of {formatNumber(record.decidedSampleSize)} sampled games against {opponent}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Not enough sampled battles yet.</p>
      )}
    </div>
  );
}

function Portrait({ side, align, art }: { side: Side; align: 'start' | 'end'; art: string }) {
  const accent = side.brawler.rarity?.color ?? '#8b95b8';

  return (
    <div
      className={`flex min-w-0 flex-col gap-2 ${
        align === 'end' ? 'items-end text-right' : 'items-start text-left'
      }`}
    >
      <span className="relative flex h-32 w-full items-end justify-center sm:h-52">
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 size-28 -translate-x-1/2 rounded-full opacity-45 blur-2xl sm:size-44"
          style={{ background: accent }}
        />
        <Image
          src={art}
          alt={side.brawler.name}
          width={240}
          height={240}
          className="relative h-28 w-auto object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.55)] sm:h-48"
          priority
          unoptimized
        />
      </span>
      <Link
        href={brawlerPath(side.brawler.id, side.brawler.name)}
        className="display truncate text-lg uppercase hover:underline sm:text-2xl"
      >
        {side.brawler.name}
      </Link>
      {side.tier ? (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            background: `color-mix(in srgb, ${TIER_COLOR[side.tier]} 20%, transparent)`,
            color: TIER_COLOR[side.tier],
          }}
        >
          {side.tier} tier
        </span>
      ) : null}
    </div>
  );
}

/** "MR. P" -> "Mr. P", for prose that quotes an API name. */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase());
}
