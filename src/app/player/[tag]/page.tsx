import { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';

import { BattleLog } from '@/components/player/battle-log';
import { LastOnline } from '@/components/player/last-online';
import { PlayerBrawlers } from '@/components/player/player-brawlers';
import { PlayerHeader } from '@/components/player/player-header';
import { PlayerProgress } from '@/components/player/player-progress';
import { BattleAutopsySection } from '@/components/player/battle-autopsy-section';
import { PlayerPatchImpact } from '@/components/player/player-patch-impact';
import { PlayerPushNow } from '@/components/player/player-push-now';
import { PlayerRosterPlan } from '@/components/player/player-roster-plan';
import { PlayerVerdict } from '@/components/player/player-verdict';
import { SinceLastVisit } from '@/components/player/since-last-visit';
import { PlayerMetaFit } from '@/components/player/player-meta-fit';
import { PlayerRankedPicks } from '@/components/player/player-ranked-picks';
import { PlayerRecords, PlayerStats } from '@/components/player/player-stats';
import { PlayerSkillScore } from '@/components/player/player-skill-score';
import { PlayerUpgradeGap } from '@/components/player/player-upgrade-gap';
import { ErrorState } from '@/components/ui/error-state';
import { BattleLogSkeleton, InsightsSkeleton } from '@/components/ui/skeletons';
import { SectionHeading } from '@/components/ui/section-heading';
import { PlayerProgression } from '@/components/player/player-progression';
import { MetaRadar } from '@/components/meta/meta-radar';
import { Panel } from '@/components/ui/panel';
import { ProfileGroup } from '@/components/player/profile-group';
import { ProfileTabs } from '@/components/player/profile-tabs';
import { RecentSearchRecorder } from '@/components/recent-search-recorder';
import { RosterRecorder } from '@/components/player/roster-recorder';
import { PlayerInsights } from '@/components/player/player-insights';
import { PlayerPlacements } from '@/components/player/player-placements';
import { PlayerRanked } from '@/components/player/player-ranked';
import {
  getEventRotation,
  getOfficialBrawlers,
  getPlayer,
  getPlayerRankings,
} from '@/lib/bs-api';
import { getGameModeMap, modeLabel } from '@/lib/brawlapi';
import type { BAGameMode } from '@/types/brawlapi';
import { coinsToMaxFrom, computeProgression, estimatePlaytime } from '@/lib/progression';
import { patchImpact, patchIsRecent, type PatchImpact } from '@/lib/patch-impact';
import { pushOptions } from '@/lib/push-now';
import { getHiddenMeta } from '@/lib/hidden-meta';
import { rosterPlan } from '@/lib/roster-optimizer';
import { changesFromNotes, getLatestReleaseNotes } from '@/lib/release-notes';
import { computeSkillScore } from '@/lib/skill-score';
import { toApiError } from '@/lib/errors';
import {
  getLadderMapForm,
  getPatchSplit,
  getMetaIndex,
  getBestPicksByMode,
  getRankedMapPicks,
  getPlayerBrawlerPlacements,
  getReleasedBuffieCount,
  getTrophyHistory,
  getRankedPercentile,
  getTrophyPercentile,
  recordLookup,
} from '@/lib/stats';
import { INDEXABLE_PLAYER_TAGS } from '@/generated/indexable-players';
import { displayTag, normalizeTag } from '@/lib/tags';
import type { BSPlayer } from '@/types/brawlstars';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  try {
    const player = await getPlayer(tag);
    return {
      title: `${player.name} (${displayTag(player.tag)})`,
      description: `${player.name} has ${player.trophies.toLocaleString('en-US')} trophies and ${player.brawlers.length} brawlers.`,
      // Normalised, so #ABC, %23ABC and abc all resolve to one indexable URL
      // rather than three competing ones.
      alternates: { canonical: `/player/${normalizeTag(player.tag)}` },
      /*
       * Indexable pages must be a deliberate set, and this one now has one.
       *
       * The reasoning behind the blanket `noindex` still holds for the general
       * case: player URLs are effectively unbounded and a crawler walking them
       * costs real API budget for pages nobody searched for. What changed is
       * that a bounded allowlist exists — the current global top boards, baked
       * at build time — and it is already threaded through `robots.ts`, the
       * sitemap and the crawler guard in `proxy.ts`.
       *
       * All three of those were being cancelled here. Search Console on
       * 2026-09-02 reported 789 pages "excluded by noindex" while robots.txt
       * invited crawlers to exactly these URLs and the sitemap listed them:
       * Google fetched each one, at the cost of an upstream call, and threw it
       * away. Listing a page in a sitemap while asking not to have it indexed
       * is the contradiction the sitemap's own comment warns about.
       *
       * `follow` stays either way, so links out of a non-indexed profile still
       * pass value to the pages that matter.
       */
      robots: {
        index: INDEXABLE_PLAYER_TAGS.has(normalizeTag(player.tag)),
        follow: true,
      },
    };
  } catch {
    return { title: `Player ${displayTag(tag)}` };
  }
}

export default async function PlayerPage({ params }: PageProps) {
  const { tag } = await params;

  let player;
  try {
    player = await getPlayer(tag);
  } catch (err) {
    const apiError = toApiError(err);
    return (
      <ErrorState
        code={apiError.code}
        title={apiError.code === 'notFound' ? 'Player not found' : undefined}
        detail={
          apiError.code === 'notFound'
            ? `No player exists with the tag ${displayTag(tag)}. Check it in-game under your profile.`
            : undefined
        }
      />
    );
  }

  /*
   * Every successful lookup widens the sampling pool the tier list draws on —
   * but only a lookup somebody actually asked for.
   *
   * `<Link>` prefetches, and a prefetch renders this page on the server exactly
   * like a visit. The leaderboard lists a hundred players, so one visitor
   * scrolling it quietly enrolled a hundred accounts into the sampling pool,
   * each costing ~110 KB a day in brawler snapshots and two API calls per run.
   * Measured on 2026-08-21: scrolling `/leaderboard` once fires 101 of them.
   *
   * A prefetch is a guess that someone might click, not a visit, and Next says
   * which is which in the request headers. Reading them here is the rule in one
   * place; `prefetch={false}` on the big lists is the same rule enforced early,
   * where it also saves the render.
   *
   * `after` runs it once the response is sent, so it never delays the page.
   */
  const isPrefetch = (await headers()).get('next-router-prefetch') === '1';

  if (!isPrefetch) {
    after(() =>
      recordLookup({
        tag: normalizeTag(player.tag),
        name: player.name,
        trophies: player.trophies,
        highestTrophies: player.highestTrophies,
        brawlerCount: player.brawlers.length,
        iconId: player.icon?.id,
        rankedElo: player.rankedElo,
        rankedRankName: player.rankedRankName,
        highestRankedElo: player.highestAllTimeRankedElo,
        highestRankedRankName: player.highestAllTimeRankedRankName,
        // Ids and power levels only. The evolution point needs roster depth
        // and meta coverage, and both are derived in one place inside
        // recordLookup so two callers cannot compute them differently.
        roster: player.brawlers.map((b) => ({ id: b.id, power: b.power })),
      }),
    );
  }

  // Artwork metadata is a separate, keyless source. If it is unavailable the
  // page still renders — brawler cards just fall back to CDN-pattern URLs.
  // The official catalogue supplies the per-brawler totals that progression
  // needs (gears and hypercharges are not in the brawlapi payload).
  const normalizedTag = normalizeTag(player.tag);

  const [brawlerMeta, catalogue] = await Promise.all([
    getBrawlerArtMap().catch(() => new Map()),
    getOfficialBrawlers()
      .then((r) => r.items)
      .catch(() => []),
  ]);

  // Database reads run one at a time so the page never needs more than one
  // connection, and each degrades to null/empty on its own.
  const placements = await getPlayerBrawlerPlacements(normalizedTag);
  const standing = await getTrophyPercentile(player.trophies);
  // Only for an account that has actually played Ranked this season: a
  // percentile for an unranked player would rank them against a ladder they
  // are not on.
  const rankedStanding = player.rankedElo
    ? await getRankedPercentile(player.rankedElo).catch(() => null)
    : null;
  const releasedBuffies = await getReleasedBuffieCount();
  const trophyHistory = await getTrophyHistory(normalizedTag);
  // The trophy tier list, joined against this roster below and onto every tile
  // in the grid. Empty without a database, which every consumer handles.
  const metaIndex = await getMetaIndex('trophy', 7);
  /*
   * The live Ranked rotation, for `PlayerRankedPicks`. A cached read shared by
   * every profile view, so this costs one query per revalidation window rather
   * than one per visitor.
   */
  const rankedMaps = await getRankedMapPicks(3).catch(() => []);
  /*
   * Picks are read per mode rather than per map: people choose a brawler for
   * Gem Grab, not for Hard Rock Mine specifically. The rotation still decides
   * *which* modes are shown, so this stays scoped to what is queueable now.
   */
  const rotationModes = [...new Set(rankedMaps.map((m) => m.mode))];
  const [picksByMode, modeMeta, rotation, mapForm, hidden] = await Promise.all([
    /*
     * Deep enough that a mode almost always has an answer this account can
     * actually play. At five, a roster missing the top handful produced four
     * cards in a row reading "one upgrade away" and nothing to press.
     */
    getBestPicksByMode(15).catch(() => new Map()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    /*
     * The live rotation and per-map ladder form, for `PlayerPushNow`. Both are
     * cached reads shared by every profile, so the section costs the same
     * whether one person opens a profile or a thousand do.
     */
    getEventRotation().catch(() => []),
    getLadderMapForm().catch(() => new Map()),
    /*
     * The ranked meta as a whole, for the radar. A cached read shared with
     * /hidden-meta and every other profile, so plotting eighty-five brawlers
     * here costs one query per revalidation window rather than one per
     * visitor — and the chart cannot disagree with that page, because it is
     * the same numbers and the same percentile cuts.
     */
    getHiddenMeta().catch(() => null),
  ]);

  const push = pushOptions({ rotation, brawlers: player.brawlers, form: mapForm });

  /*
   * Uses exactly the inputs `PlayerRankedPicks` already has, so the plan and
   * the mode cards below it can never disagree about what "covered" means.
   */
  const plan = rosterPlan({
    brawlers: player.brawlers,
    picksByMode,
    modes: rotationModes,
    modeLabels: new Map(rotationModes.map((mode) => [mode, modeLabel(modeMeta, mode)])),
  });

  /*
   * Only while the update is recent. This is the one section on the profile
   * with a natural expiry: "what did the patch do to me" is urgent for a couple
   * of weeks and then becomes another permanent block on a long page, so it
   * removes itself rather than accumulating.
   */
  const notes = await getLatestReleaseNotes().catch(() => null);

  let impact: PatchImpact | null = null;
  if (notes?.publishedAt && patchIsRecent(notes.publishedAt) && catalogue.length > 0) {
    const changes = changesFromNotes(
      notes,
      catalogue.map((b: { name: string }) => b.name),
    );
    const split = await getPatchSplit(notes.publishedAt.slice(0, 10)).catch(
      () => new Map(),
    );
    impact = patchImpact({
      changes,
      brawlers: player.brawlers,
      split,
      byName: new Map(
        catalogue.map((b: { id: number; name: string }) => [b.name.toLowerCase(), b.id]),
      ),
    });
  }

  const progression = computeProgression(player, catalogue, releasedBuffies);
  const playtime = estimatePlaytime(player);
  // Pure function over the payload we already have — no database, no extra
  // call. The catalogue length is passed so roster-completeness scales as
  // Supercell adds brawlers instead of being pinned to today's count.
  const skill = computeSkillScore(player, catalogue.length || undefined);

  return (
    <div className="space-y-8">
      <RecentSearchRecorder
        kind="player"
        tag={normalizedTag}
        name={player.name}
        icon={player.icon?.id}
      />
      {/* Remembers the roster on this device so the draft helper can offer to
          recommend only from brawlers this account owns. Nothing leaves the
          browser — see `lib/roster`. */}
      <RosterRecorder
        tag={normalizedTag}
        name={player.name}
        owned={player.brawlers.map((b) => b.id)}
        power11={player.brawlers.filter((b) => b.power >= 11).map((b) => b.id)}
      />
      <PlayerHeader
        player={player}
        lastOnline={
          <Suspense fallback={null}>
            <LastOnline tag={tag} />
          </Suspense>
        }
      />
      {/* High in the page on purpose: a returning visitor's first question is
          "what changed", and it costs nothing to answer. Every number here is
          already on screen below. */}
      <SinceLastVisit
        tag={normalizedTag}
        trophies={player.trophies}
        brawlers={player.brawlers.length}
        power11={player.brawlers.filter((b) => b.power >= 11).length}
        hyperCharges={player.brawlers.reduce(
          (sum, b) => sum + (b.hyperCharges?.length ?? 0),
          0,
        )}
        skill={skill.score}
      />
      <ProfileTabs
        tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <ProfileGroup title="Overview" subtitle="How strong this account is and where it stands, before any of the detail.">
        {/*
         * Ordered by the questions a visitor actually arrives with, and set
         * side by side because these two answer the same one from opposite
         * ends: the skill score is what this site makes of the account, the
         * ranking is what the game does. Reading them together is the point.
         *
         * They used to be stacked full-width, which on a laptop put them two
         * screens apart with a column of empty margin either side of each --
         * and both sat below a grid of lifetime counters, so a phone had to
         * scroll past most of a screen of readouts to reach the only two
         * numbers on the page that are judgements. Those counters are not
         * demoted for being uninteresting; they are demoted for being
         * reference, the sort of thing you look up rather than open a profile
         * to find.
         */}
        <div className="grid gap-6 lg:grid-cols-2">
          <PlayerSkillScore skill={skill} />

          <Suspense
            fallback={
              <PlayerRanked player={player} standing={standing} rankedStanding={rankedStanding} />
            }
          >
            <RankedWithBoard
              player={player}
              standing={standing}
              rankedStanding={rankedStanding}
              tag={normalizedTag}
            />
          </Suspense>
        </div>

        {/*
          How the account is actually doing lately, which belongs on the tab
          somebody lands on rather than two tabs away under the battle log.
          It is also what keeps Overview from being thin: the readiness
          verdict below renders nothing on an account with nothing left to
          upgrade, and on those profiles this tab was two panels and a lot of
          floor.
        */}
        <Suspense fallback={<InsightsSkeleton />}>
          <PlayerInsights tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
        </Suspense>

        {/* Full width underneath, because it is a per-mode readout that wants
            the room and is the conclusion the two above lead to. */}
        {plan ? (
          <PlayerVerdict
            plan={plan}
            usable={player.brawlers.filter((b) => b.power >= 9).length}
            total={player.brawlers.length}
          />
        ) : null}            </ProfileGroup>
          ),
        },
        {
          id: 'account',
          label: 'Account',
          content: (
            <ProfileGroup title="The account" subtitle="Lifetime totals, records and how the trophies got here. Reference rather than news.">
        <PlayerStats player={player} />
        <PlayerRecords player={player} />
        {/* Only ever populated for the couple of hundred players holding a
            global brawler placement, so it sits with the other reference
            readouts rather than above them. */}
        <PlayerPlacements
          placements={placements}
          iconFor={(id) => brawlerMeta.get(id)?.imageUrl}
        />
        {/*
          Not paired, and the attempt is worth recording. These two were set
          side by side on the theory that both are about progress -- but one is
          three figures and a caveat and the other is eight bars, five
          investment tiles and a note. `h-full` duly stretched the short one to
          match the tall one and left half a panel of nothing, which looked far
          worse than the stacking it was meant to fix.
          
          Two panels only belong in a row when they carry comparable weight.
          Skill score and Ranking do; these do not.
        */}
        <PlayerProgress points={trophyHistory} />
        <PlayerProgression progression={progression} playtime={playtime} />            </ProfileGroup>
          ),
        },
        {
          id: 'next',
          label: 'Do next',
          content: (
            <ProfileGroup title="What to do next" subtitle="The things on this page that are worth acting on, soonest first.">
        <PlayerPushNow options={push} brawlerMeta={brawlerMeta} modeMeta={modeMeta} />

        {/* After the rotation, because it narrows the same question to the maps
            that are actually queueable right now. */}
        <PlayerRankedPicks
          brawlers={player.brawlers}
          picksByMode={picksByMode}
          modes={rotationModes}
          brawlerMeta={brawlerMeta}
          modeMeta={modeMeta}
        />

        {impact && notes?.publishedAt ? (
          <PlayerPatchImpact
            impact={impact}
            patch={{ title: notes.title, url: notes.url, date: notes.publishedAt }}
            brawlerMeta={brawlerMeta}
          />
        ) : null}

        {plan ? <PlayerRosterPlan plan={plan} brawlerMeta={brawlerMeta} /> : null}

        {/* Beside the upgrade plan rather than after Progression, which is
            where it used to sit. Both of these say "spend your coins here" and
            they are the only two sections that do; the coins figure that used
            to justify the old placement is one group away, while the plan it
            belongs beside was three. Renders nothing on a maxed account rather
            than carrying an empty prompt. */}
        <PlayerUpgradeGap
          brawlers={player.brawlers}
          brawlerMeta={brawlerMeta}
          coinsPerLevel={coinsToMaxFrom}
        />            </ProfileGroup>
          ),
        },
        {
          id: 'battles',
          label: 'Battles',
          content: (
            <ProfileGroup title="Battles" subtitle="What the last few days of games actually say, and the games themselves.">
        {/* Above the log rather than below it: this is the same subject read one
            level up, and the reader should meet the conclusion before scrolling
            twenty-five rows of evidence. */}
        <Suspense fallback={null}>
          <BattleAutopsySection
            tag={tag}
            player={player}
            brawlerMeta={brawlerMeta}
            modeMeta={modeMeta}
          />
        </Suspense>

        <section>
          <SectionHeading title="Recent battles" />
          <Suspense fallback={<BattleLogSkeleton />}>
            <BattleLog tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
          </Suspense>
        </section>            </ProfileGroup>
          ),
        },
        {
          id: 'brawlers',
          label: 'Brawlers',
          content: (
            <ProfileGroup title="Brawlers" subtitle={`${player.brawlers.length} unlocked, read against the current tier list.`}>
        {/*
          The whole ranked meta, with this roster lit up on it.

          The list underneath says which top-tier brawlers are owned; this
          says what that looks like. Every brawler is drawn whether owned or
          not, because the holes are the finding — a dark patch in the
          top-right corner is precisely the thing worth seeing, and leaving out
          what the account does not have would delete it.

          Same component, same percentile cuts and same data as /hidden-meta,
          so the two cannot disagree about who is in which corner.
        */}
        {hidden ? (
          <Panel
            title="Your roster on the meta"
            aside={`${hidden.rated} brawlers rated`}
          >
            <MetaRadar
              bare
              points={hidden.points}
              cuts={hidden.cuts}
              windowDays={hidden.windowDays}
              owned={new Set(player.brawlers.filter((b) => b.power >= 9).map((b) => b.id))}
            />
          </Panel>
        ) : null}

        {/* Before the grid rather than three groups away from it. This is the
            roster judged against the meta and the grid is the roster itself,
            so the reading and the thing being read now sit together. */}
        <PlayerMetaFit
          brawlers={player.brawlers}
          meta={metaIndex}
          brawlerMeta={brawlerMeta}
        />

        <PlayerBrawlers
          brawlers={player.brawlers}
          meta={Object.fromEntries(
            [...brawlerMeta.entries()].map(([id, b]) => [
              id,
              {
                imageUrl: b.imageUrl,
                rarityColor: b.rarity.color,
                rarityName: b.rarity.name,
                // `tier` is undefined below the sample floor, which the tile
                // renders as no chip rather than as a bottom-tier one.
                tier: metaIndex.get(id)?.tier ?? undefined,
                metaScore: metaIndex.get(id)?.metaScore ?? undefined,
              },
            ]),
          )}
        />            </ProfileGroup>
          ),
        },
        ]}
      />

    </div>
  );
}

/**
 * The global top-200 board, streamed rather than blocking the page.
 *
 * It resolves to a rank for 200 players worldwide and to null for everyone
 * else, so awaiting it before first paint made every profile wait on an answer
 * that is almost always "not on the board". The fallback is the same section
 * without the rank, so nothing shifts when it arrives.
 */
async function RankedWithBoard({
  player,
  standing,
  rankedStanding,
  tag,
}: {
  player: BSPlayer;
  standing: Awaited<ReturnType<typeof getTrophyPercentile>>;
  rankedStanding: Awaited<ReturnType<typeof getRankedPercentile>>;
  tag: string;
}) {
  const globalRank = await getPlayerRankings('global', 200)
    .then((r) => r.items.find((p) => normalizeTag(p.tag) === tag)?.rank ?? null)
    .catch(() => null);

  return (
    <PlayerRanked
      player={player}
      globalRank={globalRank}
      standing={standing}
      rankedStanding={rankedStanding}
    />
  );
}
