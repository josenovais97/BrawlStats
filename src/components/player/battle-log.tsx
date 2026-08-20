import { ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { CrownIcon, TrophyIcon } from '@/components/game-icons';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBattleLog } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { formatNumber, humanizeMode, ordinal, relativeTime } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';
import type { BABrawler } from '@/types/brawlapi';
import type {
  BSBattleLogEntry,
  BSBattlePlayer,
} from '@/types/brawlstars';

interface BattleLogProps {
  /** Tag used for the lookup (no "#"). */
  tag: string;
  /** Canonical tag from the player payload, used to find them in each battle. */
  playerTag: string;
  brawlerMeta: Map<number, BABrawler>;
}

export async function BattleLog({ tag, playerTag, brawlerMeta }: BattleLogProps) {
  let entries: BSBattleLogEntry[];
  try {
    entries = (await getBattleLog(tag)).items;
  } catch (err) {
    const { code } = toApiError(err);
    return (
      <div className="card p-6 text-sm text-muted">
        {code === 'notFound'
          ? 'No recent battles. The battle log only covers roughly the last 25 matches and expires after a while.'
          : 'The battle log is unavailable right now. Try refreshing in a moment.'}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="card p-6 text-sm text-muted">
        No battles recorded in the last 25 matches.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <li key={`${entry.battleTime}-${index}`}>
          <BattleRow entry={entry} playerTag={playerTag} brawlerMeta={brawlerMeta} />
        </li>
      ))}
    </ol>
  );
}

/** Flattens team and free-for-all payloads into one list of participants. */
function allParticipants(entry: BSBattleLogEntry): BSBattlePlayer[] {
  const { teams, players } = entry.battle;
  if (teams) return teams.flat();
  if (players) return players;
  return [];
}

function BattleRow({
  entry,
  playerTag,
  brawlerMeta,
}: {
  entry: BSBattleLogEntry;
  playerTag: string;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const { battle, event } = entry;

  const me = allParticipants(entry).find(
    (p) => p.tag.toUpperCase() === playerTag.toUpperCase(),
  );
  const brawlerId = me?.brawler?.id ?? me?.brawlers?.[0]?.id;
  const brawlerName = me?.brawler?.name ?? me?.brawlers?.[0]?.name;
  const meta = brawlerId !== undefined ? brawlerMeta.get(brawlerId) : undefined;

  const outcome = resolveOutcome(entry);
  const isStarPlayer =
    battle.starPlayer?.tag?.toUpperCase() === playerTag.toUpperCase();

  const trophyChange = battle.trophyChange ?? me?.brawler?.trophyChange;

  const lineup = battle.teams ?? (battle.players ? [battle.players] : []);

  return (
    /*
      Native <details> rather than a client component: this list renders up to
      25 battles, and a disclosure per row is the kind of thing that should
      never cost a hydration boundary.
    */
    <details
      className="card group overflow-hidden"
      style={{ borderLeft: `3px solid ${outcome.color}` }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
        {brawlerId !== undefined ? (
          <Image
            src={meta?.imageUrl ?? brawlerIconUrl(brawlerId)}
            alt={brawlerName ?? ''}
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-lg bg-surface-2"
            unoptimized
          />
        ) : (
          <div className="size-12 shrink-0 rounded-lg bg-surface-2" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold" style={{ color: outcome.color }}>
              {outcome.label}
            </span>
            <span className="text-muted">·</span>
            <span className="truncate text-sm font-medium">
              {humanizeMode(battle.mode ?? event.mode)}
            </span>
            {isStarPlayer ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
                <CrownIcon className="size-3.5" />
                Star player
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {event.map ?? 'Unknown map'} · {battle.type ? humanizeMode(battle.type) : 'Casual'} ·{' '}
            {relativeTime(entry.battleTime)}
          </p>
        </div>

        {typeof trophyChange === 'number' && trophyChange !== 0 ? (
          <span
            className={`flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums ${
              trophyChange > 0 ? 'text-victory' : 'text-defeat'
            }`}
          >
            {trophyChange > 0 ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
            {trophyChange > 0 ? `+${trophyChange}` : trophyChange}
          </span>
        ) : (
          <Minus className="size-4 shrink-0 text-muted/50" />
        )}

          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
          />
      </summary>

      {lineup.length > 0 ? (
        <Lineup
          teams={lineup}
          starPlayerTag={battle.starPlayer?.tag}
          playerTag={playerTag}
          brawlerMeta={brawlerMeta}
          isTeamMode={Boolean(battle.teams)}
        />
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          This battle reported no player list.
        </p>
      )}
    </details>
  );
}

/**
 * Every participant, grouped by team.
 *
 * Showdown payloads arrive as a flat `players` array rather than `teams`, so
 * those are passed in as a single pseudo-team and rendered without the "Team 1
 * / Team 2" headings that would be meaningless there.
 */
function Lineup({
  teams,
  starPlayerTag,
  playerTag,
  brawlerMeta,
  isTeamMode,
}: {
  teams: BSBattlePlayer[][];
  starPlayerTag?: string;
  playerTag: string;
  brawlerMeta: Map<number, BABrawler>;
  isTeamMode: boolean;
}) {
  return (
    <div className="border-t border-border bg-surface-2/30 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((team, teamIndex) => (
          <div key={teamIndex}>
            {isTeamMode && teams.length > 1 ? (
              <p className="eyebrow mb-2">Team {teamIndex + 1}</p>
            ) : null}
            <ul className="space-y-1">
              {team.map((participant) => {
                const brawler = participant.brawler ?? participant.brawlers?.[0];
                const meta = brawler ? brawlerMeta.get(brawler.id) : undefined;
                const isStar =
                  starPlayerTag?.toUpperCase() === participant.tag.toUpperCase();
                const isSelf =
                  participant.tag.toUpperCase() === playerTag.toUpperCase();

                return (
                  <li key={participant.tag}>
                    <Link
                      href={`/player/${normalizeTag(participant.tag)}`}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-3 ${
                        isSelf ? 'bg-brand/10 ring-1 ring-inset ring-brand/25' : ''
                      }`}
                    >
                      {brawler ? (
                        <Image
                          src={meta?.imageUrl ?? brawlerIconUrl(brawler.id)}
                          alt={brawler.name}
                          width={32}
                          height={32}
                          className="size-8 shrink-0 rounded-md bg-surface-2"
                          loading="lazy"
                          unoptimized
                        />
                      ) : (
                        <span className="size-8 shrink-0 rounded-md bg-surface-2" />
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`truncate text-sm ${
                              isSelf ? 'font-bold text-brand' : 'font-medium'
                            }`}
                          >
                            {participant.name}
                          </span>
                          {isStar ? (
                            <CrownIcon className="size-3.5 shrink-0" />
                          ) : null}
                        </span>
                        <span className="block truncate text-xs capitalize text-muted">
                          {brawler ? brawler.name.toLowerCase() : 'Unknown brawler'}
                          {brawler?.power ? ` · power ${brawler.power}` : ''}
                        </span>
                      </span>

                      {brawler ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-muted">
                          <TrophyIcon className="size-3" />
                          {formatNumber(brawler.trophies)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Team modes report `result`; showdown-style modes report a placement in
 * `rank`. Anything with neither (a friendly or an unfinished match) is neutral.
 */
function resolveOutcome(entry: BSBattleLogEntry): { label: string; color: string } {
  const { result, rank } = entry.battle;

  if (result === 'victory') return { label: 'Victory', color: 'var(--victory)' };
  if (result === 'defeat') return { label: 'Defeat', color: 'var(--defeat)' };
  if (result === 'draw') return { label: 'Draw', color: 'var(--draw)' };

  if (typeof rank === 'number') {
    // Solo showdown pays out for the top 4 of 10; duo for the top 2 of 5.
    const good = rank <= 4;
    return {
      label: `${ordinal(rank)} place`,
      color: good ? 'var(--victory)' : 'var(--defeat)',
    };
  }

  return { label: 'Played', color: 'var(--draw)' };
}
