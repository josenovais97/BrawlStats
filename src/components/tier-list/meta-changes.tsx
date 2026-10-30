import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';
import {
  type BrawlerChange,
  buildChangeIndex,
  isNotable,
  isNotableInTier,
  spanLabel,
  tierRank,
} from '@/lib/meta-changes';
import { fmtDecimal, spanText, type Locale } from '@/lib/i18n';
import type { BABrawler } from '@/types/brawlapi';
import type { MetaMover, Tier } from '@/types/stats';

export { buildChangeIndex, isNotable, isNotableInTier, spanLabel, type BrawlerChange };

const WORDS = {
  en: {
    tierMove: (from: string, to: string) => `${from} to ${to} tier, `,
    places: (n: number, up: boolean) => `${n} ${n === 1 ? 'place' : 'places'} ${up ? 'up' : 'down'}, `,
    score: 'meta score',
    tier: (t: string) => `${t} tier`,
    whatChanged: 'What changed',
    against: (span: string) => `Against the last comparable snapshot, ${span}`,
    riser: 'Biggest riser',
    faller: 'Biggest faller',
    tierChanges: 'Tier changes',
    held: (n: number) => `Every brawler held its tier. ${n} moved within one.`,
    upDown: (up: number, down: number) => `${up} up, ${down} down`,
    scoreWord: 'Score',
    placeWord: (n: number) => (n === 1 ? 'place' : 'places'),
    newIn: (t: string) => `new in ${t}`,
  },
  es: {
    tierMove: (from: string, to: string) => `de tier ${from} a ${to}, `,
    places: (n: number, up: boolean) => `${up ? 'sube' : 'baja'} ${n} ${n === 1 ? 'puesto' : 'puestos'}, `,
    score: 'puntuación meta',
    tier: (t: string) => `Tier ${t}`,
    whatChanged: 'Qué ha cambiado',
    against: (span: string) => `Frente a la última medición comparable, ${span}`,
    riser: 'El que más sube',
    faller: 'El que más baja',
    tierChanges: 'Cambios de tier',
    held: (n: number) => `Todos los brawlers se mantienen en su tier. ${n} se movieron dentro de él.`,
    upDown: (up: number, down: number) => `${up} suben, ${down} bajan`,
    scoreWord: 'Puntuación',
    placeWord: (n: number) => (n === 1 ? 'puesto' : 'puestos'),
    newIn: (t: string) => `nuevo en ${t}`,
  },
  pt: {
    tierMove: (from: string, to: string) => `do tier ${from} para o ${to}, `,
    places: (n: number, up: boolean) => `${up ? 'subiu' : 'caiu'} ${n} ${n === 1 ? 'posição' : 'posições'}, `,
    score: 'pontuação meta',
    tier: (t: string) => `Tier ${t}`,
    whatChanged: 'O que mudou',
    against: (span: string) => `Comparado com a última medição equivalente, ${span}`,
    riser: 'Quem mais subiu',
    faller: 'Quem mais caiu',
    tierChanges: 'Mudanças de tier',
    held: (n: number) => `Todos os brawlers ficaram no mesmo tier. ${n} se moveram dentro dele.`,
    upDown: (up: number, down: number) => `${up} subiram, ${down} caíram`,
    scoreWord: 'Pontuação',
    placeWord: (n: number) => (n === 1 ? 'posição' : 'posições'),
    newIn: (t: string) => `novo no ${t}`,
  },
} satisfies Record<Locale, unknown>;

/**
 * What moved since the last comparable snapshot.
 *
 * The tier list already knew this — `MetaMovers` has shown the same numbers at
 * the foot of the page for a while — but it showed them as a separate board.
 * The complaint that prompted this was that the tier list itself looked
 * identical every day, which it did: a reader had to scroll past every tier,
 * find the movers section, and match names by eye to learn that anything had
 * changed at all. The movement belongs *on* the brawler it happened to.
 *
 * Nothing here is a new measurement. Both the summary and the per-chip badges
 * are the existing `MetaMover` rows, re-projected: the score delta is carried
 * on the row, and rank is derived by ordering the same rows by each of the two
 * scores it already holds.
 */

/**
 * The badge on a tier-list chip.
 *
 * Ranks the three facts by how much they change what the reader does: crossing
 * into a new tier is the headline, places moved is the next, and the raw score
 * delta is the detail that goes in the tooltip. Showing all three on a 92px
 * card would make every chip unreadable to say something about a handful.
 */
export function ChangeBadge({
  change,
  span,
  currentTier,
  locale = 'en',
}: {
  change: BrawlerChange;
  span: string;
  locale?: Locale;
  /**
   * The tier this chip is actually rendered in.
   *
   * Not `change.tierNow`: that is the snapshot pair's answer, computed over a
   * different window from the page's own scoring, and the two disagree often
   * enough to put a red "A tier" badge on a brawler sitting in the S row.
   * The badge describes the move that ends where the reader can see it ending.
   */
  currentTier: Tier;
}) {
  const crossed = change.tierBefore !== currentTier;
  const up = crossed
    ? tierRank(currentTier) < tierRank(change.tierBefore)
    : change.scoreDelta > 0;

  const w = WORDS[locale];
  const sign = change.scoreDelta > 0 ? '+' : '';
  const delta = `${sign}${fmtDecimal(change.scoreDelta, locale)}`;
  const title = `${crossed ? w.tierMove(change.tierBefore, currentTier) : ''}${
    change.rankDelta !== 0 ? w.places(Math.abs(change.rankDelta), change.rankDelta > 0) : ''
  }${w.score} ${delta} ${span}`;

  const label = crossed
    ? w.tier(currentTier)
    : change.rankDelta !== 0
      ? `${Math.abs(change.rankDelta)}`
      : delta;

  return (
    <span
      title={title}
      className={`mt-1 inline-flex w-full items-center justify-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-bold tabular-nums ${
        up ? 'bg-victory/15 text-victory' : 'bg-defeat/15 text-defeat'
      }`}
    >
      {up ? (
        <ArrowUpRight aria-hidden className="size-3 shrink-0" />
      ) : (
        <ArrowDownRight aria-hidden className="size-3 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * The answer to "what changed?", above the list rather than below it.
 *
 * Renders nothing when nothing cleared the noise floor. That is deliberate and
 * it is the reason this is not the same section as `MetaMovers`: a panel that
 * says "no changes detected yet" every quiet day teaches people to skip it, so
 * on a quiet day it is simply not there and the tiers start immediately.
 */
export function WhatChanged({
  movers,
  changes,
  brawlerMeta,
  locale = 'en',
}: {
  movers: MetaMover[];
  changes: Map<number, BrawlerChange>;
  brawlerMeta: Map<number, BABrawler>;
  locale?: Locale;
}) {
  const w = WORDS[locale];
  const notable = movers.filter((m) => {
    const change = changes.get(m.brawlerId);
    return change ? isNotable(change) : false;
  });
  if (notable.length === 0) return null;

  const span =
    locale === 'en'
      ? spanLabel(movers[0].fromDate, movers[0].toDate)
      : spanText(movers[0].fromDate, movers[0].toDate, locale);
  const riser = notable.reduce((best, m) => (m.metaScoreDelta > best.metaScoreDelta ? m : best));
  const faller = notable.reduce((worst, m) =>
    m.metaScoreDelta < worst.metaScoreDelta ? m : worst,
  );
  const crossings = notable.filter((m) => changes.get(m.brawlerId)!.crossedTier);
  const promoted = crossings.filter(
    (m) =>
      tierRank(changes.get(m.brawlerId)!.tierNow) <
      tierRank(changes.get(m.brawlerId)!.tierBefore),
  );

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="what-changed">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="what-changed" className="display text-lg">
          {w.whatChanged}
        </h2>
        <p className="text-xs text-muted">{w.against(span)}</p>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {riser.metaScoreDelta > 0 ? (
          <Mover
            label={w.riser}
            mover={riser}
            change={changes.get(riser.brawlerId)!}
            meta={brawlerMeta.get(riser.brawlerId)}
            locale={locale}
            tone="up"
          />
        ) : null}
        {faller.metaScoreDelta < 0 ? (
          <Mover
            label={w.faller}
            mover={faller}
            change={changes.get(faller.brawlerId)!}
            meta={brawlerMeta.get(faller.brawlerId)}
            locale={locale}
            tone="down"
          />
        ) : null}

        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{w.tierChanges}</p>
          {crossings.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">{w.held(notable.length)}</p>
          ) : (
            <>
              <p className="mt-1.5 text-2xl font-black tabular-nums">{crossings.length}</p>
              <p className="text-xs text-muted">
                {w.upDown(promoted.length, crossings.length - promoted.length)}
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs capitalize text-muted">
                {crossings
                  .slice(0, 4)
                  .map(
                    (m) => `${m.brawlerName.toLowerCase()} → ${changes.get(m.brawlerId)!.tierNow}`,
                  )
                  .join(', ')}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Mover({
  label,
  mover,
  change,
  meta,
  tone,
  locale,
}: {
  label: string;
  mover: MetaMover;
  change: BrawlerChange;
  meta: BABrawler | undefined;
  tone: 'up' | 'down';
  locale: Locale;
}) {
  const w = WORDS[locale];
  const up = tone === 'up';
  const sign = mover.metaScoreDelta > 0 ? '+' : '';

  return (
    <Link
      href={brawlerPath(mover.brawlerId, mover.brawlerName)}
      className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 transition-colors hover:bg-surface-3"
    >
      {meta?.imageUrl ? (
        <Image
          src={meta.imageUrl}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 object-contain"
          unoptimized
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
        <span className="block truncate text-sm font-bold capitalize">
          {mover.brawlerName.toLowerCase()}
        </span>
        <span
          className={`mt-0.5 flex items-center gap-1 text-xs font-semibold tabular-nums ${
            up ? 'text-victory' : 'text-defeat'
          }`}
        >
          {up ? (
            <ArrowUpRight aria-hidden className="size-3.5" />
          ) : (
            <ArrowDownRight aria-hidden className="size-3.5" />
          )}
          {w.scoreWord} {sign}
          {fmtDecimal(mover.metaScoreDelta, locale)}
          {change.rankDelta !== 0 ? (
            <>
              <Minus aria-hidden className="size-2.5 rotate-90 text-muted/40" />
              {Math.abs(change.rankDelta)} {w.placeWord(Math.abs(change.rankDelta))}
            </>
          ) : null}
          {change.crossedTier ? (
            <span style={{ color: TIER_COLOR[change.tierNow] }}>{w.newIn(change.tierNow)}</span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
