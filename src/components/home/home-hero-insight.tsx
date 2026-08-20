import Image from 'next/image';
import Link from 'next/link';

import { formatPercent } from '@/lib/format';
import { getTopMetaBrawlers } from '@/lib/home-meta';
import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';

/**
 * One readout on the character stage: who is actually on top right now.
 *
 * The hero's job is to say what the product knows, and a number the site
 * measured itself says it better than any sentence could. This is the same
 * cached ranking the tier-list preview and the meta snapshot read further down
 * the page, so putting it here costs nothing upstream.
 *
 * Exactly one insight, not a constellation of floating badges. It sits at the
 * top-left of the stage — clear of every face in the artwork — and it is a
 * link, because it is a real row from a real list rather than decoration.
 *
 * Streamed inside its own boundary so the search never waits on a database.
 */
export async function HomeHeroInsight() {
  const [leader] = await getTopMetaBrawlers(1).catch(() => []);
  if (!leader) return null;

  const accent = TIER_COLOR[leader.tier];

  return (
    <Link
      href={brawlerPath(leader.brawlerId, leader.name)}
      className="group pointer-events-auto block w-[13.5rem] rounded-xl border border-border-strong/60 bg-surface/85 p-2.5 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.9)] backdrop-blur-md transition-colors hover:border-brand/50"
    >
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        <span className="live-dot" />
        No.1 in Ranked
      </p>

      <div className="mt-2 flex items-center gap-2.5">
        <Image
          src={leader.imageUrl}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg"
          loading="lazy"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold capitalize leading-tight">
            {leader.name.toLowerCase()}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs">
            <span
              className="rounded px-1 py-0.5 font-black leading-none"
              style={{
                background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                color: accent,
              }}
            >
              {leader.tier}
            </span>
            {leader.winRate !== null ? (
              <span className="tabular-nums text-muted">
                {formatPercent(leader.winRate)} win
              </span>
            ) : null}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className="display text-xl leading-none tabular-nums"
            style={{ color: accent }}
          >
            {leader.score.toFixed(1)}
          </p>
        </div>
      </div>
    </Link>
  );
}
