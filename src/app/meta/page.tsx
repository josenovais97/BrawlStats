import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { CompList } from '@/components/comps/comp-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

import { brawlerIconUrl, getGameModeMap, modeLabel } from '@/lib/brawlapi';
import { getBrawlerArtMap, getBrawlerCatalog } from '@/lib/brawler-catalog';
import { formatNumber, formatPercent, titleCase } from '@/lib/format';
import { CHANGE_LABEL, changesFromNotes, getLatestReleaseNotes } from '@/lib/release-notes';
import { brawlerPath, slugify } from '@/lib/slugs';
import { DEFAULT_TIER_WINDOW, TIER_COLOR, getBestPicksByMode, getFilterableModes, getMetaIndex, getMetaMovers, getRankedTrends, getTeamComps } from '@/lib/stats';
import { modeNamer } from '@/lib/i18n-game';
import { tierListHref } from '@/lib/tier-list-route';
import type { BABrawler } from '@/types/brawlapi';
import type { MetaMover, ModeBestPicks, Tier } from '@/types/stats';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

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
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const [movers, modes, modeMeta, brawlerMeta, catalogue] = await Promise.all([
    getMetaMovers(7).catch(() => [] as MetaMover[]),
    getTeamComps().catch(() => []),
    getGameModeMap().catch(() => new Map()),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getBrawlerCatalog().catch(() => null),
  ]);

  /*
   * 2026-11-11: the week in plain sentences, the best pick per Ranked mode
   * and a 14-day line per mover, from reads the tier list already caches.
   */
  const index = await getMetaIndex('ranked', 7).catch(() => new Map());
  const trends = await getRankedTrends(14).catch(() => ({}) as Record<number, [string, number][]>);
  const rankedModes = new Set((await getFilterableModes(30, 150, 'ranked').catch(() => [])).map((m) => m.mode));
  const bestByMode = await getBestPicksByMode(1).catch(() => new Map<string, ModeBestPicks>());
  const modeName = await modeNamer();
  const leaders = [...index.values()]
    .filter((b) => b.metaScore !== null && b.tier !== null)
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
    .slice(0, 3);
  const modePicks = [...bestByMode.values()]
    .filter((m) => m.picks.length > 0 && rankedModes.has(m.mode))
    .sort((a, b) => b.sampleSize - a.sampleSize);

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

  /** UTC-anchored so server and browser agree; "25 August" beats "2026-08-25". */
  const day = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Meta report', path: '/meta' },
        ])}
      />

      <PageHeading
        title={t('This week in the meta')}
        subtitle={
          window
            ? t('What moved between {fromDate} and {toDate}, measured from sampled battles.', { fromDate: day(window.fromDate), toDate: day(window.toDate) })
            : t('What moved this week, measured from sampled battles.')
        }
      />

      {/* The week in short: the reading, before the rows it comes from. */}
      {leaders.length === 3 || risers.length > 0 || fallers.length > 0 ? (
        <section className="card card-glow relative isolate overflow-hidden p-5 sm:p-6">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(60% 90% at 0% 0%, rgb(255 197 61 / 0.18), transparent 60%)' }}
          />
          <h2 className="display text-xl leading-none sm:text-2xl">{t('The week in short')}</h2>
          <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed">
            {leaders.length === 3 ? (
              <li className="flex gap-2.5">
                <span aria-hidden className="text-brand">●</span>
                <span>{t('{a}, {b} and {c} are the top three in Ranked right now.', { a: titleCase(leaders[0].brawlerName), b: titleCase(leaders[1].brawlerName), c: titleCase(leaders[2].brawlerName) })}</span>
              </li>
            ) : null}
            {risers[0] ? (
              <li className="flex gap-2.5">
                <span aria-hidden className="text-victory">▲</span>
                <span>{t('{name} rose the most, up {delta} points to {tier} tier.', { name: titleCase(risers[0].brawlerName), delta: risers[0].metaScoreDelta.toFixed(1), tier: risers[0].tierNow })}</span>
              </li>
            ) : null}
            {fallers[0] ? (
              <li className="flex gap-2.5">
                <span aria-hidden className="text-defeat">▼</span>
                <span>{t('{name} fell the most, down {delta} points to {tier} tier.', { name: titleCase(fallers[0].brawlerName), delta: Math.abs(fallers[0].metaScoreDelta).toFixed(1), tier: fallers[0].tierNow })}</span>
              </li>
            ) : null}
            {crossings.length > 0 ? (
              <li className="flex gap-2.5">
                <span aria-hidden className="text-accent-2">◆</span>
                <span>{t('{n} brawlers changed tier: {up} up and {down} down.', { n: movers.filter((m) => m.tierNow !== m.tierBefore).length, up: movers.filter((m) => m.tierNow !== m.tierBefore && m.metaScoreDelta > 0).length, down: movers.filter((m) => m.tierNow !== m.tierBefore && m.metaScoreDelta < 0).length })}</span>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {modePicks.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading title={t('Best pick in each mode')} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {modePicks.map((m) => {
              const pick = m.picks[0];
              const icon = modeMeta.get(m.mode.toLowerCase())?.imageUrl;
              return (
                <li key={m.mode}>
                  <Link
                    href={lp(tierListHref('ranked', DEFAULT_TIER_WINDOW, m.mode))}
                    prefetch={false}
                    className="card card-interactive flex h-full flex-col items-center gap-1.5 p-3 text-center"
                  >
                    <span className="flex items-center gap-1 text-[11px] font-bold text-muted">
                      {icon ? <Image src={icon} alt="" width={16} height={16} unoptimized className="size-4" /> : null}
                      <span className="truncate">{modeName(modeLabel(modeMeta, m.mode))}</span>
                    </span>
                    <Image
                      src={brawlerMeta.get(pick.brawlerId)?.imageUrl ?? brawlerIconUrl(pick.brawlerId)}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className="size-16 rounded-xl border-2 border-ink object-cover"
                    />
                    <span className="label-game truncate text-sm capitalize">{pick.brawlerName.toLowerCase()}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {movers.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">{t('Not enough comparable snapshots yet. This fills in once a week of daily snapshots has been collected under a stable sample.')}</p>
      ) : null}

      {crossings.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading title={t('Tier changes')} />
          <ul className="card divide-y divide-border overflow-hidden">
            {crossings.map((mover) => (
              <li key={mover.brawlerId}>
                <Link
                  href={lp(brawlerPath(mover.brawlerId, mover.brawlerName))}
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
                    <span className="block text-xs tabular-nums text-muted">{t('{sampleSize} battles ·', { sampleSize: formatNumber(mover.sampleSize) })}{' '}{t('{winRateNow} win rate', { winRateNow: formatPercent(mover.winRateNow) })}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-black">
                    <TierPill tier={mover.tierBefore} muted />
                    <span aria-hidden className="text-muted">
                      →
                    </span>
                    <TierPill tier={mover.tierNow} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <MoverColumn title={t('Rising')} movers={risers} brawlerMeta={brawlerMeta} trends={trends} up />
        <MoverColumn title={t('Falling')} movers={fallers} brawlerMeta={brawlerMeta} trends={trends} up={false} />
      </div>

      {changes.length > 0 && notes ? (
        <section className="space-y-3">
          <SectionHeading
            title={t('What the update changed')}
            aside={notes.title}
            subtitle={
              <>{t('The names Supercell published.')}{' '}
                <Link href={lp('/patches')} className="font-medium text-brand hover:underline">{t('Whether any of it moved')}</Link>{' '}{t('is measured separately.')}</>
            }
          />
          <ul className="card divide-y divide-border overflow-hidden">
            {changes.map((change) => (
              <li key={change.category} className="px-4 py-3">
                <p className="label-game text-xs text-muted">
                  {CHANGE_LABEL[change.category]}
                </p>
                <p className="mt-1 text-sm capitalize leading-relaxed">
                  {change.brawlers.map((n) => n.toLowerCase()).join(', ')}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t('A brawler listed here has a dashed marker on its own trend chart, so you can see what the change actually did.')}</p>
        </section>
      ) : null}

      {topComps.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading
            title={t('Comps winning now')}
            aside={
              <Link
                href={lp('/comps')}
                className="text-xs font-semibold text-brand transition-colors hover:underline"
              >{t('All comps')}</Link>
            }
          />
          {topComps.map(({ mode, comp }) => {
            const label = modeLabel(modeMeta, mode.mode);
            return (
              <div key={mode.mode} className="space-y-1.5">
                <p className="text-xs font-semibold text-muted">
                  <Link
                    href={lp(`/comps/${slugify(label)}`)}
                    className="transition-colors hover:text-foreground"
                  >
                    {t(label)}
                  </Link>{' '}{t('· mode average {baseline}', { baseline: formatPercent(mode.baseline) })}</p>
                <CompList comps={[comp]} brawlerMeta={brawlerMeta} emptyLabel={t('No data yet.')} />
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
  trends,
  up,
}: {
  title: string;
  movers: MetaMover[];
  brawlerMeta: Map<number, BABrawler>;
  trends: Record<number, [string, number][]>;
  up: boolean;
}) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  return (
    <section className="space-y-3">
      <SectionHeading title={t(title)} />
      {movers.length === 0 ? (
        <p className="card p-4 text-sm text-muted">{t('Nothing moved enough to report.')}</p>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {movers.map((mover) => (
            <li key={mover.brawlerId}>
              <Link
                href={lp(brawlerPath(mover.brawlerId, mover.brawlerName))}
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
                  <span className="block text-xs tabular-nums text-muted">{t('{sampleSize} battles · {winRateNow} win rate', { sampleSize: formatNumber(mover.sampleSize), winRateNow: formatPercent(mover.winRateNow) })}</span>
                </span>
                <Trend points={trends[mover.brawlerId]} up={up} />
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

/** The tier chip used across the tier list, so a move reads in one glance. */
function TierPill({ tier, muted = false }: { tier: Tier; muted?: boolean }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-xs font-black"
      style={{
        background: `color-mix(in srgb, ${TIER_COLOR[tier]} ${muted ? 10 : 20}%, transparent)`,
        color: TIER_COLOR[tier],
        opacity: muted ? 0.65 : 1,
      }}
    >
      {tier}
    </span>
  );
}

/** Fourteen days of adjusted Ranked win rate beside a mover (2026-11-11). */
function Trend({ points, up }: { points?: [string, number][]; up: boolean }) {
  if (!points || points.length < 3) return null;
  const v = points.map(([, x]) => x);
  const lo = Math.min(...v);
  const span = Math.max(Math.max(...v) - lo, 0.01);
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * 100).toFixed(1)},${(2 + (1 - (x - lo) / span) * 16).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="h-6 w-16 shrink-0" aria-hidden>
      <path d={d} fill="none" stroke={up ? 'var(--victory)' : 'var(--defeat)'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
