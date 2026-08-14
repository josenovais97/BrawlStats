import { Crown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBattleLog } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { humanizeMode, ordinal, relativeTime } from '@/lib/format';
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

  return (
    <div
      className="card flex items-center gap-3 p-3"
      style={{ borderLeft: `3px solid ${outcome.color}` }}
    >
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
              <Crown className="size-3" />
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
