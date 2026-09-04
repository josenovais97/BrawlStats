import type { Metadata } from 'next';

import {
  PanelTiers,
  type PanelEntry,
  type PanelMap,
  type PanelMode,
} from '@/components/bubble/panel-tiers';
import { PanelUpdate } from '@/components/bubble/panel-update';
import { BUBBLE_APP, BUBBLE_CHANGELOG } from '@/lib/bubble-app';
import { getGameModeMap, brawlerIconUrl, modeLabel } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import {
  getBrawlerStatsForWindow,
  getFilterableModes,
  getRankedMapPicks,
  scoreBrawlers,
} from '@/lib/stats';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';

/**
 * The bubble's panel: the Ranked tier list, filterable by mode.
 *
 * A separate route rather than `/tier-list/ranked` in a WebView, for two
 * reasons. Reading `searchParams` to strip chrome would opt the route out of
 * caching entirely — the trap that cost this project a month of Vercel
 * allowance — and 360x520dp is not a narrow phone but a different medium. The
 * site's header, hero, controls and footer are most of that window, so the
 * panel would open on chrome and make the reader scroll to reach the answer.
 *
 * The tier list is the whole page. A live-rotation strip sat under it for a
 * while and was cut: the rotation is already on screen behind the overlay, in
 * the game itself, so the panel was spending a third of a short window telling
 * the reader something they were looking at.
 */

/** The tier list's own data moves with the sampler, not faster. */
export const revalidate = 600;

/** Matches the site's Ranked list: seven days, competitive battles only. */
const WINDOW_DAYS = 7;

export const metadata: Metadata = {
  title: 'Live picks',
  // One bounded URL showing data that already has an indexable home on
  // /tier-list/ranked. `noindex` rather than a robots.txt block: a crawler has
  // to fetch a page to read the directive, and at one URL that fetch is not a
  // cost worth engineering around.
  robots: { index: false, follow: false },
};

export default async function BubblePanelPage() {
  /*
   * Which modes are worth offering, asked before the stats are fetched.
   *
   * The same source the site's tier list uses, so the two cannot disagree
   * about which modes have enough competitive data to split by. A mode nobody
   * plays in Ranked would otherwise get a chip that opens on an empty list.
   */
  const filterable = await getFilterableModes(30, 150, 'ranked').catch(() => []);
  const modeKeys = filterable.map((entry) => entry.mode);

  const [allRows, perMode, brawlerMeta, modeMeta, mapPicks] = await Promise.all([
    getBrawlerStatsForWindow(WINDOW_DAYS, undefined, 'ranked').catch(() => []),
    // Each of these is cached independently, and the site's own per-mode pages
    // read the same entries — so the panel usually warms nothing of its own.
    Promise.all(
      modeKeys.map((mode) =>
        getBrawlerStatsForWindow(WINDOW_DAYS, mode, 'ranked').catch(() => []),
      ),
    ),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    /*
     * Per-map picks, which are the point of the panel mid-draft.
     *
     * A mode is too coarse to draft on: Ranked hands you one map out of that
     * mode's pool and the answer moves with it. Ten deep, because a draft has
     * bans and two team-mates picking before you and the top three are often
     * gone.
     */
    getRankedMapPicks(10).catch(() => []),
  ]);

  /**
   * Trimmed to what the panel draws.
   *
   * Every mode's list is serialised into the page so the filter can switch
   * without a request. The full stat rows carry far more than four fields, and
   * carrying all of them across seven modes would put hundreds of kilobytes
   * into an overlay opened on mobile data.
   */
  const shape = (rows: Awaited<ReturnType<typeof getBrawlerStatsForWindow>>): PanelEntry[] =>
    scoreBrawlers(rows, 'ranked')
      .filter((entry) => entry.tier !== null)
      .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
      .map((entry) => ({
        brawlerId: entry.brawlerId,
        brawlerName: entry.brawlerName,
        metaScore: entry.metaScore,
        tier: entry.tier!,
        imageUrl: brawlerMeta.get(entry.brawlerId)?.imageUrl ?? brawlerIconUrl(entry.brawlerId),
      }));

  /** Ranked maps grouped by the mode they belong to. */
  const mapsByMode = new Map<string, PanelMap[]>();
  for (const map of mapPicks) {
    const bucket = mapsByMode.get(map.mode) ?? [];
    bucket.push({
      mapName: map.mapName,
      mode: map.mode,
      picks: map.picks.map((pick) => ({
        brawlerId: pick.brawlerId,
        brawlerName: pick.brawlerName,
        imageUrl:
          brawlerMeta.get(pick.brawlerId)?.imageUrl ?? brawlerIconUrl(pick.brawlerId),
        score: pick.score,
        overallScore: pick.overallScore,
        battles: pick.decidedSampleSize,
      })),
    });
    mapsByMode.set(map.mode, bucket);
  }
  // Alphabetical, so a map keeps its position between openings. Ranking the
  // chips by sample size would move them under the reader's thumb.
  for (const bucket of mapsByMode.values()) {
    bucket.sort((a, b) => a.mapName.localeCompare(b.mapName));
  }

  const modes: PanelMode[] = [
    // No maps on the combined list: the full pool is around thirty, which is
    // more chips than this window can show without becoming the whole panel.
    { key: null, label: 'All', entries: shape(allRows), maps: [] },
    ...modeKeys.map((mode, index) => ({
      key: mode,
      label: modeLabel(modeMeta, mode),
      entries: shape(perMode[index]),
      maps: mapsByMode.get(mode) ?? [],
    })),
  ].filter((mode) => mode.key === null || mode.entries.length > 0 || mode.maps.length > 0);

  return (
    <>
      {/*
        The site chrome is hidden for this route only.

        The root layout renders the header and footer around every page, and a
        layout cannot know which child is rendering without a route-group
        refactor that would touch every route on the site. One scoped rule is
        the smaller change, and it fails safe: if it ever stops matching, the
        panel shows the site's own header rather than breaking.
      */}
      <style>{`
        body > div > header, body > div > footer { display: none !important; }
        body > div > main { padding: 0 !important; max-width: none !important; }
      `}</style>

      <div className="min-h-dvh bg-background px-2 py-2">
        {/* Above the list, because an out-of-date app is the one thing here
            that the numbers below cannot tell you about themselves. */}
        <PanelUpdate
          latestVersion={BUBBLE_APP.version}
          latestVersionCode={BUBBLE_APP.versionCode}
          changes={BUBBLE_CHANGELOG}
        />

        <h1 className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Ranked meta · last {WINDOW_DAYS} days
        </h1>

        {modes[0].entries.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted">
            Not enough sampled Ranked battles yet. This fills in as the sampler runs.
          </p>
        ) : (
          <PanelTiers modes={modes} />
        )}


        <p className="px-2 pb-2 pt-4 text-center text-[11px] leading-relaxed text-muted">
          Meta score combines adjusted win rate and pick rate across sampled Ranked battles.
          Brawlers below the sample floor are left out rather than guessed at.
        </p>
      </div>
    </>
  );
}
