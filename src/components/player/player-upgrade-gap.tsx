import { Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Disclosure } from '@/components/ui/disclosure';
import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import { MAX_POWER_LEVEL } from '@/lib/progression';
import type { BABrawler } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * Brawlers carrying the game's rarest upgrades while still short of power 11.
 *
 * A hypercharge is the scarcest thing on an account, and unlike most upgrades
 * it does *not* require a maxed brawler — measured across sampled rosters,
 * hypercharges turn up at power 1, 6, 9 and 10 as well as 11. So a player can
 * be sitting on the best upgrade in the game attached to a brawler that loses
 * the fight before it charges, which is both a genuinely interesting stat and
 * the most concrete "spend your coins here" the site can offer.
 *
 * Buffies are checked too, though in practice they only ever appear at power 11
 * (104 of 104 across the same sample). Including them costs nothing and means
 * this keeps working if that ever changes.
 *
 * Sits directly under Progression, which is where the coins figure it acts on
 * lives, and is deliberately a short list rather than a panel: this is a to-do
 * list, and a to-do list that fills a screen stops being one.
 */

/** Rows shown before the rest fold away. Two tidy rows of three on desktop. */
const SHOWN = 6;

export function PlayerUpgradeGap({
  brawlers,
  brawlerMeta,
  coinsPerLevel,
}: {
  brawlers: BSPlayerBrawler[];
  brawlerMeta: Map<number, BABrawler>;
  /** Coins to take one brawler from its current level to 11, by level. */
  coinsPerLevel?: (from: number) => number;
}) {
  const stranded = brawlers
    .filter((b) => {
      if (b.power >= MAX_POWER_LEVEL) return false;
      const hyper = (b.hyperCharges?.length ?? 0) > 0;
      const buffie = Object.values(b.buffies ?? {}).some(Boolean);
      return hyper || buffie;
    })
    // Closest to maxed first: those are the cheapest to finish, so the top of
    // the list is also the next thing worth doing.
    .sort((a, b) => b.power - a.power || b.trophies - a.trophies);

  if (stranded.length === 0) return null;

  const coins = coinsPerLevel
    ? stranded.reduce((sum, b) => sum + coinsPerLevel(b.power), 0)
    : 0;

  const head = stranded.slice(0, SHOWN);
  const rest = stranded.slice(SHOWN);

  return (
    <section>
      <SectionHeading
        title="Upgraded but not maxed"
        aside={`${stranded.length} ${stranded.length === 1 ? 'brawler' : 'brawlers'}`}
      />

      <div className="card p-4">
        <p className="text-sm leading-relaxed text-muted">
          {stranded.length === 1 ? 'One brawler carries' : `${stranded.length} carry`} a
          hypercharge or buffie below power {MAX_POWER_LEVEL}.
          {coins > 0 ? (
            <>
              {' '}
              Finishing {stranded.length === 1 ? 'it' : 'them all'} costs about{' '}
              <strong className="font-semibold text-foreground">
                {formatNumber(coins)} coins
              </strong>
              .
            </>
          ) : null}
        </p>

        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {head.map((brawler) => (
            <li key={brawler.id}>
              <Row brawler={brawler} brawlerMeta={brawlerMeta} coinsPerLevel={coinsPerLevel} />
            </li>
          ))}
        </ul>

        {rest.length > 0 ? (
          <Disclosure
            tone="bare"
            className="mt-1"
            summary={`Show all ${stranded.length}`}
          >
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((brawler) => (
                <li key={brawler.id}>
                  <Row
                    brawler={brawler}
                    brawlerMeta={brawlerMeta}
                    coinsPerLevel={coinsPerLevel}
                  />
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}

        <Disclosure tone="bare" className="mt-1" summary="Why this matters">
          A hypercharge does not require a maxed brawler, so it is easy to end up
          holding the best upgrade available on something that loses the fight before
          it charges. Ordered by how close each one is to power {MAX_POWER_LEVEL}, so
          the cheapest to finish are first.
        </Disclosure>
      </div>
    </section>
  );
}

function Row({
  brawler,
  brawlerMeta,
  coinsPerLevel,
}: {
  brawler: BSPlayerBrawler;
  brawlerMeta: Map<number, BABrawler>;
  coinsPerLevel?: (from: number) => number;
}) {
  const hyper = (brawler.hyperCharges?.length ?? 0) > 0;
  const buffies = Object.entries(brawler.buffies ?? {}).filter(([, owned]) => owned);
  const cost = coinsPerLevel?.(brawler.power);

  return (
    <Link
      href={`/brawlers/${brawler.id}`}
      title={
        cost
          ? `${brawler.name}: about ${formatNumber(cost)} coins from power ${brawler.power} to ${MAX_POWER_LEVEL}`
          : undefined
      }
      className="row-interactive flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5"
    >
      <Image
        src={brawlerMeta.get(brawler.id)?.imageUrl ?? brawlerIconUrl(brawler.id)}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0"
        loading="lazy"
        unoptimized
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold capitalize">
          {brawler.name.toLowerCase()}
        </span>
        <span className="flex items-center gap-2 text-xs">
          {hyper ? (
            <span className="inline-flex items-center gap-1 text-defeat">
              <Zap className="size-3" />
              Hypercharge
            </span>
          ) : null}
          {buffies.length > 0 ? (
            <span className="text-accent">
              {buffies.length} buffie{buffies.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </span>
      </span>
      {/* The gap, not the level: "9 → 11" says what is left to do, where a
          bare "9" is just a number about the brawler. */}
      <span className="shrink-0 text-right text-sm font-bold tabular-nums">
        <span className="text-muted">{brawler.power}</span>
        <span className="text-muted/60"> → </span>
        <span className="text-brand">{MAX_POWER_LEVEL}</span>
      </span>
    </Link>
  );
}
