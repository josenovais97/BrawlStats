import { TrophyGainIcon } from '@/components/game-icons';
import Link from 'next/link';

import { TrophyIcon } from '@/components/game-icons';
import { formatNumber } from '@/lib/format';
import { getTrophyGains } from '@/lib/stats';

/** Podium colours for the first three. Everything below is neutral. */
const PODIUM = ['#ffc53d', '#c9d3ee', '#e08a4a'];

/**
 * Fewer rows than this and the section is hidden rather than shown half empty.
 *
 * A gain needs two snapshots of the same player, and sampling walks the pool
 * least-recently-sampled first, so nobody has a second snapshot until the
 * rotation wraps all the way round. One lonely row reads as broken; no section
 * reads as intentional, which matches how the rest of the site degrades.
 */
const MIN_ROWS = 3;

/** Biggest trophy climbers, from each player's own two most recent snapshots. */
export async function TrophyGains({ limit = 5 }: { limit?: number }) {
  const gains = await getTrophyGains(limit);
  if (gains.length < MIN_ROWS) return null;

  // Bars are scaled on the daily rate, which is also what the list is ranked
  // by, so the longest bar is always the top row.
  const topRate = gains[0].gain / gains[0].days;
  const uniformSpan = gains.every((g) => g.days === gains[0].days) ? gains[0].days : null;

  return (
    <section aria-labelledby="trophy-gains" className="reveal">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-defeat">
            <TrophyGainIcon className="size-4" />
            Climbing fastest
          </p>
          <h2 id="trophy-gains" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
            Biggest trophy gains{uniformSpan === 1 ? ' today' : ''}
          </h2>
          {/*
            The population is stated up front because this list sits directly
            above the official top 100 and looked like a re-ordering of it. It
            is not: these are the players we sample daily, most of whom are
            nowhere near the global board, and a name appearing here while
            missing below is the expected case rather than a bug.
          */}
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            From our own daily snapshots of the{' '}
            <Link href="/about" className="font-medium text-brand hover:underline">
              sampled player pool
            </Link>
            , ranked by trophies per day since each player was last read. A different
            population from the official top 100 below, so these names mostly do not
            appear there.
          </p>
        </div>
      </div>

      <ol className="card divide-y divide-border overflow-hidden">
        {gains.map((player, index) => {
          const podium = PODIUM[index];
          // Bar length is relative to the biggest gain, so the leader always
          // fills the row and the rest are legible as a proportion of it.
          const width =
            topRate > 0 ? Math.max(4, (player.gain / player.days / topRate) * 100) : 0;

          return (
            <li key={player.tag} className="relative">
              {/*
                The bar sits behind the row rather than beside it: a separate
                chart column would squeeze the name on a phone, and this way the
                magnitude reads at any width.

                It fades out rather than stopping, and carries a lit cap at its
                end. A flat fill ending on a hard vertical edge gave four rows
                four unexplained vertical lines at four different positions,
                which read as a rendering fault rather than as a chart — the
                more so because the leader's bar is full width and so has no
                edge at all to compare them to.
              */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0"
                style={{
                  width: `${width}%`,
                  background:
                    'linear-gradient(90deg, color-mix(in srgb, var(--defeat) 13%, transparent), color-mix(in srgb, var(--defeat) 4%, transparent))',
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-1 w-px rounded-full bg-defeat/40"
                style={{ left: `calc(${width}% - 1px)` }}
              />
              <Link
                href={`/player/${player.tag}`}
                className="row-interactive relative flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5"
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-sm font-black tabular-nums sm:size-8"
                  style={
                    podium
                      ? {
                          background: `color-mix(in srgb, ${podium} 18%, transparent)`,
                          color: podium,
                          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${podium} 35%, transparent)`,
                        }
                      : { color: 'var(--muted)' }
                  }
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-tight">
                    {player.name ?? `#${player.tag}`}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted">
                    <TrophyIcon className="size-3" />
                    <span className="tabular-nums">{formatNumber(player.trophies)}</span>
                    <span aria-hidden>total</span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="display text-base leading-none tabular-nums text-victory sm:text-lg">
                    +{formatNumber(player.gain)}
                  </p>
                  {/*
                    Spans differ per player because sampling rotates, so each
                    row states its own. Hidden when every row shares one.
                  */}
                  {uniformSpan === null ? (
                    <p className="mt-1 text-[0.625rem] uppercase tracking-wide text-muted">
                      {player.days === 1 ? 'in 1 day' : `in ${player.days} days`}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
