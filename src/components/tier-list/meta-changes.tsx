import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { brawlerPath } from "@/lib/slugs";
import { TIER_COLOR } from "@/lib/tiers";
import type { BABrawler } from "@/types/brawlapi";
import type { MetaMover, Tier } from "@/types/stats";

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

/** One brawler's movement, in the three forms the page shows it. */
export interface BrawlerChange {
  scoreDelta: number;
  /** Positive is upward: places gained since the earlier snapshot. */
  rankDelta: number;
  tierBefore: Tier;
  tierNow: Tier;
  crossedTier: boolean;
}

/**
 * Below this, a "move" is the third decimal place of a noisy score.
 *
 * A crossed tier boundary is always shown regardless, because that is a
 * visible change to the page even when the score barely moved.
 */
const MIN_SCORE_MOVE = 0.15;

/**
 * Ranks are positions among the brawlers that clear the sample floor on *both*
 * dates, which is the same population the tier list rates. It is not a rank
 * out of 107 and the copy never claims it is — "3 places" is a distance, and
 * the distance is honest.
 */
export function buildChangeIndex(
  movers: MetaMover[],
): Map<number, BrawlerChange> {
  const index = new Map<number, BrawlerChange>();
  if (movers.length === 0) return index;

  const rankNow = new Map<number, number>();
  const rankBefore = new Map<number, number>();

  [...movers]
    .sort((a, b) => b.metaScoreNow - a.metaScoreNow)
    .forEach((m, i) => rankNow.set(m.brawlerId, i + 1));
  [...movers]
    .sort((a, b) => b.metaScoreBefore - a.metaScoreBefore)
    .forEach((m, i) => rankBefore.set(m.brawlerId, i + 1));

  for (const mover of movers) {
    index.set(mover.brawlerId, {
      scoreDelta: mover.metaScoreDelta,
      rankDelta:
        (rankBefore.get(mover.brawlerId) ?? 0) -
        (rankNow.get(mover.brawlerId) ?? 0),
      tierBefore: mover.tierBefore,
      tierNow: mover.tierNow,
      crossedTier: mover.tierBefore !== mover.tierNow,
    });
  }

  return index;
}

/** Whether a change is worth the ink. */
export function isNotable(change: BrawlerChange): boolean {
  return change.crossedTier || Math.abs(change.scoreDelta) >= MIN_SCORE_MOVE;
}

/**
 * How long the comparison actually spans.
 *
 * Written from the snapshot dates rather than hard-coded, because the lookback
 * is a *request* — `compute_getMetaMovers` falls back to the oldest comparable
 * snapshot when the dataset is too young, so a page asking for seven days can
 * legitimately be showing two. Printing "since yesterday" over a week-old
 * comparison would be the kind of small lie that makes every other number on
 * the page worth doubting.
 */
export function spanLabel(from: string, to: string): string {
  const days = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
  if (!Number.isFinite(days) || days <= 0) return "since the last snapshot";
  if (days === 1) return "since yesterday";
  if (days === 7) return "in the last week";
  return `in the last ${days} days`;
}

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
}: {
  change: BrawlerChange;
  span: string;
}) {
  const up = change.crossedTier
    ? TIER_ORDER_VALUE(change.tierNow) < TIER_ORDER_VALUE(change.tierBefore)
    : change.scoreDelta > 0;

  const sign = change.scoreDelta > 0 ? "+" : "";
  const title = `${
    change.crossedTier ? `${change.tierBefore} to ${change.tierNow} tier, ` : ""
  }${
    change.rankDelta !== 0
      ? `${Math.abs(change.rankDelta)} ${
          Math.abs(change.rankDelta) === 1 ? "place" : "places"
        } ${change.rankDelta > 0 ? "up" : "down"}, `
      : ""
  }meta score ${sign}${change.scoreDelta.toFixed(1)} ${span}`;

  const label = change.crossedTier
    ? `${change.tierNow} tier`
    : change.rankDelta !== 0
      ? `${Math.abs(change.rankDelta)}`
      : `${sign}${change.scoreDelta.toFixed(1)}`;

  return (
    <span
      title={title}
      className={`mt-1 inline-flex w-full items-center justify-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-bold tabular-nums ${
        up ? "bg-victory/15 text-victory" : "bg-defeat/15 text-defeat"
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

/** S is the top, so a *lower* index is a better tier. */
function TIER_ORDER_VALUE(tier: Tier): number {
  return ["S", "A", "B", "C", "D"].indexOf(tier);
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
  const riser = notable.reduce((best, m) =>
    m.metaScoreDelta > best.metaScoreDelta ? m : best,
  );
  const faller = notable.reduce((worst, m) =>
    m.metaScoreDelta < worst.metaScoreDelta ? m : worst,
  );
  const crossings = notable.filter(
    (m) => changes.get(m.brawlerId)!.crossedTier,
  );
  const promoted = crossings.filter(
    (m) =>
      TIER_ORDER_VALUE(changes.get(m.brawlerId)!.tierNow) <
      TIER_ORDER_VALUE(changes.get(m.brawlerId)!.tierBefore),
  );

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="what-changed">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="what-changed" className="display text-lg uppercase">
          What changed
        </h2>
        <p className="text-xs text-muted">
          Against the last comparable snapshot, {span}
        </p>
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
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Tier changes
          </p>
          {crossings.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">
              Every brawler held its tier. {notable.length} moved within one.
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-2xl font-black tabular-nums">
                {crossings.length}
              </p>
              <p className="text-xs text-muted">
                {promoted.length} up, {crossings.length - promoted.length} down
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs capitalize text-muted">
                {crossings
                  .slice(0, 4)
                  .map(
                    (m) =>
                      `${m.brawlerName.toLowerCase()} → ${changes.get(m.brawlerId)!.tierNow}`,
                  )
                  .join(", ")}
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
  tone: "up" | "down";
}) {
  const up = tone === "up";
  const sign = mover.metaScoreDelta > 0 ? "+" : "";

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
        <span className="block text-xs font-bold uppercase tracking-wide text-muted">
          {label}
        </span>
        <span className="block truncate text-sm font-bold capitalize">
          {mover.brawlerName.toLowerCase()}
        </span>
        <span
          className={`mt-0.5 flex items-center gap-1 text-xs font-semibold tabular-nums ${
            up ? "text-victory" : "text-defeat"
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
              {Math.abs(change.rankDelta)}{" "}
              {Math.abs(change.rankDelta) === 1 ? "place" : "places"}
            </>
          ) : null}
          {change.crossedTier ? (
            <span style={{ color: TIER_COLOR[change.tierNow] }}>
              new in {change.tierNow}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
