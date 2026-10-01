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
  isNamed,
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
const PAD = { top: 18, right: 18, bottom: 44, left: 56 };

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
  points,
  cuts,
  windowDays,
}: {
  points: RadarPoint[];
  cuts: RadarCuts;
  windowDays: number;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  const layout = useMemo(() => {
    const scales = radarScales(points, cuts);
    if (!scales) return null;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const maxSample = Math.max(...points.map((p) => p.sampleSize), 1);

    return {
      scales,
      plotW,
      plotH,
      x: (usage: number) => PAD.left + scales.x.at(usage) * plotW,
      // Inverted: SVG y grows downward and a win rate does not.
      y: (score: number) => PAD.top + (1 - scales.y.at(score)) * plotH,
      placed: points
        .map((p) => {
          const cell = cellOf(p, cuts);
          /*
           * A face only where the page makes a claim. The middle of the pack
           * and the out-of-favour corner stay as dots: 66 of the 85 are in
           * those two, and portraits on all of them would bury the nineteen
           * that are the whole point of the chart.
           */
          const named = isNamed(cell) && p.imageUrl !== null;
          return {
            point: p,
            cell,
            named,
            r: named
              ? portraitRadius(p.sampleSize, maxSample)
              : radiusFor(p.sampleSize, maxSample),
          };
        })
        /*
         * Biggest first, so the heavily-sampled giants are painted under the
         * small ones. Drawn the other way round, a 5,000-battle bubble sits on
         * top of every floor-sample point near it and they become untappable.
         */
        .sort((a, b) => b.r - a.r),
    };
  }, [points, cuts]);

  if (!layout) return null;

  const open = layout.placed.find((p) => p.point.brawlerId === openId) ?? null;

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden p-3 sm:p-4">
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
            w={layout.x(cuts.lowUsage) - PAD.left}
            h={layout.y(cuts.strong) - PAD.top}
            fill="var(--victory)"
            label="Sleepers"
            anchor="start"
          />
          <Corner
            x={layout.x(cuts.highUsage)}
            y={PAD.top}
            w={W - PAD.right - layout.x(cuts.highUsage)}
            h={layout.y(cuts.strong) - PAD.top}
            fill="var(--brand)"
            label="Meta"
            anchor="end"
          />
          <Corner
            x={PAD.left}
            y={layout.y(cuts.weak)}
            w={layout.x(cuts.lowUsage) - PAD.left}
            h={H - PAD.bottom - layout.y(cuts.weak)}
            fill="var(--muted)"
            label="Out of favour"
            anchor="start"
          />
          <Corner
            x={layout.x(cuts.highUsage)}
            y={layout.y(cuts.weak)}
            w={W - PAD.right - layout.x(cuts.highUsage)}
            h={H - PAD.bottom - layout.y(cuts.weak)}
            fill="var(--defeat)"
            label="Overrated"
            anchor="end"
          />

          {/* The cuts themselves. */}
          {[cuts.lowUsage, cuts.highUsage].map((v) => (
            <line
              key={`x${v}`}
              x1={layout.x(v)}
              x2={layout.x(v)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--border-strong)"
              strokeDasharray="4 4"
            />
          ))}
          {[cuts.weak, cuts.strong].map((v) => (
            <line
              key={`y${v}`}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={layout.y(v)}
              y2={layout.y(v)}
              stroke="var(--border-strong)"
              strokeDasharray="4 4"
            />
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
            y={H - 10}
            textAnchor="middle"
            className="fill-[var(--muted)] text-[13px]"
          >
            How often it is picked →
          </text>
          <text
            x={-(PAD.top + layout.plotH / 2)}
            y={14}
            transform="rotate(-90)"
            textAnchor="middle"
            className="fill-[var(--muted)] text-[13px]"
          >
            How well it does →
          </text>

          {/* One clip per named brawler, so each portrait is round. */}
          <defs>
            {layout.placed
              .filter((p) => p.named)
              .map(({ point, r }) => (
                <clipPath key={point.brawlerId} id={`radar-${point.brawlerId}`}>
                  <circle
                    cx={layout.x(point.usageRate ?? 0)}
                    cy={layout.y(point.metaScore)}
                    r={r}
                  />
                </clipPath>
              ))}
          </defs>

          {layout.placed.map(({ point, cell, named, r }) => {
            const selected = point.brawlerId === openId;
            const cx = layout.x(point.usageRate ?? 0);
            const cy = layout.y(point.metaScore);
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
                  fillOpacity={named ? 1 : cell === 'middle' ? 0.35 : 0.65}
                  stroke={selected ? 'var(--foreground)' : CELL_FILL[cell]}
                  strokeWidth={selected ? 2.5 : named ? 2 : 1}
                />
                {/*
                  The portrait is drawn at `r`, never `rr`. The clip circle is
                  sized at `r`, so a selected portrait drawn larger would be
                  cropped short of its own ring and leave a crescent gap.
                  Selection grows the ring outward and leaves the art put.
                */}
                {named && point.imageUrl ? (
                  <image
                    href={point.imageUrl}
                    x={cx - r}
                    y={cy - r}
                    width={r * 2}
                    height={r * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#radar-${point.brawlerId})`}
                  />
                ) : null}
                <title>{`${titleCaseLabel(point.brawlerName)} — ${formatPercent(point.winRate ?? 0)} win rate, ${formatPercent(point.usageRate ?? 0)} picked`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {open ? <Detail {...open} /> : <Hint count={points.length} windowDays={windowDays} />}
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
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  label: string;
  anchor: 'start' | 'end';
}) {
  // A corner can be zero-width when every brawler sits on one side of a cut.
  if (w <= 2 || h <= 2) return null;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={fill} fillOpacity={0.07} />
      <text
        x={anchor === 'start' ? x + 10 : x + w - 10}
        y={y + 20}
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

function Hint({ count, windowDays }: { count: number; windowDays: number }) {
  return (
    <p className="text-sm text-muted">
      {count} brawlers with enough ranked battles to rate over {windowDays} days. Bubble
      size is the sample behind each one, so the least certain points are the
      smallest. Tap one for its numbers.
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
