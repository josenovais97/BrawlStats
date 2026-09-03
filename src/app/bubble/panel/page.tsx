import type { Metadata } from 'next';
import Image from 'next/image';

import { getGameModeMap, brawlerIconUrl, modeLabel } from '@/lib/brawlapi';
import { getEventRotation } from '@/lib/bs-api';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { partitionRotation, titleCase } from '@/lib/format';
import { getBrawlerStatsForWindow, scoreBrawlers, TIER_ORDER } from '@/lib/stats';
import { TIER_COLOR } from '@/lib/tiers';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSRotationSlot } from '@/types/brawlstars';

/**
 * The bubble's panel: the Ranked tier list, then what is live right now.
 *
 * A separate route rather than `/tier-list/ranked` in a WebView, for two
 * reasons. Reading `searchParams` to strip chrome would opt the route out of
 * caching entirely — the trap that cost this project a month of Vercel
 * allowance — and 360x520dp is not a narrow phone but a different medium. The
 * site's header, hero, controls and footer are most of that window, so the
 * panel would open on chrome and make the reader scroll to reach the answer.
 *
 * The tier list leads because that is the question being asked mid-draft: who
 * is strong right now. The rotation follows, because which map you are on
 * changes which of those names matters.
 */

/** The tier list's own data moves with the sampler, not faster. */
export const revalidate = 600;

/** Matches the site's Ranked list: seven days, competitive battles only. */
const WINDOW_DAYS = 7;

/**
 * Brawlers drawn per tier.
 *
 * Eight fits one row at the panel's landscape width and two in portrait, which
 * keeps every tier visible in a window that is only ~370dp tall when the phone
 * is held the way the game is played. D holds forty-odd; drawing them all would
 * push S off the top of the screen to show the brawlers nobody is choosing.
 */
const SHOWN_PER_TIER = 8;

export const metadata: Metadata = {
  title: 'Live picks',
  // One bounded URL showing data that already has an indexable home on
  // /tier-list/ranked. `noindex` rather than a robots.txt block: a crawler has
  // to fetch a page to read the directive, and at one URL that fetch is not a
  // cost worth engineering around.
  robots: { index: false, follow: false },
};

export default async function BubblePanelPage() {
  const [rows, brawlerMeta, modeMeta, rotation] = await Promise.all([
    getBrawlerStatsForWindow(WINDOW_DAYS, undefined, 'ranked').catch(() => []),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    getEventRotation(revalidate).catch(() => [] as BSRotationSlot[]),
  ]);

  const scored = scoreBrawlers(rows, 'ranked');
  const byTier = new Map<string, typeof scored>();
  for (const entry of scored) {
    if (!entry.tier) continue; // below the sample floor: unrated, not D
    const bucket = byTier.get(entry.tier) ?? [];
    bucket.push(entry);
    byTier.set(entry.tier, bucket);
  }

  /*
   * Strongest first within each tier, sorted here rather than inherited.
   *
   * `scoreBrawlers` does not promise an order, and it came back ascending —
   * so the S row opened on its weakest name. The panel truncates each tier to
   * what fits, which makes the order load-bearing in a way the full page's
   * wrapping rows are not: whatever is cut has to be the least useful, not the
   * most.
   */
  for (const bucket of byTier.values()) {
    bucket.sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
  }

  const { active } = partitionRotation(rotation);
  active.sort((a, b) => a.slotId - b.slotId);

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
        <h1 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Ranked meta · last {WINDOW_DAYS} days
        </h1>

        {scored.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted">
            Not enough sampled Ranked battles yet. This fills in as the sampler runs.
          </p>
        ) : (
          <ul className="space-y-2">
            {TIER_ORDER.map((tier) => {
              const entries = byTier.get(tier) ?? [];
              if (entries.length === 0) return null;
              return (
                <TierStrip
                  key={tier}
                  tier={tier}
                  color={TIER_COLOR[tier]}
                  entries={entries}
                  brawlerMeta={brawlerMeta}
                />
              );
            })}
          </ul>
        )}

        {active.length > 0 ? (
          <>
            <h2 className="px-1 pb-2 pt-4 text-[11px] font-bold uppercase tracking-wider text-muted">
              Live now
            </h2>
            <ul className="space-y-1.5">
              {active.map((slot) => (
                <li
                  key={slot.slotId}
                  className="card flex items-baseline justify-between gap-2 px-3 py-2"
                >
                  <span
                    className="shrink-0 text-xs font-bold uppercase tracking-wide"
                    style={{ color: modeMeta.get(slot.event.mode)?.color ?? 'var(--brand)' }}
                  >
                    {modeLabel(modeMeta, slot.event.mode)}
                  </span>
                  <span className="truncate text-sm font-semibold">{slot.event.map ?? '—'}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <p className="px-2 pb-2 pt-4 text-center text-[11px] leading-relaxed text-muted">
          Meta score combines adjusted win rate and pick rate across sampled Ranked battles.
          Brawlers below the sample floor are left out rather than guessed at.
        </p>
      </div>
    </>
  );
}

function TierStrip({
  tier,
  color,
  entries,
  brawlerMeta,
}: {
  tier: string;
  color: string;
  entries: { brawlerId: number; brawlerName: string; metaScore: number | null }[];
  brawlerMeta: Map<number, BABrawler>;
}) {
  return (
    <li className="card overflow-hidden">
      <div className="flex items-stretch">
        {/* The same lit band the site's tier rows use, at panel scale. */}
        <div
          className="flex w-9 shrink-0 flex-col items-center justify-center gap-0.5 py-1.5"
          style={{
            background: `linear-gradient(155deg, color-mix(in srgb, ${color} 52%, transparent) 0%, color-mix(in srgb, ${color} 14%, transparent) 65%, transparent 100%)`,
            boxShadow: `inset -1px 0 0 color-mix(in srgb, ${color} 45%, transparent)`,
          }}
        >
          <span
            className="text-xl font-black leading-none"
            style={{ color, textShadow: `0 0 18px color-mix(in srgb, ${color} 60%, transparent)` }}
          >
            {tier}
          </span>
          <span className="text-[10px] font-bold tabular-nums text-muted">{entries.length}</span>
        </div>

        {/*
          Wraps rather than scrolling sideways, and that is a bug fix.

          These were horizontal scrollers inside a vertically scrolling page.
          A drag starting on a tier could be claimed by the wrong axis, so
          scrolling the panel sometimes did nothing at all — worst in landscape,
          which is the orientation the game is actually played in and where the
          window is shortest. One scroll axis cannot be stolen from.

          Truncated to what a glance needs. The full list is a tap away on the
          site, and the count in the band already says how many there are.
        */}
        <div className="flex flex-1 flex-wrap content-start gap-x-1.5 gap-y-1 p-1.5">
          {entries.slice(0, SHOWN_PER_TIER).map((entry) => (
            <div key={entry.brawlerId} className="w-10 text-center">
              <Image
                src={brawlerMeta.get(entry.brawlerId)?.imageUrl ?? brawlerIconUrl(entry.brawlerId)}
                alt={titleCase(entry.brawlerName)}
                width={40}
                height={40}
                className="size-10 rounded-lg bg-surface-2"
                loading="lazy"
                unoptimized
              />
              <p className="truncate text-[9px] font-semibold capitalize leading-tight">
                {entry.brawlerName.toLowerCase()}
              </p>
              <p className="text-[10px] font-black tabular-nums leading-none" style={{ color }}>
                {entry.metaScore?.toFixed(1) ?? '–'}
              </p>
            </div>
          ))}

          {entries.length > SHOWN_PER_TIER ? (
            <span className="self-center px-1 text-[10px] font-semibold text-muted">
              +{entries.length - SHOWN_PER_TIER}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
