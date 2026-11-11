import Image from 'next/image';

import { TrophyIcon } from '@/components/game-icons';
import { activityFor } from '@/components/player/player-activity';
import { seasonFor } from '@/components/player/player-season';
import { trophyGamesFor } from '@/components/player/player-trophies';
import { brawlerName, rateTone } from '@/components/player/season/shared';
import { brawlerIconUrl, realBrawlerClass } from '@/lib/brawlapi';
import { getBattleLog } from '@/lib/bs-api';
import { fankitBody, fankitSkin } from '@/lib/fankit';
import { formatNumber, formatPercentWhole } from '@/lib/format';
import { gameWords } from '@/lib/i18n-game';
import { skinLabel } from '@/lib/player-showcase';
import { battleModeOf } from '@/lib/battle-mode';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSPlayer } from '@/types/brawlstars';

/** A colour per class, for the bar and its legend. */
const CLASS_COLOR: Record<string, string> = {
  'Damage Dealer': '#ff8a3d',
  Tank: '#35d07f',
  Assassin: '#a35bff',
  Support: '#35d0ff',
  Controller: '#ffc53d',
  Marksman: '#ff5c72',
  Artillery: '#9aa6d6',
};

interface Tally {
  games: number;
  wins: number;
  decided: number;
}

/**
 * How this account plays (2026-11-11), on the Overview tab: its main brawler
 * large, the classes it plays and how they go, the modes, and the trophy and
 * Ranked split. From the 30-day per-day table, the raw games of the last two
 * weeks and the battle log, so every account gets at least the last 25 games.
 */
export async function PlayerPlaystyle({
  player,
  tag,
  brawlerMeta,
  modeMeta,
}: {
  player: BSPlayer;
  tag: string;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  const locale = requestLocale();
  const t = getT(locale);
  const rows = (await activityFor(tag)) ?? [];
  const trophy = (await trophyGamesFor(tag)) ?? [];
  const { data } = await seasonFor(tag, player.tag);
  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => []);

  // Games per brawler: the month where the sampler has it, else the log.
  const perBrawler = new Map<number, Tally & { ranked: number }>();
  if (rows.length > 0) {
    for (const r of rows) {
      const b = perBrawler.get(r.brawlerId) ?? { games: 0, wins: 0, decided: 0, ranked: 0 };
      b.games += r.battles;
      b.wins += r.wins;
      b.decided += r.decided;
      b.ranked += r.rankedBattles;
      perBrawler.set(r.brawlerId, b);
    }
  } else {
    const me = player.tag.replace('#', '').toUpperCase();
    for (const e of log) {
      const people = [...(e.battle.teams ?? []).flat(), ...(e.battle.players ?? [])];
      const mine = people.find((p) => p.tag.replace('#', '').toUpperCase() === me);
      const id = mine?.brawler?.id ?? mine?.brawlers?.[0]?.id;
      if (!id) continue;
      const b = perBrawler.get(id) ?? { games: 0, wins: 0, decided: 0, ranked: 0 };
      b.games += 1;
      if (e.battle.result === 'victory' || e.battle.result === 'defeat') {
        b.decided += 1;
        if (e.battle.result === 'victory') b.wins += 1;
      }
      if (e.battle.type === 'soloRanked' || e.battle.type === 'teamRanked') b.ranked += 1;
      perBrawler.set(id, b);
    }
  }
  const total = [...perBrawler.values()].reduce((n, b) => n + b.games, 0);
  if (total < 5) return null;
  const rankedTotal = [...perBrawler.values()].reduce((n, b) => n + b.ranked, 0);

  // Classes.
  const classes = new Map<string, Tally>();
  for (const [id, b] of perBrawler) {
    const c = realBrawlerClass(brawlerMeta.get(id)?.class?.name) ?? null;
    if (!c) continue;
    const x = classes.get(c) ?? { games: 0, wins: 0, decided: 0 };
    x.games += b.games;
    x.wins += b.wins;
    x.decided += b.decided;
    classes.set(c, x);
  }
  const classRows = [...classes.entries()].sort((a, b) => b[1].games - a[1].games);
  const classTotal = classRows.reduce((n, [, x]) => n + x.games, 0) || 1;
  const topClass = classRows[0];
  const verdict = topClass && topClass[1].games / classTotal >= 0.35 ? t('{class} main', { class: t(topClass[0]) }) : t('All-rounder');

  // Modes, from single games: trophy and Ranked raw, else the log.
  const modes = new Map<string, number>();
  const rankedRaw = data?.games ?? [];
  if (trophy.length + rankedRaw.length > 0) {
    for (const g of trophy) modes.set(g.mode, (modes.get(g.mode) ?? 0) + 1);
    for (const g of rankedRaw) modes.set(g.mode, (modes.get(g.mode) ?? 0) + 1);
  } else {
    for (const e of log) {
      const m = battleModeOf(e);
      modes.set(m, (modes.get(m) ?? 0) + 1);
    }
  }
  const modeRows = [...modes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const modeTotal = [...modes.values()].reduce((n, x) => n + x, 0) || 1;
  const words = await gameWords(locale);

  // The main: most played; its art in the skin it wears.
  const ordered = [...perBrawler.entries()].sort((a, b) => b[1].games - a[1].games);
  const [mainId, main] = ordered[0];
  const owned = player.brawlers.find((b) => b.id === mainId);
  const label = owned ? skinLabel(owned) : null;
  const art = (owned && label ? fankitSkin(owned.id, owned.name, label) : null) ?? fankitBody(mainId) ?? brawlerMeta.get(mainId)?.imageUrl ?? brawlerIconUrl(mainId);
  const rarity = brawlerMeta.get(mainId)?.rarity?.color ?? 'var(--brand)';
  const top3 = ordered.slice(0, 3).reduce((n, [, b]) => n + b.games, 0);

  return (
    <section className="card overflow-hidden">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        {/* The main, large, on its rarity colour. */}
        <div
          className="relative isolate flex min-h-56 flex-col justify-end overflow-hidden p-5"
          style={{ background: `linear-gradient(170deg, color-mix(in srgb, ${rarity} 50%, var(--surface)) 0%, var(--surface) 80%)` }}
        >
          <Image src={art} alt="" fill unoptimized sizes="272px" className="-z-10 object-contain object-top p-4 pb-20 drop-shadow-[0_8px_0_rgb(5_10_31/0.45)]" />
          <p className="label-game text-xs text-white/80">{t('Main')}</p>
          <p className="display text-game-stroke text-3xl leading-none">{brawlerName(mainId, brawlerMeta)}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm font-bold">
            <span>{t('{games} games', { games: main.games })}</span>
            {main.decided >= 5 ? <span className={rateTone(main.wins / main.decided)}>{formatPercentWhole(main.wins / main.decided)}</span> : null}
            {owned ? (
              <span className="flex items-center gap-1 text-brand">
                <TrophyIcon className="size-3.5" />
                {formatNumber(owned.trophies)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="display text-xl leading-none sm:text-2xl">{t('Playstyle')}</h3>
            <span className="label-game rounded-full border-2 border-ink bg-brand px-3 py-0.5 text-sm text-brand-ink">{verdict}</span>
          </div>

          {classRows.length > 0 ? (
            <div>
              <div className="flex h-4 overflow-hidden rounded-full border-2 border-ink">
                {classRows.map(([c, x]) => (
                  <div key={c} title={`${t(c)} ${formatPercentWhole(x.games / classTotal)}`} style={{ flexGrow: x.games, background: CLASS_COLOR[c] ?? 'var(--muted)' }} />
                ))}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {classRows.map(([c, x]) => (
                  <li key={c} className="flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 rounded-full border border-ink" style={{ background: CLASS_COLOR[c] ?? 'var(--muted)' }} />
                    <span className="font-bold">{t(c)}</span>
                    <span className="text-muted tabular-nums">{formatPercentWhole(x.games / classTotal)}</span>
                    {x.decided >= 10 ? <span className={`text-xs font-bold tabular-nums ${rateTone(x.wins / x.decided)}`}>{formatPercentWhole(x.wins / x.decided)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {modeRows.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {modeRows.map(([m, n]) => {
                const icon = modeMeta.get(m.toLowerCase())?.imageUrl;
                return (
                  <li key={m} className="flex items-center gap-1.5 rounded-xl bg-surface-2/60 px-2.5 py-1.5 text-sm">
                    {icon ? <Image src={icon} alt="" width={18} height={18} unoptimized className="size-[18px]" /> : null}
                    <span className="font-bold">{words.mode(m)}</span>
                    <span className="text-muted tabular-nums">{formatPercentWhole(n / modeTotal)}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
              <div style={{ flexGrow: total - rankedTotal, background: 'var(--brand)' }} />
              <div style={{ flexGrow: rankedTotal, background: 'var(--accent)' }} />
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted">
              <span>
                <span className="font-bold text-brand">{formatPercentWhole((total - rankedTotal) / total)}</span> {t('Trophy games')}
              </span>
              <span>
                <span className="font-bold text-accent">{formatPercentWhole(rankedTotal / total)}</span> {t('Ranked games')}
              </span>
              <span>{t('{n} brawlers played, the top 3 are {pct} of games', { n: perBrawler.size, pct: formatPercentWhole(top3 / total) })}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
