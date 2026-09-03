import { DraftAutopsyCard } from '@/components/player/draft-autopsy-card';
import { PlayerAutopsy } from '@/components/player/player-autopsy';
import { SectionHeading } from '@/components/ui/section-heading';
import { battleAutopsy } from '@/lib/battle-autopsy';
import { getBattleLog } from '@/lib/bs-api';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { draftAutopsy, type DraftAutopsy } from '@/lib/draft-autopsy';
import {
  getBrawlerPairings,
  getLadderMapForm,
  getRoleCompositions,
  type MapForm,
} from '@/lib/stats';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSBattleLogEntry, BSPlayer } from '@/types/brawlstars';
import { normalizeTag } from '@/lib/tags';

/**
 * Loads everything the two autopsies need, then hands each its own inputs.
 *
 * A server component of its own so it can sit inside a `Suspense` boundary: the
 * game API call is the slow part of a profile, and neither section should hold
 * up the rest of the page.
 *
 * Two readings of the same log, in the order a reader wants them. The most
 * recent loss gets explained in full, because that is the one still on their
 * mind; the patterns underneath answer the different question of whether it
 * keeps happening. Both render nothing when there is nothing to say.
 */
export async function BattleAutopsySection({
  tag,
  player,
  brawlerMeta,
  modeMeta,
}: {
  tag: string;
  player: BSPlayer;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  const [log, form] = await Promise.all([
    getBattleLog(tag)
      .then((r) => r.items)
      .catch(() => [] as BSBattleLogEntry[]),
    getLadderMapForm().catch(() => new Map<string, MapForm[]>()),
  ]);

  const me = normalizeTag(player.tag);
  const patterns = battleAutopsy({ log, tag: player.tag, form });

  /*
   * The most recent 3v3 loss, which is the only shape this can read: a showdown
   * placement has no opposing draft to compare against.
   */
  const lastLoss = log.find(
    (entry) =>
      entry.battle.result === 'defeat' &&
      (entry.battle.teams?.length ?? 0) >= 2 &&
      Boolean(entry.event?.map),
  );

  let deep: DraftAutopsy | null = null;
  if (lastLoss) {
    const mapForm = new Map<number, MapForm>(
      (form.get(lastLoss.event?.map ?? '') ?? []).map((row) => [row.brawlerId, row]),
    );

    const myTeam =
      lastLoss.battle.teams?.find((team) => team.some((p) => normalizeTag(p.tag) === me)) ?? [];
    const myIds = myTeam
      .map((p) => p.brawler?.id)
      .filter((id): id is number => id !== undefined);

    const [pairs, shapes, catalogue] = await Promise.all([
      Promise.all(
        myIds.map(async (id) => [id, await getBrawlerPairings(id).catch(() => null)] as const),
      ),
      getRoleCompositions().catch(() => null),
      getBrawlerCatalog().catch(() => null),
    ]);

    deep = draftAutopsy({
      entry: lastLoss,
      tag: player.tag,
      mapForm,
      pairings: new Map(
        pairs.filter((entry): entry is [number, NonNullable<(typeof entry)[1]>] => entry[1] !== null),
      ),
      roles: new Map((catalogue?.all ?? []).map((b) => [b.id, b.className])),
      shapes,
      roster: player.brawlers,
    });
  }

  if (!deep && !patterns) return null;

  return (
    <section className="space-y-4">
      <SectionHeading
        title="What went wrong"
        subtitle="The last loss read against the map and the matchups, then the patterns across the whole log."
      />

      {deep ? (
        <DraftAutopsyCard autopsy={deep} brawlerMeta={brawlerMeta} modeMeta={modeMeta} />
      ) : null}

      {patterns ? (
        <PlayerAutopsy autopsy={patterns} brawlerMeta={brawlerMeta} modeMeta={modeMeta} />
      ) : null}
    </section>
  );
}
