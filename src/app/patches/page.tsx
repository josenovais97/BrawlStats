import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Activity, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap, getBrawlerCatalog } from '@/lib/brawler-catalog';
import { formatDate, formatNumber, titleCaseLabel } from '@/lib/format';
import { CHANGE_LABEL } from '@/lib/release-notes';
import {
  MAX_SAMPLING_RATIO,
  MIN_WINDOW_DECIDED,
  NOTABLE_DELTA,
  PATCH_MIN_DECIDED,
  PATCH_WINDOW_DAYS,
  type PatchImpact,
  type PatchMovement,
  getPatchImpact,
  measurableSlugs,
} from '@/lib/patch-scoreboard';
import { brawlerPath } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';
import { getT, type T } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/**
 * Whether the balance changes in an update actually did anything.
 *
 * Supercell publishes what it changed; `/meta` already lists those names. What
 * nobody publishes is whether it worked, because answering it needs months of
 * sampled battles either side of a date. That is the one thing this site has.
 *
 * The page is built to be able to say "we cannot tell", and on the day it
 * shipped that is all it said. See `lib/patch-scoreboard` for the guard: the
 * sampling rate changed eighteenfold on 2026-08-30, which lands inside the
 * September update's before-window, so the movements it appears to show are
 * mostly the sampler. Publishing them with a caveat would have been worse than
 * publishing nothing — a number is quoted, a caveat is not.
 *
 * One URL, not one per update. The state space is a dozen a year and every
 * entry wants the same framing; a route per patch would be a dozen pages of
 * which most say "not measurable" (AGENTS.md trap 5 is about exactly this kind
 * of casual multiplication).
 */

/* Updates are monthly and a window closes once; six hours is plenty. */
export const revalidate = 21_600;

export const metadata: Metadata = {
  alternates: { canonical: '/patches' },
  title: 'Did the Brawl Stars balance changes work?',
  description:
    'Every brawler each Brawl Stars update changed, and what its win rate actually did in the fortnight afterwards, measured from sampled Ranked battles.',
  openGraph: {
    title: 'Did the Brawl Stars balance changes work?',
    description:
      'What each update actually did to the brawlers it changed, measured rather than announced.',
  },
};

export default async function PatchesPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const catalog = await getBrawlerCatalog().catch(() => null);
  const known = (catalog?.all ?? []).map((b) => ({ id: b.id, name: b.name }));
  const art = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());

  const nowIso = new Date().toISOString();
  const impacts = (
    await Promise.all(measurableSlugs().map((slug) => getPatchImpact(slug, known, nowIso)))
  ).filter((i): i is PatchImpact => i !== null);

  const scored = impacts.filter((i) => i.comparable);
  const unscored = impacts.filter((i) => !i.comparable);

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Patch impact', path: '/patches' },
        ])}
      />

      <PageHeading
        eyebrow={
          <span className="eyebrow flex items-center gap-2 text-accent">
            <Activity className="size-3.5" />{t('Measured, not announced')}</span>
        }
        title={t('Did the balance changes work?')}
        subtitle={t('Every brawler an update changed, and what its adjusted win rate did in the {PATCH_WINDOW_DAYS} days afterwards against the {PATCH_WINDOW_DAYS2} before. From sampled Ranked battles.', { PATCH_WINDOW_DAYS: PATCH_WINDOW_DAYS, PATCH_WINDOW_DAYS2: PATCH_WINDOW_DAYS })}
      />

      {/*
        The honest frame, first and not in a footnote. This page invites a
        causal reading — "the nerf worked" — that a fortnight of battles cannot
        support on its own, and the map rotation turns over in the same weeks.
      */}
      <p className="card border-border-strong p-5 text-sm leading-relaxed text-muted">{t('This shows what each number')}{' '}<em>{t('did')}</em>{t(', not what the update')}{' '}
        <em>{t('caused')}</em>{t('. A brawler can be buffed and ignored, nerfed and still climb, or moved by the map rotation turning over in the same fortnight. Sample sizes are printed next to every row so you can weigh them yourself, and anything under {PATCH_MIN_DECIDED} decided battles on either side is left out rather than guessed at.', { PATCH_MIN_DECIDED: formatNumber(PATCH_MIN_DECIDED) })}</p>

      {impacts.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">{t('No update inside the retained window could be read. This fills in as the release notes and the daily roll-ups line up.')}</p>
      ) : null}

      {scored.map((impact) => (
        <Scoreboard key={impact.slug} impact={impact} art={art} />
      ))}

      {unscored.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading
            title={t('Updates that cannot be measured')}
            subtitle={t('Listed rather than hidden — an absence with a reason is a finding too.')}
          />
          <ul className="card divide-y divide-border overflow-hidden">
            {unscored.map((impact) => (
              <li key={impact.slug} className="space-y-2 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <a
                    href={lp(impact.url)}
                    rel="noopener nofollow"
                    className="font-bold hover:underline"
                  >
                    {t(impact.title)}
                  </a>
                  <span className="text-xs tabular-nums text-muted">
                    {formatDate(impact.date)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted">{whyUnscored(impact, t)}</p>
                <p className="text-xs leading-relaxed text-muted/80">{t('It changed {length} brawlers.', { length: impact.unmeasured.length })}{' '}
                  {impact.unmeasured.slice(0, 8).map(titleCaseLabel).join(', ')}
                  {impact.unmeasured.length > 8 ? t(' and others') : ''}.
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Scoreboard({
  impact,
  art,
}: {
  impact: PatchImpact;
  art: Map<number, BABrawler>;
}) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const moved = impact.movements.filter((m) => Math.abs(m.delta ?? 0) >= NOTABLE_DELTA);
  const up = moved.filter((m) => (m.delta ?? 0) > 0).length;
  const down = moved.length - up;

  return (
    <section className="space-y-4">
      <SectionHeading
        title={t(impact.title)}
        aside={
          <a href={lp(impact.url)} rel="noopener nofollow" className="text-sm hover:underline">{t('Patch notes')}</a>
        }
        subtitle={t('{date} · {start} to {end} against {start2} to {end2}', { date: formatDate(impact.date), start: impact.before.start, end: impact.before.end, start2: impact.after.start, end2: impact.after.end })}
      />

      {/*
        The headline is a count, because the count is the surprising part: a
        large update touches most of the roster and moves a handful of it.
      */}
      <p className="card border-border-strong p-5 leading-relaxed">{t('This update changed')}{' '}
        <strong>{impact.movements.length + impact.unmeasured.length}{' '}{t('brawlers')}</strong>.{' '}
        {moved.length === 0 ? (
          <>{t('None of them moved more than {NOTABLE_DELTA} points either way in the', { NOTABLE_DELTA: NOTABLE_DELTA })}{' '}{t('{PATCH_WINDOW_DAYS} days afterwards.', { PATCH_WINDOW_DAYS: PATCH_WINDOW_DAYS })}</>
        ) : (
          <>
            <strong>{t('{length} moved', { length: moved.length })}</strong>{' '}{t('by more than {NOTABLE_DELTA} points in the {PATCH_WINDOW_DAYS} days afterwards', { NOTABLE_DELTA: NOTABLE_DELTA, PATCH_WINDOW_DAYS: PATCH_WINDOW_DAYS })}{up > 0 && down > 0 ? t(' — {up} up, {down} down', { up: up, down: down }) : ''}{t('. The rest stayed where they were.')}</>
        )}
        {!impact.complete ? (
          <>
            {' '}{t('The window is still filling, so this is a partial reading.')}</>
        ) : null}
      </p>

      {impact.movements.length > 0 ? (
        <ol className="card divide-y divide-border overflow-hidden">
          {impact.movements.map((m, i) => (
            <MovementRow key={m.brawlerId} movement={m} rank={i + 1} art={art} />
          ))}
        </ol>
      ) : null}

      {impact.unmeasured.length > 0 ? (
        <p className="px-1 text-xs leading-relaxed text-muted">{t('Not measured: {v} — under', { v: impact.unmeasured.map(titleCaseLabel).join(', ') })}{' '}{t('{PATCH_MIN_DECIDED} decided battles on one side of the update, or released after it.', { PATCH_MIN_DECIDED: formatNumber(PATCH_MIN_DECIDED) })}</p>
      ) : null}
    </section>
  );
}

function MovementRow({
  movement,
  rank,
  art,
}: {
  movement: PatchMovement;
  rank: number;
  art: Map<number, BABrawler>;
}) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const delta = movement.delta ?? 0;
  const notable = Math.abs(delta) >= NOTABLE_DELTA;
  const tone = !notable
    ? 'text-muted'
    : delta > 0
      ? 'text-victory'
      : 'text-defeat';
  const Icon = !notable ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <li>
      <Link
        href={lp(brawlerPath(movement.brawlerId, movement.brawlerName))}
        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/60"
      >
        <span
          aria-hidden
          className="w-5 shrink-0 text-right text-xs font-black tabular-nums text-muted"
        >
          {rank}
        </span>

        <Image
          src={art.get(movement.brawlerId)?.imageUrl ?? brawlerIconUrl(movement.brawlerId)}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-md bg-surface-2"
          loading="lazy"
          unoptimized
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold capitalize leading-tight">
            {movement.brawlerName.toLowerCase()}
          </span>
          <span className="block truncate text-xs leading-tight text-muted">
            {movement.categories.map((c) => t(CHANGE_LABEL[c])).join(' · ')} ·{' '}{t('{sampleSize} battles', { sampleSize: formatNumber(movement.sampleSize) })}</span>
        </span>

        {/* Before and after in full, because the delta alone hides whether a
            brawler moved from bad to average or average to dominant. */}
        <span className="hidden shrink-0 text-right text-xs tabular-nums text-muted sm:block">
          {movement.before !== null ? (movement.before * 100).toFixed(1) : '—'}
          <span className="px-1 text-muted/60">→</span>
          {movement.after !== null ? (movement.after * 100).toFixed(1) : '—'}
        </span>

        <span
          className={`flex w-20 shrink-0 items-center justify-end gap-0.5 text-sm font-black tabular-nums ${tone}`}
        >
          <Icon className="size-3.5" />
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)}
        </span>
      </Link>
    </li>
  );
}

/**
 * Why an update was not scored, in the page's language. Rebuilt from the
 * counts rather than read from `impact.reason`, which is cached English shared
 * by every language.
 */
function whyUnscored(impact: { reason: string | null; decided: { before: number; after: number } }, t: T): string {
  const { before, after } = impact.decided;
  const thin = Math.min(before, after);
  if (thin < MIN_WINDOW_DECIDED) {
    return t('Too little was sampled either side of this update to measure it: {before} decided Ranked battles before and {after} after.', {
      before: formatNumber(before),
      after: formatNumber(after),
    });
  }
  if (thin > 0 && Math.max(before, after) / thin > MAX_SAMPLING_RATIO) {
    return t(
      'The two windows were sampled at very different rates — {before} decided Ranked battles before against {after} after, a factor of {ratio}. Any difference would be partly the sampling and not the update, so nothing is scored.',
      { before: formatNumber(before), after: formatNumber(after), ratio: Math.round(Math.max(before, after) / thin) },
    );
  }
  return t(impact.reason ?? '');
}
