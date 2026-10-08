import {
  BattleLogView,
  type BattleEntry,
  type BattleParticipant,
  type BattleTone,
} from '@/components/player/battle-log-view';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { brawlerArt } from '@/lib/brawler-art';
import { getBattleLog } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { humanizeMode, ordinal, relativeTime } from '@/lib/format';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSBattleLogEntry, BSBattlePlayer, BSPlayerBrawler } from '@/types/brawlstars';

interface BattleLogProps {
  /** Tag used for the lookup (no "#"). */
  tag: string;
  /** Canonical tag from the player payload, used to find them in each battle. */
  playerTag: string;
  brawlerMeta: Map<number, BABrawler>;
  /** For the mode artwork on each row. */
  modeMeta: Map<string, BAGameMode>;
  /** The account's roster, for the skins its session brawlers have equipped. */
  brawlers?: BSPlayerBrawler[];
}

/**
 * Fetches the log and flattens it into something a client component can hold.
 *
 * The view is client-side because the filters are, and the boundary is drawn
 * here rather than around the whole section so that the flattening — joining
 * every participant to their artwork, resolving outcomes, formatting times —
 * still happens once on the server. What crosses is plain JSON with the icon
 * URLs already resolved: no `Map`, no `BABrawler`, and no date arithmetic that
 * could disagree between the render and the hydration.
 */
export async function BattleLog({
  tag,
  playerTag,
  brawlerMeta,
  modeMeta,
  brawlers = [],
}: BattleLogProps) {
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

  const view = entries.map((entry, index) =>
    toViewEntry(entry, index, playerTag, brawlerMeta, modeMeta),
  );

  // The session card draws the most-played brawler the way the rest of the
  // profile does -- in the skin this account has equipped. Only the brawlers
  // actually in the log are looked up, and a failure costs the skin, not the
  // log.
  const played = new Set(view.map((v) => v.brawlerId).filter((id): id is number => id !== null));
  const art = await brawlerArt(
    brawlers.filter((b) => played.has(b.id)),
    brawlerMeta,
  ).catch(() => new Map<number, string>());
  for (const v of view) {
    if (v.brawlerId === null) continue;
    v.artUrl = art.get(v.brawlerId) ?? v.iconUrl;
    v.tint = brawlerMeta.get(v.brawlerId)?.rarity.color ?? null;
  }

  return <BattleLogView entries={view} />;
}

function toViewEntry(
  entry: BSBattleLogEntry,
  index: number,
  playerTag: string,
  brawlerMeta: Map<number, BABrawler>,
  modeMeta: Map<string, BAGameMode>,
): BattleEntry {
  const { battle, event } = entry;
  const self = playerTag.toUpperCase();

  const me = allParticipants(entry).find((p) => p.tag.toUpperCase() === self);
  const myBrawler = me?.brawler ?? me?.brawlers?.[0];
  const outcome = resolveOutcome(entry);

  const lineup = battle.teams ?? (battle.players ? [battle.players] : []);
  const starTag = battle.starPlayer?.tag?.toUpperCase();

  const teams: BattleParticipant[][] = lineup.map((team) =>
    team.map((participant): BattleParticipant => {
      const brawler = participant.brawler ?? participant.brawlers?.[0];
      return {
        tag: participant.tag,
        name: participant.name,
        brawlerName: brawler?.name ?? null,
        brawlerPower: brawler?.power ?? null,
        brawlerTrophies: brawler?.trophies ?? null,
        iconUrl: brawler
          ? (brawlerMeta.get(brawler.id)?.imageUrl ?? brawlerIconUrl(brawler.id))
          : null,
        isStar: starTag === participant.tag.toUpperCase(),
        isSelf: participant.tag.toUpperCase() === self,
      };
    }),
  );

  return {
    key: `${entry.battleTime}-${index}`,
    outcomeLabel: outcome.label,
    tone: outcome.tone,
    mode: humanizeMode(battle.mode ?? event.mode),
    modeIconUrl:
      modeMeta.get((battle.mode ?? event.mode ?? '').toLowerCase())?.imageUrl ?? null,
    map: event.map ?? 'Unknown map',
    type: battle.type ? humanizeMode(battle.type) : 'Casual',
    relative: relativeTime(entry.battleTime),
    trophyChange: battle.trophyChange ?? myBrawler?.trophyChange ?? null,
    brawlerName: myBrawler?.name ?? null,
    brawlerId: myBrawler?.id ?? null,
    artUrl: null,
    tint: null,
    iconUrl: myBrawler
      ? (brawlerMeta.get(myBrawler.id)?.imageUrl ?? brawlerIconUrl(myBrawler.id))
      : null,
    isStarPlayer: starTag === self,
    teams,
    isTeamMode: Boolean(battle.teams),
  };
}

/** Flattens team and free-for-all payloads into one list of participants. */
function allParticipants(entry: BSBattleLogEntry): BSBattlePlayer[] {
  const { teams, players } = entry.battle;
  if (teams) return teams.flat();
  if (players) return players;
  return [];
}

/**
 * Team modes report `result`; showdown-style modes report a placement in
 * `rank`. Anything with neither (a friendly or an unfinished match) is neutral.
 */
function resolveOutcome(entry: BSBattleLogEntry): { label: string; tone: BattleTone } {
  const { result, rank } = entry.battle;

  if (result === 'victory') return { label: 'Victory', tone: 'win' };
  if (result === 'defeat') return { label: 'Defeat', tone: 'loss' };
  if (result === 'draw') return { label: 'Draw', tone: 'draw' };

  if (typeof rank === 'number') {
    // Solo showdown pays out for the top 4 of 10; duo for the top 2 of 5.
    return {
      label: `${ordinal(rank)} place`,
      tone: rank <= 4 ? 'win' : 'loss',
    };
  }

  return { label: 'Played', tone: 'draw' };
}
