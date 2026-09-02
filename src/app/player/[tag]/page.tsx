import { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';

import { BattleLog } from '@/components/player/battle-log';
import { LastOnline } from '@/components/player/last-online';
import { PlayerBrawlers } from '@/components/player/player-brawlers';
import { PlayerHeader } from '@/components/player/player-header';
import { PlayerNav } from '@/components/player/player-nav';
import { PlayerProgress } from '@/components/player/player-progress';
import { BattleAutopsySection } from '@/components/player/battle-autopsy-section';
import { PlayerPatchImpact } from '@/components/player/player-patch-impact';
import { PlayerPushNow } from '@/components/player/player-push-now';
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
import { getGameModeMap } from '@/lib/brawlapi';
import type { BAGameMode } from '@/types/brawlapi';
import { coinsToMaxFrom, computeProgression, estimatePlaytime } from '@/lib/progression';
import { patchImpact, patchIsRecent, type PatchImpact } from '@/lib/patch-impact';
import { pushOptions } from '@/lib/push-now';
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
  const [picksByMode, modeMeta, rotation, mapForm] = await Promise.all([
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
  ]);

  const push = pushOptions({ rotation, brawlers: player.brawlers, form: mapForm });

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
      <PlayerNav />

      {/*
       * Ordered by the questions a visitor actually arrives with.
       *
       * The header answers "who is this". These two answer "how strong is the
       * account" and "where do they stand", which is what someone opening a
       * profile wants before anything else, and both used to sit below a grid
       * of lifetime counters. On a phone that meant scrolling past most of a
       * screen of readouts to reach the only two numbers that are judgements.
       *
       * The counters are not demoted for being uninteresting, they are
       * demoted for being reference: you look them up, you do not open a
       * profile to find them.
       */}
      <PlayerSkillScore skill={skill} />
      <Suspense fallback={<PlayerRanked player={player} standing={standing} />}>
        <RankedWithBoard player={player} standing={standing} tag={normalizedTag} />
      </Suspense>

      <div id="stats" className="scroll-anchor-nav space-y-8">
        <PlayerStats player={player} />
        <PlayerRecords player={player} />
        {/* Only ever populated for the couple of hundred players holding a
            global brawler placement, so it sits with the other reference
            readouts rather than above them. */}
        <PlayerPlacements
          placements={placements}
          iconFor={(id) => brawlerMeta.get(id)?.imageUrl}
        />
      </div>
      <div id="progress" className="scroll-anchor-nav space-y-8">
        <PlayerProgress points={trophyHistory} />
        <PlayerProgression progression={progression} playtime={playtime} />

        {/* Immediately after Progression, because it is the same subject read
            the other way round: Progression says how much of the account is
            finished and what finishing the rest costs, this names the specific
            brawlers worth finishing first. It used to sit near the top of the
            page, half a screen of its own, where nothing around it explained
            what the coins were for. Renders nothing on a maxed account rather
            than carrying an empty prompt. */}
        <PlayerUpgradeGap
          brawlers={player.brawlers}
          brawlerMeta={brawlerMeta}
          coinsPerLevel={coinsToMaxFrom}
        />
      </div>

      {/* Above the roster reads below it because it is the only section that
          expires. Those describe the account and are true all week; this one is
          about the next couple of hours, and burying it under them would be
          filing the answer behind the background. */}
      <PlayerPushNow options={push} brawlerMeta={brawlerMeta} modeMeta={modeMeta} />

      {impact && notes?.publishedAt ? (
        <PlayerPatchImpact
          impact={impact}
          patch={{ title: notes.title, url: notes.url, date: notes.publishedAt }}
          brawlerMeta={brawlerMeta}
        />
      ) : null}

      <PlayerMetaFit
        brawlers={player.brawlers}
        meta={metaIndex}
        brawlerMeta={brawlerMeta}
      />

      {/* After the roster-vs-meta read, because this narrows the same question
          to the maps that are actually queueable right now. */}
      <PlayerRankedPicks
        brawlers={player.brawlers}
        picksByMode={picksByMode}
        modes={rotationModes}
        brawlerMeta={brawlerMeta}
        modeMeta={modeMeta}
      />

      <Suspense fallback={<InsightsSkeleton />}>
        <PlayerInsights tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
      </Suspense>

      {/* Above the log rather than below it: this is the same subject read one
          level up, and the reader should meet the conclusion before scrolling
          twenty-five rows of evidence. */}
      <Suspense fallback={null}>
        <BattleAutopsySection
          tag={tag}
          playerTag={player.tag}
          brawlerMeta={brawlerMeta}
          modeMeta={modeMeta}
        />
      </Suspense>

      <section id="battles" className="scroll-anchor-nav">
        <SectionHeading title="Recent battles" />
        <Suspense fallback={<BattleLogSkeleton />}>
          <BattleLog tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
        </Suspense>
      </section>

      <section id="brawlers" className="scroll-anchor-nav">
        <SectionHeading
          title="Brawlers"
          aside={`${player.brawlers.length} unlocked`}
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
        />
      </section>
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
  tag,
}: {
  player: BSPlayer;
  standing: Awaited<ReturnType<typeof getTrophyPercentile>>;
  tag: string;
}) {
  const globalRank = await getPlayerRankings('global', 200)
    .then((r) => r.items.find((p) => normalizeTag(p.tag) === tag)?.rank ?? null)
    .catch(() => null);

  return <PlayerRanked player={player} globalRank={globalRank} standing={standing} />;
}
