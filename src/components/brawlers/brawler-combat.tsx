import { Ban, Crosshair, HeartPulse, Shield, Skull, Star, Swords, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { formatNumber, formatPercent } from '@/lib/format';
import { localePath } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { METRICS, MIN_BAN_BATTLES, NUMBER_MODES, bestFirst, rankBy, type BrawlerNumbers, type Metric, type RankNumbers } from '@/lib/ranked-numbers';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';
import type { BAGameMode } from '@/types/brawlapi';

const ICONS: Record<Metric, typeof Ban> = { kd: Swords, kills: Crosshair, deaths: Skull, damage: Zap, healing: HeartPulse, star: Star, deathless: Shield };

/** A brawler's line in one selection, and its place in each number. */
export interface BrawlerCombatData {
  row: BrawlerNumbers | null;
  places: Partial<Record<Metric, number>>;
  /** How many brawlers have enough games to be placed. */
  of: number;
  /** Share of games it is banned in, and its place; null while too few games. */
  ban: { rate: number; place: number } | null;
  modes: { mode: string; row: BrawlerNumbers | null; ban: number | null }[];
}

/** What the Ranked stats say about one brawler; null when they say nothing yet. */
export function brawlerCombatOf(id: number, data: RankNumbers | null): BrawlerCombatData | null {
  if (!data) return null;
  const rows = data.stats.all ?? [];
  const row = rows.find((r) => r.id === id) ?? null;
  const places: BrawlerCombatData['places'] = {};
  if (row) for (const m of METRICS) places[m] = rankBy(rows, m, bestFirst(m)).findIndex((r) => r.id === id) + 1;
  const banAt = data.bans.findIndex(([b]) => b === id);
  const ban = data.battles >= MIN_BAN_BATTLES ? { rate: banAt >= 0 ? data.bans[banAt][1] : 0, place: banAt + 1 } : null;
  const modes = NUMBER_MODES.map((mode) => {
    const of = data.modes[mode];
    return {
      mode,
      row: (data.stats[mode] ?? []).find((r) => r.id === id) ?? null,
      ban: of && of.battles >= MIN_BAN_BATTLES ? (of.bans.find(([b]) => b === id)?.[1] ?? 0) : null,
    };
  }).filter((m) => m.row !== null);
  if (!row && !ban) return null;
  return { row, places, of: rows.length, ban, modes };
}

/**
 * Kills, deaths, damage and bans of one brawler in Ranked this week
 * (2026-11-25), each with its place among all brawlers, then mode by mode.
 */
export async function BrawlerCombat({ name, data, modeMeta }: { name: string; data: BrawlerCombatData | null; modeMeta: Map<string, BAGameMode> }) {
  if (!data?.row) return null;
  const locale = requestLocale();
  const t = getT(locale);
  const words = await gameWords(locale);
  const { row, places, of, ban, modes } = data;

  const label: Record<Metric, string> = {
    kd: t('K/D'), kills: t('Kills a game'), deaths: t('Deaths a game'), damage: t('Damage a second'), healing: t('Healing a second'), star: t('Star player'), deathless: t('Never died'),
  };
  const value = (m: Metric, r: BrawlerNumbers) =>
    m === 'kd' || m === 'kills' || m === 'deaths' ? r[m].toFixed(2) : m === 'damage' || m === 'healing' ? formatNumber(Math.round(r[m])) : formatPercent(r[m]);
  /** The top tenth is worth colouring, and nothing else is. */
  const tone = (place: number) => (place > 0 && place <= Math.max(1, Math.round(of / 10)) ? 'text-brand' : '');

  return (
    <section id="numbers" className="scroll-mt-24">
      <SectionHeading
        title={t('Kills, deaths and damage')}
        subtitle={t('{name} in {n} Ranked games this week.', { name, n: formatNumber(row.games) })}
        aside={<Link href={localePath(locale, '/ranked/stats')} className="text-sm font-semibold text-brand hover:underline">{t('Ranked stats')}</Link>}
      />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {/* Healing only for the quarter that heals most: "87th of 87" says nothing. */}
        {METRICS.filter((m) => m !== 'healing' || (places.healing ?? Infinity) <= of / 4).map((m) => {
          const Icon = ICONS[m];
          return (
            <li key={m} className="rounded-2xl border-2 border-ink bg-surface-2/70 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Icon aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{label[m]}</span>
              </p>
              <p className={`display mt-1 text-3xl leading-none tabular-nums ${tone(places[m] ?? 0)}`}>{value(m, row)}</p>
              {places[m] ? <p className="mt-1.5 text-xs text-muted">{`#${places[m]} ${t('of {n}', { n: of })}`}</p> : null}
            </li>
          );
        })}
        {ban ? (
          <li className="rounded-2xl border-2 border-ink bg-surface-2/70 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Ban aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{t('Ban rate')}</span>
            </p>
            <p className={`display mt-1 text-3xl leading-none tabular-nums ${ban.rate >= 0.2 ? 'text-defeat' : ''}`}>{formatPercent(ban.rate)}</p>
            {ban.place > 0 ? <p className="mt-1.5 text-xs text-muted">{t('#{n} most banned', { n: ban.place })}</p> : null}
          </li>
        ) : null}
      </ul>

      {modes.length > 1 ? (
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted">
                <th className="py-2.5 pl-4 pr-2 font-semibold">{t('Mode')}</th>
                <th className="px-2 py-2.5 text-right font-semibold">{t('K/D')}</th>
                <th className="px-2 py-2.5 text-right font-semibold">{t('Kills')}</th>
                <th className="px-2 py-2.5 text-right font-semibold">{t('Deaths')}</th>
                <th className="px-2 py-2.5 text-right font-semibold">{t('Damage a second')}</th>
                <th className="py-2.5 pl-2 pr-4 text-right font-semibold">{t('Ban rate')}</th>
              </tr>
            </thead>
            <tbody>
              {modes.map((m) => {
                const icon = modeMeta.get(m.mode.toLowerCase())?.imageUrl;
                return (
                  <tr key={m.mode} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pl-4 pr-2">
                      <span className="flex items-center gap-2 font-bold">
                        {icon ? <Image src={icon} alt="" width={22} height={22} unoptimized className="size-[22px] shrink-0 object-contain" /> : null}
                        <span className="whitespace-nowrap">{words.mode(m.mode)}</span>
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-right font-bold tabular-nums ${m.row!.kd >= 1 ? 'text-victory' : 'text-defeat'}`}>{m.row!.kd.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{m.row!.kills.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{m.row!.deaths.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatNumber(Math.round(m.row!.damage))}</td>
                    <td className="py-2 pl-2 pr-4 text-right tabular-nums">{m.ban === null ? '–' : formatPercent(m.ban)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
