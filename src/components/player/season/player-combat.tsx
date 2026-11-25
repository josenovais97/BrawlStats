import { Crosshair, HeartPulse, Shield, Skull, Star, Swords, Zap } from 'lucide-react';
import Link from 'next/link';

import { SeasonHeading } from '@/components/player/season/shared';
import { MIN_COMBAT_GAMES, combatRates, expectedRates, type CombatRates, type PlayerCombat } from '@/lib/combat';
import { formatNumber, formatPercentWhole } from '@/lib/format';
import { localePath, rankLabel } from '@/lib/i18n';
import { bracketForRankName } from '@/lib/rank-brackets';
import { isRankKey } from '@/lib/ranked-numbers';
import { getRankNumbers } from '@/lib/ranked-numbers-data';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';
import type { BSPlayer } from '@/types/brawlstars';

/**
 * Kills, deaths and damage of the season's Ranked games (2026-11-25), beside
 * what others at the player's rank do with the same brawlers: the battle log
 * carries them since November.
 */
export async function PlayerCombatPanel({ player, combat }: { player: BSPlayer; combat: PlayerCombat }) {
  const locale = requestLocale();
  const t = getT(locale);
  const mine = combat.totals.games >= MIN_COMBAT_GAMES ? combatRates(combat.totals) : null;
  if (!mine) return null;

  const bracket = bracketForRankName(player.rankedRankName) ?? bracketForRankName(player.highestSeasonRankedRankName);
  const at = bracket && isRankKey(bracket.slug) ? await getRankNumbers(bracket.slug).catch(() => null) : null;
  const here = at ? expectedRates(combat.byBrawler, at.stats.all ?? []) : null;
  // Too few games at that rank yet: Mythic and up, where most games are.
  const wide = here ? null : await getRankNumbers('mythic-plus').catch(() => null);
  const others = here ?? (wide ? expectedRates(combat.byBrawler, wide.stats.all ?? []) : null);
  const where = here && bracket ? rankLabel(bracket, locale) : t('Mythic and up');

  const perGame = (n: number) => n.toFixed(2);
  const perSecond = (n: number) => formatNumber(Math.round(n));
  const rows: { key: keyof CombatRates; label: string; icon: typeof Skull; show: (n: number) => string; low?: boolean }[] = [
    { key: 'kd', label: t('K/D'), icon: Swords, show: perGame },
    { key: 'kills', label: t('Kills a game'), icon: Crosshair, show: perGame },
    { key: 'deaths', label: t('Deaths a game'), icon: Skull, show: perGame, low: true },
    { key: 'damage', label: t('Damage a second'), icon: Zap, show: perSecond },
    { key: 'healing', label: t('Healing a second'), icon: HeartPulse, show: perSecond },
    { key: 'star', label: t('Star player'), icon: Star, show: formatPercentWhole },
    { key: 'deathless', label: t('Never died'), icon: Shield, show: formatPercentWhole },
  ];
  const tone = (r: (typeof rows)[number]) => {
    if (!others) return '';
    const a = mine[r.key];
    const b = others[r.key];
    // A twentieth either way is the same.
    if (Math.abs(a - b) <= Math.abs(b) * 0.05) return '';
    return a > b === !r.low ? 'text-victory' : 'text-defeat';
  };

  return (
    <section className="card p-5 sm:p-6">
      <SeasonHeading title={t('Kills, deaths and damage')} aside={t('From {n} Ranked games', { n: formatNumber(combat.totals.games) })} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {rows.map((r) => (
          <li key={r.key} className="rounded-2xl border-2 border-ink bg-surface-2/70 px-4 py-3 shadow-[inset_0_2px_0_rgb(255_255_255/0.08),0_3px_0_var(--ink)]">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <r.icon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{r.label}</span>
            </p>
            <p className={`display mt-1 text-3xl leading-none tabular-nums ${tone(r)}`}>{r.show(mine[r.key])}</p>
            {others ? <p className="mt-1 text-[11px] text-muted">{t('Others: {n}', { n: r.show(others[r.key]) })}</p> : null}
          </li>
        ))}
      </ul>
      {others ? (
        <p className="mt-3 text-xs text-muted">
          {t('Others: the same brawlers in {rank} games.', { rank: where })}{' '}
          <Link href={localePath(locale, '/ranked/stats')} className="font-semibold text-brand hover:underline">{t('Ranked stats')}</Link>
        </p>
      ) : null}
    </section>
  );
}
