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
import { type StatItem, StatStrip } from '@/components/ui/stat-strip';
import { formatDuration, formatNumber, titleCaseLabel } from '@/lib/format';
import type { BSPlayer } from '@/types/brawlstars';

export function PlayerStats({ player }: { player: BSPlayer }) {
  // Ranked deliberately absent: the Ranking section shows the current,
  // season-best and all-time-best tiers with their elo, so a figure repeating
  // just the current tier was the weakest thing in this row.
  return (
    <StatStrip
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

  const items: StatItem[] = [];

  if (bestBrawler && bestBrawler.highestTrophies > 0) {
    items.push({
      node: <TrophyIcon className="size-4" />,
      label: 'Best brawler',
      value: formatNumber(bestBrawler.highestTrophies),
      hint: titleCaseLabel(bestBrawler.name),
    });
  }
  if (bestStreak && (bestStreak.maxWinStreak ?? 0) > 0) {
    items.push({
      node: <WinStreakIcon className="size-4" />,
      label: 'Best win streak',
      value: formatNumber(bestStreak.maxWinStreak ?? 0),
      hint: titleCaseLabel(bestStreak.name),
    });
  }
  if (player.totalPrestigeLevel) {
    items.push({
      node: <PrestigeIcon total={player.totalPrestigeLevel} className="size-4" />,
      label: 'Total prestige',
      value: formatNumber(player.totalPrestigeLevel),
      hint: 'Across every brawler',
    });
  }
  if (robo) {
    items.push({
      node: <RoboRumbleIcon className="size-4" />,
      label: 'Robo Rumble',
      value: robo,
      hint: 'Longest survival',
    });
  }
  if (bigBrawler) {
    items.push({
      node: <BigBrawlerIcon className="size-4" />,
      label: 'Big Brawler',
      value: bigBrawler,
      hint: 'Longest time as the Big Brawler',
    });
  }

  if (items.length === 0) return null;

  /*
   * No heading of its own any more. "Personal bests" was a section title over
   * five cards that sat directly under five near-identical cards; the group
   * header above now says what the whole area is, and one more title inside it
   * was a line of type separating two things that look the same anyway.
   */
  return <StatStrip items={items} />;
}
