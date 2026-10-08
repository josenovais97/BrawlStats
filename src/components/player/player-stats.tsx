import {
  Battle3v3Icon,
  BigBrawlerIcon,
  BrawlersIcon,
  DuoShowdownIcon,
  ExperienceIcon,
  RoboRumbleIcon,
  SoloShowdownIcon,
  TrophyIcon,
  WinStreakIcon,
} from '@/components/game-icons';
import Image from 'next/image';
import Link from 'next/link';

import { Panel } from '@/components/ui/panel';
import { StatStrip } from '@/components/ui/stat-strip';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { brawlerArt } from '@/lib/brawler-art';
import { formatDuration, formatNumber, titleCase } from '@/lib/format';
import { HOT_STREAK, skinLabel } from '@/lib/player-showcase';
import { brawlerPath } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';
import type { BSPlayer, BSPlayerBrawler } from '@/types/brawlstars';

export function PlayerStats({ player }: { player: BSPlayer }) {
  // Ranked deliberately absent: the Ranking section shows the current,
  // season-best and all-time-best tiers with their elo, so a figure repeating
  // just the current tier was the weakest thing in this row.
  /*
   * A band, not a panel.
   *
   * The Account tab was four identical bordered rectangles in a column:
   * lifetime, bests, progress, progression. These five are the plainest
   * reference material on the page -- totals that have only ever gone up --
   * and giving them the same treatment as an upgrade plan said they were
   * equally worth stopping at. Bare, under the group heading, they read as a
   * summary of the tab rather than its first section.
   */
  return (
    /*
     * `@container` because the strip inside sizes itself with container
     * queries, and taking it out of its Panel took away the container they
     * were measuring against -- so the five figures fell back to two very wide
     * columns. A component that uses `@md:` has to be given something to be
     * `@md` *of*.
     */
    <section className="@container">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted">
        Lifetime{' '}
        <span className="font-medium normal-case tracking-normal">
          · since the account was made
        </span>
      </p>
      <StatStrip
        bare
        items={[
        {
          // The game's own marks, so the row reads as Brawl Stars rather than
          // as a generic dashboard of line icons.
          node: <Battle3v3Icon className="size-4" />,
          label: '3v3 wins',
          value: formatNumber(player['3vs3Victories']),
        },
        {
          node: <SoloShowdownIcon className="size-4" />,
          label: 'Solo SD wins',
          value: formatNumber(player.soloVictories),
        },
        {
          node: <DuoShowdownIcon className="size-4" />,
          label: 'Duo SD wins',
          value: formatNumber(player.duoVictories),
        },
        {
          node: <BrawlersIcon className="size-4" />,
          label: 'Brawlers',
          value: formatNumber(player.brawlers.length),
          hint: `${player.brawlers.filter((b) => b.power === 11).length} at power 11`,
        },
        {
          /*
           * No hint here. `totalPrestigeLevel` is prestige, not fame, and the
           * header chip already shows it, so repeating it under exp points was
           * both duplicated and mislabelled.
           */
          node: <ExperienceIcon className="size-4" />,
          label: 'Exp points',
          value: formatNumber(player.expPoints),
        },
        ]}
      />
    </section>
  );
}

/**
 * The account's single best runs, drawn as achievements.
 *
 * The two that belong to a brawler -- the highest trophies any brawler has
 * reached, and the longest win streak -- are hero cards: that brawler in the
 * skin actually equipped, washed in its rarity's colour, the same treatment the
 * Overview showcase gives the mains. A record feels like something that
 * happened when it has a face, and a 52px default portrait in a list row was
 * not much of one.
 *
 * The two survival times have no brawler behind them and stay as compact
 * cards with the mode's own mark. Rendered only when at least one is set --
 * the API reports zero for "never played", which as a time would read as an
 * impressively bad run rather than as absence.
 *
 * Async for the skin art, so the page streams it behind a Suspense boundary.
 */
export async function PlayerRecords({
  player,
  brawlerMeta,
}: {
  player: BSPlayer;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const robo = formatDuration(player.bestRoboRumbleTime);
  const bigBrawler = formatDuration(player.bestTimeAsBigBrawler);

  // All-time bests hiding in the per-brawler payload. `maxWinStreak` and the
  // per-brawler `highestTrophies` have always been in the response; on a
  // long-lived account they are usually the two most impressive numbers on
  // the page.
  const bestStreak = player.brawlers.reduce<BSPlayerBrawler | null>(
    (best, b) => ((b.maxWinStreak ?? 0) > (best?.maxWinStreak ?? 0) ? b : best),
    null,
  );
  const bestBrawler = player.brawlers.reduce<BSPlayerBrawler | null>(
    (best, b) => (b.highestTrophies > (best?.highestTrophies ?? 0) ? b : best),
    null,
  );

  const heroes: Hero[] = [];
  if (bestBrawler && bestBrawler.highestTrophies > 0) {
    heroes.push({
      key: 'best-brawler',
      brawler: bestBrawler,
      icon: <TrophyIcon className="size-4" />,
      label: 'Highest trophies',
      value: formatNumber(bestBrawler.highestTrophies),
      // The gap to now is the story when there is one: a peak of 1,500 on a
      // brawler sitting at 1,500 is a different record from one now on 900.
      detail:
        bestBrawler.trophies < bestBrawler.highestTrophies
          ? `Now on ${formatNumber(bestBrawler.trophies)}`
          : 'At its peak right now',
      tone: 'text-brand',
    });
  }
  if (bestStreak && (bestStreak.maxWinStreak ?? 0) > 0) {
    const live = bestStreak.currentWinStreak ?? 0;
    heroes.push({
      key: 'streak',
      brawler: bestStreak,
      icon: <WinStreakIcon className="size-4" />,
      label: 'Longest win streak',
      value: `${formatNumber(bestStreak.maxWinStreak ?? 0)} wins`,
      detail: live >= HOT_STREAK ? `On ${live} in a row right now` : 'In a row, all-time',
      tone: 'text-victory',
    });
  }

  const times: TimeRecord[] = [];
  if (robo) {
    times.push({
      key: 'robo',
      mark: <RoboRumbleIcon className="size-7" />,
      label: 'Robo Rumble',
      value: robo,
      hint: 'Longest survival',
    });
  }
  if (bigBrawler) {
    times.push({
      key: 'big',
      mark: <BigBrawlerIcon className="size-7" />,
      label: 'Big Brawler',
      value: bigBrawler,
      hint: 'Longest time held',
    });
  }

  if (heroes.length === 0 && times.length === 0) return null;

  const art = heroes.length
    ? await brawlerArt(
        heroes.map((h) => h.brawler),
        brawlerMeta,
      )
    : new Map<number, string>();

  return (
    <Panel title="Personal bests" aside="All-time">
      <div className="space-y-3">
        {heroes.length ? (
          <ul className="grid gap-3 @2xl:grid-cols-2">
            {heroes.map((h) => {
              const tint = brawlerMeta.get(h.brawler.id)?.rarity.color ?? 'var(--brand)';
              const skin = skinLabel(h.brawler);
              return (
                <li key={h.key}>
                  <Link
                    href={brawlerPath(h.brawler.id, h.brawler.name)}
                    prefetch={false}
                    className="group relative flex h-full min-h-36 items-stretch overflow-hidden rounded-2xl border border-border transition-colors hover:border-brand/50"
                    style={{
                      background: `linear-gradient(115deg, var(--surface) 35%, color-mix(in srgb, ${tint} 30%, transparent))`,
                    }}
                  >
                    {/* A soft glow behind the art, in the rarity colour, so the
                        figure stands on something rather than floating. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-10 top-1/2 size-56 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
                      style={{ background: tint }}
                    />

                    <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1 p-4 @xl:p-5">
                      <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${h.tone}`}>
                        <span aria-hidden className="flex shrink-0 items-center">{h.icon}</span>
                        {h.label}
                      </p>
                      <p className={`display text-3xl leading-none tabular-nums @xl:text-4xl ${h.tone}`}>
                        {h.value}
                      </p>
                      <p className="mt-1 truncate text-sm font-bold uppercase">
                        {titleCase(h.brawler.name)}
                        {skin ? (
                          <span className="font-medium normal-case text-muted"> · {titleCase(skin)}</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted">{h.detail}</p>
                    </div>

                    <div className="relative z-10 flex w-32 shrink-0 items-end justify-center pt-3 @xl:w-40">
                      <Image
                        src={art.get(h.brawler.id) ?? brawlerIconUrl(h.brawler.id)}
                        alt=""
                        width={160}
                        height={160}
                        className="h-32 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-105 @xl:h-36"
                        loading="lazy"
                        unoptimized
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {times.length ? (
          <ul className="grid gap-3 @md:grid-cols-2">
            {times.map((t) => (
              <li
                key={t.key}
                className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-surface-2/40 p-3.5"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-3 text-accent">
                  {t.mark}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
                    {t.label}
                  </p>
                  <p className="truncate text-2xl font-black leading-tight tabular-nums">{t.value}</p>
                  <p className="truncate text-xs text-muted">{t.hint}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

interface Hero {
  key: string;
  brawler: BSPlayerBrawler;
  icon: React.ReactNode;
  label: string;
  value: string;
  /** One line of context under the brawler's name. */
  detail: string;
  tone: string;
}

interface TimeRecord {
  key: string;
  mark: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}
