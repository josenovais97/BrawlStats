import { CalendarClock, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Power11Icon } from '@/components/game-icons';
import { TRIAL_BRAWLER_RULES, type SeasonState } from '@/lib/ranked-seasons';

/**
 * Where the Ranked season is, and who you can borrow while it runs.
 *
 * Both halves are things people plan around and neither is published by any
 * API — see `lib/ranked-seasons`. Renders nothing at all when the curated table
 * has run out, which is the honest failure: a stale season number stated
 * confidently is worse than no season panel.
 */
export function SeasonPanel({ state }: { state: SeasonState }) {
  const { current, next, daysUntilNext } = state;
  if (!current && !next) return null;

  // Between the last entry ending and the next being announced there is no
  // current season; the upcoming one is then the only thing worth showing.
  const season = current ?? next!;
  const isPreview = !current;

  return (
    <section className="card card-glow overflow-hidden" aria-labelledby="ranked-season">
      <span className="block h-1 w-full bg-gradient-to-r from-accent to-brand" />

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-accent">
            <Sparkles className="size-3.5" />
            {isPreview ? 'Next season' : 'Current season'}
          </p>
          <h2 id="ranked-season" className="display mt-2 text-2xl uppercase sm:text-3xl">
            Ranked season {season.number}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {formatRange(season.startsOn, season.endsOn)}
            {season.newMapsMode ? ` · new ${season.newMapsMode} maps` : ''}
          </p>
        </div>

        {daysUntilNext !== null && next ? (
          <div className="rounded-2xl border border-border bg-surface-2/60 px-4 py-3 text-right">
            <p className="flex items-center justify-end gap-1.5 text-xs uppercase tracking-wide text-muted">
              <CalendarClock className="size-3.5" />
              {isPreview ? 'Starts' : `Season ${next.number} starts`}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-brand">
              {daysUntilNext === 0
                ? 'Today'
                : daysUntilNext === 1
                  ? 'Tomorrow'
                  : `in ${daysUntilNext} days`}
            </p>
          </div>
        ) : null}
      </div>

      {season.brawlers.length > 0 ? (
        <div className="border-t border-border p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
            <Power11Icon className="size-4" />
            Trial brawlers
          </h3>

          <ul className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
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
                      style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
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

          <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-muted">
            {TRIAL_BRAWLER_RULES.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-brand" />
                {rule}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** "16 July – 19 August 2026", or an open-ended range when the end is unknown. */
function formatRange(startsOn: string, endsOn: string | null): string {
  const fmt = (iso: string, withYear: boolean) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });

  if (!endsOn) return `From ${fmt(startsOn, true)}`;

  // The last day of the season is the day before the next one starts.
  const lastDay = new Date(Date.parse(`${endsOn}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);

  return `${fmt(startsOn, false)} – ${fmt(lastDay, true)}`;
}
