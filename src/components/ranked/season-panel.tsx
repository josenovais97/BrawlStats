import { CalendarClock, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Power11Icon } from '@/components/game-icons';
import { Disclosure } from '@/components/ui/disclosure';
import { TRIAL_BRAWLER_RULES, type SeasonState } from '@/lib/ranked-seasons';

/**
 * Where the Ranked season is, who you can borrow while it runs, and which maps
 * are in the pool.
 *
 * All three are things people plan around and none is published by any API —
 * see `lib/ranked-seasons` for what was checked. Renders nothing when there is
 * no season to name, which is the honest failure: a stale season number stated
 * confidently is worse than no panel.
 *
 * Compressed to a summary line plus two disclosures. It used to open the page
 * at full height — three portraits, three rules and a thirty-map table — ahead
 * of the recommendations people came for. Which season it is, when it turns
 * over and what is featured are one line; the rest is reference, and reference
 * belongs behind a toggle rather than in front of the answer.
 */
export function SeasonPanel({
  state,
  mapHref,
}: {
  state: SeasonState;
  /** Resolves a wiki map name to one of our map pages, or null if unknown. */
  mapHref: (mode: string, map: string) => string | null;
}) {
  const { current, next, latest, daysUntilNext } = state;
  const season = current ?? next ?? latest;
  if (!season) return null;

  /*
   * Three states, because the source can be ahead of the game or behind it.
   *
   * - running: today falls inside a season we know about.
   * - preview: the next season is published but has not started.
   * - awaiting: the newest season we know of has ended and nothing has replaced
   *   it yet. A new one *is* running — the schedule guarantees that — we just
   *   cannot name it, and saying so is better than carrying on calling the
   *   finished one current.
   */
  const isPreview = !current && Boolean(next);
  const awaiting = !current && !next;

  const countdownLabel = isPreview
    ? 'Starts'
    : next
      ? `Season ${next.number} starts`
      : awaiting
        ? 'Next turnover'
        : 'Ends';
  const countdown =
    daysUntilNext === null
      ? null
      : daysUntilNext === 0
        ? 'today'
        : daysUntilNext === 1
          ? 'tomorrow'
          : `in ${daysUntilNext} days`;

  const poolCount = state.mapPool.reduce((sum, entry) => sum + entry.maps.length, 0);

  return (
    <section className="card overflow-hidden" aria-labelledby="ranked-season">
      <span className="block h-1 w-full bg-gradient-to-r from-accent to-brand" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-accent">
            <Sparkles className="size-3.5" />
            {isPreview ? 'Next season' : awaiting ? 'Season in progress' : 'Current season'}
          </p>
          <h2 id="ranked-season" className="display mt-1.5 text-xl uppercase sm:text-2xl">
            {awaiting ? `After season ${season.number}` : `Ranked season ${season.number}`}
          </h2>
        </div>

        {/* The four facts people plan around, on one line. */}
        <ul className="flex flex-wrap items-center gap-1.5">
          {countdown ? (
            <Chip icon={<CalendarClock className="size-3.5" />} tone="brand">
              {countdownLabel} {countdown}
            </Chip>
          ) : null}
          {season.featuredMode && !awaiting ? (
            <Chip>{season.featuredMode} featured</Chip>
          ) : null}
          {season.brawlers.length > 0 && !awaiting ? (
            <Chip>
              {season.brawlers.length} trial brawler
              {season.brawlers.length === 1 ? '' : 's'}
            </Chip>
          ) : null}
          {poolCount > 0 ? <Chip>{poolCount} maps in the pool</Chip> : null}
        </ul>
      </div>

      {awaiting ? (
        <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted sm:px-5">
          Season {season.number} ended on {formatDay(season.endsOn)}. A new season
          started that day, but its number and trial brawlers have not been published
          yet.
        </p>
      ) : null}

      {season.brawlers.length > 0 && !awaiting ? (
        <div className="border-t border-border px-4 sm:px-5">
          <Disclosure
            tone="bare"
            summary={`Trial brawlers: ${season.brawlers
              .map((b) => titleCase(b.name))
              .join(', ')}`}
          >
            <ul className="grid grid-cols-3 gap-3 sm:max-w-md">
              {season.brawlers.map((brawler) => {
                const accent = brawler.rarity?.color ?? '#8b95b8';
                return (
                  <li key={brawler.id}>
                    <Link
                      href={`/brawlers/${brawler.id}`}
                      className="card card-interactive flex h-full flex-col items-center gap-1.5 p-2.5"
                    >
                      <Image
                        src={brawler.imageUrl}
                        alt=""
                        width={72}
                        height={72}
                        sizes="72px"
                        className="size-14 rounded-xl object-contain sm:size-16"
                        style={{
                          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                        }}
                        loading="lazy"
                        unoptimized
                      />
                      <span className="truncate text-center text-xs font-semibold capitalize">
                        {brawler.name.toLowerCase()}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <ul className="mt-4 space-y-1.5">
              {TRIAL_BRAWLER_RULES.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <Power11Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}

      {state.mapPool.length > 0 ? (
        <div className="border-t border-border px-4 sm:px-5">
          <Disclosure
            tone="bare"
            summary={`Full map pool${
              state.mapPoolSeason !== null && state.mapPoolSeason !== season.number
                ? ` (season ${state.mapPoolSeason})`
                : ''
            }`}
          >
            <div className="space-y-3">
              {state.mapPool.map((entry) => (
                <div
                  key={entry.mode}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5"
                >
                  <span className="w-24 shrink-0 text-sm font-semibold text-foreground">
                    {entry.mode}
                    {entry.featured ? (
                      <span className="ml-1.5 rounded bg-brand/15 px-1 py-0.5 text-xs font-bold uppercase text-brand">
                        Featured
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {entry.maps.map((map) => {
                      const href = mapHref(entry.mode, map);
                      return href ? (
                        <Link
                          key={map}
                          href={href}
                          className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:text-brand"
                        >
                          {map}
                        </Link>
                      ) : (
                        <span
                          key={map}
                          className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-muted"
                        >
                          {map}
                        </span>
                      );
                    })}
                  </span>
                </div>
              ))}
            </div>

            {/* Both facts matter to how the rankings above should be read: the
                pool is fixed for the season, and nothing is modifying the
                games. */}
            <p className="mt-4 text-xs leading-relaxed">
              The pool is fixed for the season. Modifiers were removed from Ranked in
              the February 2025 rework, so every battle counted here is the plain mode
              on the plain map.{' '}
              {state.source === 'wiki' ? (
                <>
                  Season and pool data from the{' '}
                  <a
                    href="https://brawlstars.fandom.com/wiki/Ranked"
                    rel="noreferrer noopener"
                    target="_blank"
                    className="font-medium text-brand hover:underline"
                  >
                    Brawl Stars Wiki
                  </a>
                  , CC-BY-SA.
                </>
              ) : null}
            </p>
          </Disclosure>
        </div>
      ) : null}

      {/* Said plainly when the successor has not been announced: the date comes
          from the published cadence, not from a line-up anyone has seen. */}
      {!next && !isPreview && !awaiting && daysUntilNext !== null ? (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted sm:px-5">
          Turnover date from the published schedule (third Thursday); the next
          line-up has not been announced.
        </p>
      ) : null}
    </section>
  );
}

function Chip({
  children,
  icon,
  tone = 'plain',
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'plain' | 'brand';
}) {
  return (
    <li
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
        tone === 'brand'
          ? 'bg-brand/15 text-brand'
          : 'border border-border bg-surface-2/60 text-muted'
      }`}
    >
      {icon}
      {children}
    </li>
  );
}

/** "17 September 2026". */
function formatDay(iso: string | null): string {
  if (!iso) return 'an unknown date';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "BERRY" -> "Berry", for the summary line. */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase());
}
