'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { formatNumber, formatPercent, titleCaseLabel } from '@/lib/format';
import {
  type RadarCell,
  type RadarCuts,
  type RadarPoint,
  cellOf,
  deoverlap,
  isNamed,
  middleRadius,
  portraitRadius,
  radarScales,
  radiusFor,
} from '@/lib/meta-radar';
import { brawlerPath } from '@/lib/slugs';

/**
 * The meta as a picture.
 *
 * Hand-rolled SVG rather than a charting library. This project ships no chart
 * dependency and one scatter plot is not a reason to start — recharts would be
 * a larger addition than everything on this page put together, for axes that
 * are twenty lines of arithmetic the tests already pin.
 *
 * The lines are `getHiddenMeta`'s own percentile cuts, so the corners of this
 * chart are the lists printed beneath it, by construction rather than by
 * agreement.
 */

/** The plot's own coordinate space; CSS scales it to the container. */
const W = 760;
const H = 520;
const PAD = { top: 18, right: 18, bottom: 58, left: 108 };

/** Height kept clear inside each corner for its title. */
const LABEL_STRIP = 30;

const CELL_FILL: Record<RadarCell, string> = {
  sleeper: 'var(--victory)',
  overrated: 'var(--defeat)',
  meta: 'var(--brand)',
  dead: 'var(--muted)',
  middle: 'var(--border-strong)',
};

const CELL_LABEL: Record<RadarCell, string> = {
  sleeper: 'Sleeper',
  overrated: 'Overrated',
  meta: 'Established meta',
  dead: 'Out of favour',
  middle: 'Middle of the pack',
};

export function MetaRadar({
  bare = false,
  points,
  cuts,
  windowDays,
  owned,
}: {
  points: RadarPoint[];
  cuts: RadarCuts;
  windowDays: number;
  /**
   * On a profile, the brawlers this account can field.
   *
   * The same chart answers a different and better question once it knows: not
   * "what is the meta" but "how much of the meta can you actually play". Every
   * brawler is still drawn, because the gaps are the finding -- a dark patch
   * in the top-right corner is the thing worth seeing, and dropping the ones
   * you do not own would delete exactly that.
   */
  owned?: Set<number>;
  /** True inside a Panel, which already provides the surface. */
  bare?: boolean;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  const layout = useMemo(() => {
    const scales = radarScales(points, cuts);
    if (!scales) return null;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const maxSample = Math.max(...points.map((p) => p.sampleSize), 1);

    const x = (usage: number) => PAD.left + scales.x.at(usage) * plotW;
    // Inverted: SVG y grows downward and a win rate does not.
    const y = (score: number) => PAD.top + (1 - scales.y.at(score)) * plotH;

    const xLow = x(cuts.lowUsage);
    const xHigh = x(cuts.highUsage);
    const yStrong = y(cuts.strong);
    const yWeak = y(cuts.weak);
    const left = PAD.left;
    const right = W - PAD.right;
    const top = PAD.top;
    const bottom = H - PAD.bottom;

    /*
     * The rectangle each named cell occupies, so a nudge cannot leave it --
     * minus the strip its title sits in.
     *
     * Reserving that strip is the fix for a collision that showed up the
     * moment real data arrived: fifteen out-of-favour brawlers crowded the
     * bottom-left and buried the words OUT OF FAVOUR under four of them. The
     * label is part of the layout now rather than something drawn on top and
     * hoped for, and the two bottom corners carry theirs along the bottom edge
     * where their own data is thinnest.
     */
    const boundsFor = (cell: ReturnType<typeof cellOf>) => {
      switch (cell) {
        case 'sleeper':
          return { x0: left, y0: top + LABEL_STRIP, x1: xLow, y1: yStrong };
        case 'meta':
          return { x0: xHigh, y0: top + LABEL_STRIP, x1: right, y1: yStrong };
        case 'dead':
          return { x0: left, y0: yWeak, x1: xLow, y1: bottom - LABEL_STRIP };
        case 'overrated':
          return { x0: xHigh, y0: yWeak, x1: right, y1: bottom - LABEL_STRIP };
        default:
          return null;
      }
    };

    const prepared = points.map((p) => {
      const cell = cellOf(p, cuts);
      const named = isNamed(cell);
      /*
       * Everybody gets a face. `named` now sets emphasis rather than
       * eligibility: a corner portrait is larger, ringed in its cell's colour,
       * given room by the de-overlap pass, and painted last.
       *
       * With a roster in hand the emphasis moves to ownership instead, since
       * that is what the reader is scanning for.
       */
      const has = owned ? owned.has(p.brawlerId) : true;
      const face = p.imageUrl !== null && has;
      return {
        point: p,
        cell,
        named,
        face,
        r: !face
          ? radiusFor(p.sampleSize, maxSample)
          : named
            ? portraitRadius(p.sampleSize, maxSample)
            : middleRadius(p.sampleSize, maxSample),
      };
    });

    /*
     * Only the faces are separated. The dots are background texture -- the
     * middle of the pack, where no claim is being made and no identity is
     * being read -- so moving them would spend the budget that keeps the
     * named points honest on points nobody is looking at.
     */
    const nudged = new Map(
      deoverlap(
        prepared
          .filter((p) => p.named && p.face)
          .map((p) => ({
            id: p.point.brawlerId,
            x: x(p.point.usageRate ?? 0),
            y: y(p.point.metaScore),
            r: p.r,
            bounds: boundsFor(p.cell),
          })),
      ).map((p) => [p.id, p]),
    );

    return {
      scales,
      plotW,
      plotH,
      x,
      y,
      xLow,
      xHigh,
      yStrong,
      yWeak,
      placed: prepared
        .map((p) => {
          const moved = nudged.get(p.point.brawlerId);
          return {
            ...p,
            cx: moved?.x ?? x(p.point.usageRate ?? 0),
            cy: moved?.y ?? y(p.point.metaScore),
          };
        })
        /*
         * Biggest first, so the heavily-sampled giants are painted under the
         * small ones. Drawn the other way round, a 5,000-battle bubble sits on
         * top of every floor-sample point near it and they become untappable.
         */
        /*
         * The middle first and the corners last, then biggest to smallest
         * within each. Showing all eighty-five means they overlap, so paint
         * order is the only thing deciding which brawler survives a collision
         * -- and it should be the ones the chart is making a claim about.
         */
        .sort((a, b) => Number(a.named) - Number(b.named) || b.r - a.r),
    };
  }, [points, cuts, owned]);

  if (!layout) return null;

  const open = layout.placed.find((p) => p.point.brawlerId === openId) ?? null;

  return (
    <div className="space-y-3">
      <div className={bare ? '' : 'card overflow-hidden p-3 sm:p-4'}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-manipulation"
          role="img"
          aria-label={`Every rated brawler plotted by pick rate against meta score, over ${windowDays} days`}
        >
          {/* The four corners, tinted so the chart reads before anything is tapped. */}
          <Corner
            x={PAD.left}
            y={PAD.top}
            w={layout.xLow - PAD.left}
            h={layout.yStrong - PAD.top}
            fill="var(--victory)"
            label="Sleepers"
            anchor="start"
            edge="top"
          />
          <Corner
            x={layout.xHigh}
            y={PAD.top}
            w={W - PAD.right - layout.xHigh}
            h={layout.yStrong - PAD.top}
            fill="var(--brand)"
            label="Meta"
            anchor="end"
            edge="top"
          />
          <Corner
            x={PAD.left}
            y={layout.yWeak}
            w={layout.xLow - PAD.left}
            h={H - PAD.bottom - layout.yWeak}
            fill="var(--muted)"
            label="Out of favour"
            anchor="start"
            edge="bottom"
          />
          <Corner
            x={layout.xHigh}
            y={layout.yWeak}
            w={W - PAD.right - layout.xHigh}
            h={H - PAD.bottom - layout.yWeak}
            fill="var(--defeat)"
            label="Overrated"
            anchor="end"
            edge="bottom"
          />

          {/*
            The cuts, each labelled with the pick rate it sits at.

            Without a number on them these are four dashed lines a reader has
            to take on faith. With one, the claim is checkable: "under 0.4%
            picked" is the same sentence the sleepers list prints in its own
            subtitle, and seeing it on the axis is what connects the two.

            The vertical axis is deliberately *not* numbered. It plots the
            shrunk, baseline-adjusted score the tier list ranks on, and
            printing those values would invite them to be read as win rates,
            which they are not. The win rate is on the card when a point is
            tapped, where there is room to say which number it is.
          */}
          {[cuts.lowUsage, cuts.highUsage].map((v) => (
            <g key={`x${v}`}>
              <line
                x1={layout.x(v)}
                x2={layout.x(v)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--border-strong)"
                strokeDasharray="4 4"
              />
              <text
                x={layout.x(v)}
                y={H - PAD.bottom + 18}
                textAnchor="middle"
                className="fill-[var(--muted)] text-[12px] tabular-nums"
              >
                {formatPercent(v)}
              </text>
            </g>
          ))}
          {[
            { v: cuts.strong, label: 'strongest 30%' },
            { v: cuts.weak, label: 'weakest 40%' },
          ].map(({ v, label }) => (
            <g key={`y${v}`}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={layout.y(v)}
                y2={layout.y(v)}
                stroke="var(--border-strong)"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 8}
                y={layout.y(v) + 4}
                textAnchor="end"
                className="fill-[var(--muted)] text-[11px]"
              >
                {label}
              </text>
            </g>
          ))}

          {/* Frame and axis labels. */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={layout.plotW}
            height={layout.plotH}
            fill="none"
            stroke="var(--border)"
          />
          <text
            x={PAD.left + layout.plotW / 2}
            y={H - 12}
            textAnchor="middle"
            className="fill-[var(--muted)] text-[13px]"
          >
            How often it is picked →
          </text>
          <text
            x={-(PAD.top + layout.plotH / 2)}
            y={16}
            transform="rotate(-90)"
            textAnchor="middle"
            className="fill-[var(--muted)] text-[13px]"
          >
            How well it does →
          </text>

          {/* One clip per named brawler, so each portrait is round. */}
          <defs>
            {layout.placed
              .filter((p) => p.face)
              .map(({ point, cx, cy, r }) => (
                <clipPath key={point.brawlerId} id={`radar-${point.brawlerId}`}>
                  <circle cx={cx} cy={cy} r={r} />
                </clipPath>
              ))}
          </defs>

          {layout.placed.map(({ point, cell, named, face, r, cx, cy }) => {
            const selected = point.brawlerId === openId;
            const rr = selected ? r + 3 : r;

            return (
              <g
                key={point.brawlerId}
                className="cursor-pointer"
                onClick={() => setOpenId(selected ? null : point.brawlerId)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={rr}
                  fill={CELL_FILL[cell]}
                  /* A brawler the account cannot field is a hole, not a dot. */
                  fillOpacity={face ? 1 : owned ? 0.16 : 0.5}
                  stroke={selected ? 'var(--foreground)' : CELL_FILL[cell]}
                  /*
                   * A hole is drawn faintly, not outlined.
                   *
                   * On a profile an unowned brawler in a named corner was
                   * getting the corner's full 2px ring with nothing inside it,
                   * which reads as a portrait that failed to load rather than
                   * as a gap in the roster. The gap is the point, so it is
                   * drawn as absence.
                   */
                  strokeOpacity={owned && !face ? 0.3 : 1}
                  strokeWidth={selected ? 2.5 : named && face ? 2 : 1}
                />
                {/*
                  The portrait is drawn at `r`, never `rr`. The clip circle is
                  sized at `r`, so a selected portrait drawn larger would be
                  cropped short of its own ring and leave a crescent gap.
                  Selection grows the ring outward and leaves the art put.
                */}
                {face && point.imageUrl ? (
                  <image
                    href={point.imageUrl}
                    x={cx - r}
                    y={cy - r}
                    width={r * 2}
                    height={r * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#radar-${point.brawlerId})`}
                    // Dimmed in the middle, so eighty-five faces still have a
                    // foreground and a background.
                    opacity={owned ? 1 : named ? 1 : 0.72}
                  />
                ) : null}
                <title>{`${titleCaseLabel(point.brawlerName)} — ${formatPercent(point.winRate ?? 0)} win rate, ${formatPercent(point.usageRate ?? 0)} picked`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {open ? (
        <Detail {...open} />
      ) : (
        <Hint count={points.length} windowDays={windowDays} owned={owned} points={points} cuts={cuts} />
      )}
    </div>
  );
}

function Corner({
  x,
  y,
  w,
  h,
  fill,
  label,
  anchor,
  edge,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  label: string;
  anchor: 'start' | 'end';
  /** Which horizontal edge the title hugs; matches the strip left clear above. */
  edge: 'top' | 'bottom';
}) {
  // A corner can be zero-width when every brawler sits on one side of a cut.
  if (w <= 2 || h <= 2) return null;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={fill} fillOpacity={0.07} />
      <text
        x={anchor === 'start' ? x + 10 : x + w - 10}
        y={edge === 'top' ? y + 20 : y + h - 10}
        textAnchor={anchor}
        className="text-[12px] font-bold uppercase tracking-wide"
        fill={fill}
        fillOpacity={0.75}
      >
        {label}
      </text>
    </>
  );
}

function Hint({
  count,
  windowDays,
  owned,
  points,
  cuts,
}: {
  count: number;
  windowDays: number;
  owned?: Set<number>;
  points: RadarPoint[];
  cuts: RadarCuts;
}) {
  if (!owned) {
    return (
      <p className="text-sm text-muted">
        {count} brawlers with enough ranked battles to rate over {windowDays} days. Bubble
        size is the sample behind each one, so the least certain points are the
        smallest. Tap one for its numbers.
      </p>
    );
  }

  /*
   * The top-right corner is the one worth counting. "You own 61 of 85" says
   * almost nothing -- most rosters are most of the roster -- while "7 of the
   * 11 brawlers that are both strong and popular" is the sentence the chart
   * was drawn to support.
   */
  const metaPicks = points.filter((p) => cellOf(p, cuts) === 'meta');
  const sleepers = points.filter((p) => cellOf(p, cuts) === 'sleeper');
  const haveMeta = metaPicks.filter((p) => owned.has(p.brawlerId)).length;
  const haveSleepers = sleepers.filter((p) => owned.has(p.brawlerId)).length;

  return (
    <p className="text-sm leading-relaxed text-muted">
      Lit brawlers are the ones this account can field. It has{' '}
      <span className="font-semibold text-brand">
        {haveMeta} of the {metaPicks.length}
      </span>{' '}
      in the meta corner
      {sleepers.length > 0 ? (
        <>
          {' '}
          and{' '}
          <span className="font-semibold text-victory">
            {haveSleepers} of the {sleepers.length}
          </span>{' '}
          sleepers
        </>
      ) : null}
      . Bubble size is the sample behind each point. Tap one for its numbers.
    </p>
  );
}

function Detail({ point, cell }: { point: RadarPoint; cell: RadarCell }) {
  return (
    <Link
      href={brawlerPath(point.brawlerId, point.brawlerName)}
      className="card flex items-center gap-4 p-4 transition-colors hover:border-brand/40"
    >
      {point.imageUrl ? (
        <Image
          src={point.imageUrl}
          alt=""
          width={52}
          height={52}
          className="size-13 shrink-0 rounded-xl"
          unoptimized
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-black">{titleCaseLabel(point.brawlerName)}</span>
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: CELL_FILL[cell] }}
          >
            {CELL_LABEL[cell]}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-muted">
          <span className="font-semibold text-foreground">
            {formatPercent(point.winRate ?? 0)}
          </span>{' '}
          win rate ·{' '}
          <span className="font-semibold text-foreground">
            {formatPercent(point.usageRate ?? 0)}
          </span>{' '}
          picked · {formatNumber(point.sampleSize)} battles
        </p>
      </div>
    </Link>
  );
}
