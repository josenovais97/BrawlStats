import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { RankedIcon, TrophyIcon } from '@/components/game-icons';
import { getMetaSplit } from '@/lib/home-meta';
import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

/**
 * The one thing on this site a competitor cannot copy.
 *
 * Every other Brawl Stars site publishes a single tier list, because a single
 * list is all you can build from a source that does not split. BrawlZone
 * samples Ranked and the trophy ladder separately, so it can show something no
 * one list can: the same brawler, rated two different ways, because they are
 * two different games.
 *
 * Stated as data rather than as a claim. There is no copy here arguing that
 * the site is better — three brawlers with two tiers each make the argument,
 * and anyone who plays will recognise it immediately.
 *
 * Renders nothing when the two lists happen to agree everywhere, which is the
 * honest failure: the section exists to show a disagreement, not to assert one.
 */
export async function HomeSplit() {
  const split = await getMetaSplit(3).catch(() => []);
  if (split.length === 0) return null;

  return (
    <section className="reveal" aria-labelledby="split">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="flex items-center gap-2.5">
            <span aria-hidden className="rule h-4" />
            <span className="eyebrow text-accent">Why the numbers differ here</span>
          </p>
          <h2 id="split" className="display mt-2.5 text-2xl uppercase sm:text-4xl">
            Two games.
            <br />
            Two answers.
          </h2>
          <p className="mt-3.5 leading-relaxed text-muted">
            Ranked drafts and bans between comparable opponents. The ladder does
            neither. We score them from separate halves of our own sample, so a
            brawler can be a first-pick in one and a trap in the other.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted/85">
            Most sites give you one list for both.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/tier-list/ranked"
              className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong/70 bg-surface px-4 text-sm font-bold transition-colors hover:border-brand/60 hover:text-brand"
            >
              <RankedIcon className="size-5" />
              Ranked list
              <ArrowRight className="size-4 duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform" />
            </Link>
            <Link
              href="/tier-list/trophy"
              className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
            >
              <TrophyIcon className="size-5" />
              Trophy list
            </Link>
          </div>
        </div>

        {/* The evidence. Borderless rows on the page's own ground, so the
            tier chips are the only thing carrying colour. */}
        <ul className="min-w-0 divide-y divide-border">
          {split.map((brawler) => (
            <li key={brawler.brawlerId}>
              <Link
                href={brawlerPath(brawler.brawlerId, brawler.name)}
                className="row-interactive -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 sm:gap-4"
              >
                <Image
                  src={brawler.imageUrl}
                  alt=""
                  width={52}
                  height={52}
                  className="size-11 shrink-0 rounded-xl sm:size-13"
                  loading="lazy"
                  unoptimized
                />
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-lg capitalize leading-none">
                    {brawler.name.toLowerCase()}
                  </span>
                  <span className="mt-1.5 block text-xs text-muted">
                    {brawler.gap === 1 ? 'One tier apart' : `${brawler.gap} tiers apart`}
                  </span>
                </span>

                {/* Two chips, labelled, so the comparison needs no legend. */}
                <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <Verdict label="Ranked" tier={brawler.ranked.tier} score={brawler.ranked.score} />
                  <Verdict label="Trophy" tier={brawler.trophy.tier} score={brawler.trophy.score} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** One list's verdict on one brawler. */
function Verdict({
  label,
  tier,
  score,
}: {
  label: string;
  tier: Tier;
  score: number;
}) {
  return (
    <span className="w-14 text-center sm:w-16">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span
        className="display mt-1 block rounded-lg py-1 text-xl leading-none"
        style={{
          background: `color-mix(in srgb, ${TIER_COLOR[tier]} 16%, transparent)`,
          color: TIER_COLOR[tier],
        }}
      >
        {tier}
      </span>
      <span className="mt-1 block text-xs tabular-nums text-muted">
        {score.toFixed(1)}
      </span>
    </span>
  );
}
