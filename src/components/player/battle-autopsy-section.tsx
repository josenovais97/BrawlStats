import { PlayerAutopsy } from '@/components/player/player-autopsy';
import { battleAutopsy } from '@/lib/battle-autopsy';
import { getBattleLog } from '@/lib/bs-api';
import { getLadderMapForm } from '@/lib/stats';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';

/**
 * Loads the log and the map form, then hands both to the autopsy.
 *
 * A server component of its own so it can sit inside the same `Suspense`
 * boundary style as the battle log beside it: the game API call is the slow
 * part of a profile, and neither section should hold up the rest of the page.
 *
 * Renders nothing when there is no pattern to report, which is the common case
 * on a short log or a good run. An empty "what went wrong" heading over "no
 * findings" would be a section that exists to describe its own absence.
 */
export async function BattleAutopsySection({
  tag,
  playerTag,
  brawlerMeta,
  modeMeta,
}: {
  tag: string;
  playerTag: string;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  const [log, form] = await Promise.all([
    getBattleLog(tag)
      .then((r) => r.items)
      .catch(() => []),
    getLadderMapForm().catch(() => new Map()),
  ]);

  const autopsy = battleAutopsy({ log, tag: playerTag, form });
  if (!autopsy) return null;

  return <PlayerAutopsy autopsy={autopsy} brawlerMeta={brawlerMeta} modeMeta={modeMeta} />;
}
