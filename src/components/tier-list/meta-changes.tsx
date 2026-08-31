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
import type { BABrawler } from '@/types/brawlapi';
import type { MetaMover, Tier } from '@/types/stats';

export { buildChangeIndex, isNotable, isNotableInTier, spanLabel, type BrawlerChange };

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
}: {
  change: BrawlerChange;
  span: string;
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

  const sign = change.scoreDelta > 0 ? '+' : '';
  const title = `${crossed ? `${change.tierBefore} to ${currentTier} tier, ` : ''}${
    change.rankDelta !== 0
      ? `${Math.abs(change.rankDelta)} ${
          Math.abs(change.rankDelta) === 1 ? 'place' : 'places'
        } ${change.rankDelta > 0 ? 'up' : 'down'}, `
      : ''
  }meta score ${sign}${change.scoreDelta.toFixed(1)} ${span}`;

  const label = crossed
    ? `${currentTier} tier`
    : change.rankDelta !== 0
      ? `${Math.abs(change.rankDelta)}`
      : `${sign}${change.scoreDelta.toFixed(1)}`;

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
}: {
  movers: MetaMover[];
  changes: Map<number, BrawlerChange>;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const notable = movers.filter((m) => {
    const change = changes.get(m.brawlerId);
    return change ? isNotable(change) : false;
  });
  if (notable.length === 0) return null;

  const span = spanLabel(movers[0].fromDate, movers[0].toDate);
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
        <h2 id="what-changed" className="display text-lg uppercase">
          What changed
        </h2>
        <p className="text-xs text-muted">Against the last comparable snapshot, {span}</p>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {riser.metaScoreDelta > 0 ? (
          <Mover
            label="Biggest riser"
            mover={riser}
            change={changes.get(riser.brawlerId)!}
            meta={brawlerMeta.get(riser.brawlerId)}
            tone="up"
          />
        ) : null}
        {faller.metaScoreDelta < 0 ? (
          <Mover
            label="Biggest faller"
            mover={faller}
            change={changes.get(faller.brawlerId)!}
            meta={brawlerMeta.get(faller.brawlerId)}
            tone="down"
          />
        ) : null}

        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Tier changes</p>
          {crossings.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">
              Every brawler held its tier. {notable.length} moved within one.
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-2xl font-black tabular-nums">{crossings.length}</p>
              <p className="text-xs text-muted">
                {promoted.length} up, {crossings.length - promoted.length} down
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
}: {
  label: string;
  mover: MetaMover;
  change: BrawlerChange;
  meta: BABrawler | undefined;
  tone: 'up' | 'down';
}) {
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
          Score {sign}
          {mover.metaScoreDelta.toFixed(1)}
          {change.rankDelta !== 0 ? (
            <>
              <Minus aria-hidden className="size-2.5 rotate-90 text-muted/40" />
              {Math.abs(change.rankDelta)} {Math.abs(change.rankDelta) === 1 ? 'place' : 'places'}
            </>
          ) : null}
          {change.crossedTier ? (
            <span style={{ color: TIER_COLOR[change.tierNow] }}>new in {change.tierNow}</span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
