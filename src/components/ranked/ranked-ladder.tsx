import { SectionHeading } from '@/components/ui/section-heading';
import { rankedLeagueIconUrl } from '@/lib/brawlapi';
import { formatNumber, titleCaseLabel } from '@/lib/format';
import type { RankedRung } from '@/lib/stats';
import Image from 'next/image';

/**
 * How crowded each rung of the Ranked ladder actually is.
 *
 * The game gives no Ranked leaderboard and no rank distribution — there is no
 * endpoint for either — so "what fraction of players reach Mythic" has no
 * published answer anywhere. It has one here only because the sampler records
 * each player's rank as it goes, which makes this one of the few numbers on
 * the site that genuinely cannot be looked up elsewhere.
 *
 * Bars are scaled against the *largest* rung rather than against the whole
 * population, because the ladder is lopsided: scaled against the total, every
 * rung above Diamond would be a line one pixel wide and the shape of the thing
 * would be invisible.
 */
export function RankedLadder({ ladder }: { ladder: RankedRung[] }) {
  if (ladder.length === 0) return null;

  const population = ladder.reduce((sum, rung) => sum + rung.players, 0);
  const widest = Math.max(...ladder.map((rung) => rung.players));

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Where everyone actually is"
        subtitle={`Every rung of the Ranked ladder across ${formatNumber(population)} sampled players. The game publishes no rank distribution; this is measured from what the sampler sees.`}
      />

      <ol className="card divide-y divide-border overflow-hidden">
        {[...ladder].reverse().map((rung) => (
          <li
            key={rung.rank}
            className="flex items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4"
          >
            {/* The game's own badge, so a rung is recognisable at a glance
                rather than read as a string. */}
            <RungBadge rank={rung.rank} />

            <span className="w-24 shrink-0 text-xs font-bold capitalize leading-tight sm:w-32 sm:text-sm">
              {titleCaseLabel(rung.rank)}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className="block h-2.5 rounded-full bg-accent/70"
                style={{ width: `${Math.max(2, (rung.players / widest) * 100)}%` }}
              />
            </span>

            <span className="w-12 shrink-0 text-right text-xs font-black tabular-nums sm:w-16">
              {share(rung.share)}
            </span>

            {/* The cumulative figure is the one people quote — "only 4% get
                past Mythic" — so it is printed rather than left to be worked
                out from the bars. */}
            <span className="hidden w-28 shrink-0 text-right text-xs tabular-nums text-muted sm:block">
              {share(rung.atOrAbove)} here or above
            </span>
          </li>
        ))}
      </ol>

      <p className="px-1 text-xs leading-relaxed text-muted">
        Sampled from players reachable through the global leaderboards and their
        recent opponents, so it leans slightly toward more active accounts than
        the game as a whole. Players who have not played Ranked this season are
        excluded rather than counted at the bottom.
      </p>
    </section>
  );
}

/** The league badge, or nothing. One image per rung, not per player. */
function RungBadge({ rank }: { rank: string }) {
  const src = rankedLeagueIconUrl(rank);
  return (
    <span className="grid size-8 shrink-0 place-items-center">
      {src ? (
        <Image
          src={src}
          alt=""
          width={32}
          height={32}
          className="size-8 object-contain"
          loading="lazy"
          unoptimized
        />
      ) : null}
    </span>
  );
}

/**
 * A share, without claiming precision the sample does not have.
 *
 * Masters II held two of 8,327 players on the day this shipped, which
 * `toFixed(1)` rendered as "0.0%" — the top of the ladder, the rung readers
 * are most curious about, reading as nobody. A second decimal would say
 * "0.02%", which two players cannot support either.
 */
function share(value: number): string {
  const pct = value * 100;
  if (pct > 0 && pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}
