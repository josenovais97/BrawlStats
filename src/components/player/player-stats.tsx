import {
  Battle3v3Icon,
  BigBrawlerIcon,
  BrawlersIcon,
  DuoShowdownIcon,
  ExperienceIcon,
  PrestigeIcon,
  RoboRumbleIcon,
  SoloShowdownIcon,
  TrophyIcon,
  WinStreakIcon,
} from '@/components/game-icons';
import Image from 'next/image';

import { Panel } from '@/components/ui/panel';
import { StatStrip } from '@/components/ui/stat-strip';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatDuration, formatNumber, titleCaseLabel } from '@/lib/format';
import type { BSPlayer } from '@/types/brawlstars';

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
 * The two survival records the API reports and nothing on the site showed.
 *
 * Their own strip rather than two more cards in the row above: that row is
 * lifetime counters, these are single best runs, and appending them made a
 * five-column grid wrap to five-plus-two. Rendered only when at least one is
 * set — the API reports zero for "never played", which as a time would read as
 * an impressively bad run rather than as absence.
 */
export function PlayerRecords({ player }: { player: BSPlayer }) {
  const robo = formatDuration(player.bestRoboRumbleTime);
  const bigBrawler = formatDuration(player.bestTimeAsBigBrawler);

  // All-time bests hiding in the per-brawler payload. `maxWinStreak` and the
  // per-brawler `highestTrophies` have always been in the response and were
  // never shown anywhere — on a long-lived account they are usually the two
  // most impressive numbers on the page.
  const bestStreak = player.brawlers.reduce<BSPlayer['brawlers'][number] | null>(
    (best, b) => ((b.maxWinStreak ?? 0) > (best?.maxWinStreak ?? 0) ? b : best),
    null,
  );
  const bestBrawler = player.brawlers.reduce<BSPlayer['brawlers'][number] | null>(
    (best, b) => (b.highestTrophies > (best?.highestTrophies ?? 0) ? b : best),
    null,
  );

  /*
   * Achievements, not database fields.
   *
   * "Best brawler: 1,016 (Pierce)" as a figure in a strip is the same shape as
   * a lifetime win count, and it is not the same kind of thing -- these are the
   * single best runs on the account, and on a long-lived one they are usually
   * the most impressive numbers anywhere on the page. The two that belong to a
   * brawler get that brawler's portrait, because a face is what makes a record
   * feel like something that happened rather than a row that was stored.
   */
  const records: Record[] = [];

  if (bestBrawler && bestBrawler.highestTrophies > 0) {
    records.push({
      key: 'best-brawler',
      brawlerId: bestBrawler.id,
      icon: <TrophyIcon className="size-4" />,
      label: 'Best brawler',
      value: formatNumber(bestBrawler.highestTrophies),
      hint: titleCaseLabel(bestBrawler.name),
      tone: 'text-brand',
    });
  }
  if (bestStreak && (bestStreak.maxWinStreak ?? 0) > 0) {
    records.push({
      key: 'streak',
      brawlerId: bestStreak.id,
      icon: <WinStreakIcon className="size-4" />,
      label: 'Best win streak',
      value: `${formatNumber(bestStreak.maxWinStreak ?? 0)} wins`,
      hint: titleCaseLabel(bestStreak.name),
      tone: 'text-victory',
    });
  }
  if (player.totalPrestigeLevel) {
    records.push({
      key: 'prestige',
      icon: <PrestigeIcon total={player.totalPrestigeLevel} className="size-4" />,
      label: 'Total prestige',
      value: formatNumber(player.totalPrestigeLevel),
      hint: 'Across every brawler',
      tone: 'text-accent',
    });
  }
  if (robo) {
    records.push({
      key: 'robo',
      icon: <RoboRumbleIcon className="size-4" />,
      label: 'Robo Rumble',
      value: robo,
      hint: 'Longest survival',
      tone: 'text-foreground',
    });
  }
  if (bigBrawler) {
    records.push({
      key: 'big',
      icon: <BigBrawlerIcon className="size-4" />,
      label: 'Big Brawler',
      value: bigBrawler,
      hint: 'Longest time held',
      tone: 'text-foreground',
    });
  }

  if (records.length === 0) return null;

  return (
    <Panel title="Personal bests" aside="All-time">
      <ul className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
        {records.map((record) => (
          <li
            key={record.key}
            className="flex items-center gap-3.5 rounded-xl bg-surface-2/40 p-3.5"
          >
            {record.brawlerId !== undefined ? (
              <Image
                src={brawlerIconUrl(record.brawlerId)}
                alt=""
                width={52}
                height={52}
                className="size-13 shrink-0 rounded-lg bg-surface-3"
                loading="lazy"
                unoptimized
              />
            ) : (
              /* A record with no brawler behind it still needs something at
                 the same size, or the row jumps between cards. */
              <span className="grid size-13 shrink-0 place-items-center rounded-lg bg-surface-3">
                <span className={record.tone}>{record.icon}</span>
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                <span aria-hidden className={`flex shrink-0 items-center ${record.tone}`}>
                  {record.icon}
                </span>
                <span className="truncate">{record.label}</span>
              </p>
              <p className={`truncate text-xl font-black tabular-nums leading-tight ${record.tone}`}>
                {record.value}
              </p>
              <p className="truncate text-xs text-muted">{record.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

interface Record {
  key: string;
  /** Shows that brawler's portrait, for the records that belong to one. */
  brawlerId?: number;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}

