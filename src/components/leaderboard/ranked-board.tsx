import { RankedIcon } from "@/components/game-icons";
import Image from "next/image";
import Link from "next/link";

import { TrophyIcon } from "@/components/game-icons";
import { playerIconUrl, rankedLeagueIconUrl } from "@/lib/brawlapi";
import { formatNumber, titleCaseLabel } from "@/lib/format";
import { getRankedLeaderboard } from "@/lib/stats";
import { displayTag } from "@/lib/tags";

/**
 * Top players by Ranked elo.
 *
 * The one board here with no upstream equivalent — the game API publishes
 * trophy rankings for players, clubs and brawlers, and nothing for Ranked. It
 * is therefore built from the standing recorded on each of our own samples,
 * which makes it a ranking of the pool we have seen rather than of the world.
 * Said plainly at the top rather than left for someone to work out from a
 * missing name.
 *
 * Ordered on the live season standing, the same thing the trophy board does.
 * All-time peak rides along on each row as context rather than as the sort
 * key — "who is on top now" is what a leaderboard is for.
 */
export async function RankedBoard() {
  const { players, pool } = await getRankedLeaderboard(100);

  if (players.length === 0) {
    return (
      <div className="card card-glow mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-accent">
          <RankedIcon className="size-7" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Collecting Ranked standings</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Elo is recorded as the sampler works through the player pool, and as
          people look profiles up. This board fills in over the next day or two.
        </p>
      </div>
    );
  }

  return (
    <section>
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted">
        Current season standing. The game API publishes no Ranked leaderboard,
        so this one is built from the {formatNumber(pool)} sampled players who
        have played Ranked this season. The top {players.length} of those, not a
        global board. Looking up a profile adds it to the pool.
      </p>

      <ol className="space-y-1.5">
        {players.map((player, index) => {
          const tier = player.rankName ?? player.peakRankName;
          const badge = rankedLeagueIconUrl(tier);
          return (
            <li key={player.tag}>
              <Link
                href={`/player/${player.tag}`}
                prefetch={false}
                className="row-interactive flex items-center gap-3 rounded-xl p-2.5"
              >
                <span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums text-muted">
                  {index + 1}
                </span>

                <Image
                  src={playerIconUrl(player.iconId ?? undefined)}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-lg bg-surface-2"
                  unoptimized
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {player.name ?? displayTag(player.tag)}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted">
                    {displayTag(player.tag)}
                    {player.trophies ? (
                      <span className="ml-2 inline-flex items-center gap-1 font-sans">
                        <TrophyIcon className="size-3" />
                        {formatNumber(player.trophies)}
                      </span>
                    ) : null}
                  </span>
                </span>

                {tier ? (
                  <span className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold text-muted sm:flex">
                    {badge ? (
                      <Image
                        src={badge}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5"
                        unoptimized
                      />
                    ) : null}
                    {titleCaseLabel(tier)}
                  </span>
                ) : null}

                <span className="w-20 shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-brand">
                    {formatNumber(player.elo)}
                  </span>
                  {/* Peak only when it is actually higher, so a player at their
                      all-time best does not show the same number twice. */}
                  {player.peakElo > player.elo ? (
                    <span className="block text-xs tabular-nums text-muted">
                      peak {formatNumber(player.peakElo)}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
