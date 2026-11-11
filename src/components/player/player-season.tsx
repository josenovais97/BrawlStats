import { ChevronRight, Download, Flame, Snowflake } from 'lucide-react';
import Image from 'next/image';
import { cache, type ReactNode } from 'react';
import Link from 'next/link';

import { CrownIcon, RankedIcon } from '@/components/game-icons';
import { brawlerName, BrawlerFace, rankLabel, rankNumber, rateFill, rateTone, SeasonHeading, WinLossBar } from '@/components/player/season/shared';
import { RankRoad } from '@/components/player/season/rank-road';
import { SeasonCalendar } from '@/components/player/season/season-calendar';
import { SeasonHours } from '@/components/player/season/season-hours';
import { ShareButton } from '@/components/player/share-button';
import { rankedTierIconUrl } from '@/lib/brawlapi';
import { getBattleLog } from '@/lib/bs-api';
import { formatNumber, formatPercentWhole } from '@/lib/format';
import { getActiveMaps, type GameMap } from '@/lib/game-maps';
import { DATE_LOCALE, localePath } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import {
  bestBrawler,
  bestKeyed,
  dayBefore,
  gamesFromLog,
  seasonView,
  todayUtc,
  winRate,
  type BrawlerRecord,
} from '@/lib/ranked-season';
import { getSeasonState } from '@/lib/ranked-seasons';
import { brawlerPath } from '@/lib/slugs';
import { getPlayerRankedSeason, mapNameKey } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSPlayer } from '@/types/brawlstars';

/**
 * The season's reads and the view built from them, once per request: the
 * Ranked tab and the Overview teaser both ask.
 */
export const seasonFor = cache(async (tag: string, playerTag: string) => {
  const state = await getSeasonState().catch(() => null);
  const season = state?.current ?? state?.latest ?? null;
  const from = season?.startsOn ?? null;
  const to = season?.endsOn ?? null;
  const data = from && to ? await getPlayerRankedSeason(tag, from, to) : null;
  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => []);
  const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : 0;
  const toMs = to ? Date.parse(`${to}T00:00:00Z`) : Infinity;
  const logGames = gamesFromLog(log, playerTag).filter((g) => g.time >= fromMs && g.time < toMs);
  const view = seasonView(data?.rows ?? [], data?.games ?? [], logGames);
  return { state, season, from, to, data, view };
});

/**
 * A card on the Overview tab pointing at the Ranked tab, so the season is
 * found from the tab people land on. Nothing without Ranked games.
 */
export async function SeasonTeaser({
  player,
  tag,
  brawlerMeta,
}: {
  player: BSPlayer;
  tag: string;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const { state, season, view } = await seasonFor(tag, player.tag);
  if (view.games === 0) return null;
  const t = getT(requestLocale());
  const top = view.brawlers[0];
  const days = state?.current ? state.daysUntilNext : null;
  return (
    <a
      href="#ranked"
      className="card card-interactive relative isolate flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(70% 120% at 0% 0%, rgb(255 197 61 / 0.2), transparent 60%), radial-gradient(60% 100% at 100% 100%, rgb(139 107 255 / 0.18), transparent 60%)' }}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
          <RankedIcon className="size-4" />
          {season?.number ? t('Ranked · Season {n}', { n: season.number }) : t('Ranked')}
          {days !== null && days !== undefined ? (
            <span className="rounded-full border-2 border-ink bg-brand px-2 py-0.5 text-[11px] text-brand-ink">
              {days <= 1 ? t('Ends tomorrow') : t('Ends in {n} days', { n: days })}
            </span>
          ) : null}
        </p>
        <p className="display text-game-stroke mt-1 text-3xl leading-none sm:text-4xl">
          {season?.number ? t('SEASON {n}', { n: season.number }) : t('MY SEASON')}{' '}
          <span className="text-brand">{t('WRAPPED')}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="text-xs text-muted">{t('Ranked games')}</p>
          <p className="display text-2xl leading-none tabular-nums">{formatNumber(view.games)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{t('Win rate')}</p>
          <p className="display text-2xl leading-none text-brand tabular-nums">{formatPercentWhole(view.wins / view.games)}</p>
        </div>
        {top ? (
          <div className="flex items-center gap-2">
            <BrawlerFace id={top.brawlerId} meta={brawlerMeta} size={40} />
            <div>
              <p className="text-xs text-muted">{t('Most played')}</p>
              <p className="label-game text-base leading-tight">{brawlerName(top.brawlerId, brawlerMeta)}</p>
            </div>
          </div>
        ) : null}
        <span className="btn-game inline-flex items-center gap-1.5 bg-brand px-4 py-2 text-sm text-brand-ink">
          {t('See the whole season')}
          <ChevronRight className="size-4" />
        </span>
      </div>
    </a>
  );
}

/**
 * The profile's Ranked tab (2026-11-10): the Bubble app's Season Wrapped as
 * a page. Ranked games only.
 *
 * Season totals (games, win rate, top brawlers, the calendar) come from the
 * per-day table for accounts the sampler visits, plus the battle log's games
 * newer than the last visit. Single-game detail (modes, maps, team-mates,
 * opponents, hours, streaks) comes from the raw games, kept about two weeks,
 * plus the log. An account the sampler has not met yet gets the log alone.
 */
export async function PlayerSeason({
  player,
  tag,
  brawlerMeta,
  modeMeta,
  averageRate,
}: {
  player: BSPlayer;
  tag: string;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
  /** Each brawler's Ranked win rate across all players, last 7 days. */
  averageRate: Map<number, number>;
}) {
  const locale = requestLocale();
  const t = getT(locale);
  const lp = (path: string) => localePath(locale, path);
  const dateLocale = DATE_LOCALE[locale];
  const fmtDay = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  const { state, season, from, to, data, view } = await seasonFor(tag, player.tag);
  const { hasSeason, brawlers, days, games, wins, recent, detail, detailDays } = view;

  const hasRank = Boolean(player.rankedElo || player.highestAllTimeRankedElo);
  const seasonNo = season?.number ?? null;
  const live = Boolean(state?.current);
  const last = to ? dayBefore(to) : null;

  if (games === 0 && !hasRank) {
    return (
      <section className="card p-8 text-center">
        <RankedIcon className="mx-auto size-10 opacity-60" />
        <p className="label-game mt-3 text-xl">{t('No Ranked games this season yet')}</p>
      </section>
    );
  }

  const [words, maps] = await Promise.all([gameWords(locale), getActiveMaps().catch(() => [] as GameMap[])]);
  const mapByKey = new Map(maps.map((m) => [mapNameKey(m.map.name), m]));
  const modeIcon = (mode: string) => modeMeta.get(mode.toLowerCase())?.imageUrl ?? null;
  const modeColor = (mode: string) => modeMeta.get(mode.toLowerCase())?.color ?? 'var(--brand)';

  const top = brawlers.slice(0, 10);
  const rest = brawlers.slice(10);
  const mostGames = Math.max(1, top[0]?.games ?? 1);
  const best = bestBrawler(brawlers, games);
  const bestMode = bestKeyed(detail.modes, 5);
  const bestMap = bestKeyed(detail.maps, 3);
  const mate = detail.allies[0] ?? null;
  const nemesis = detail.enemies[0] ?? null;
  const current = detail.streaks.current;

  const currentTier = rankNumber(player.rankedRankName);
  const seasonTier = rankNumber(player.highestSeasonRankedRankName);
  const allTimeTier = rankNumber(player.highestAllTimeRankedRankName);
  const icon = (n: number | null) => (n ? rankedTierIconUrl(n) : null);

  const subtitle = !hasSeason
    ? games > 0
      ? t('From the last {n} Ranked games in the battle log.', { n: games })
      : t('No Ranked games recorded this season yet.')
    : data?.firstSeen && from && data.firstSeen > from
      ? t('Recorded since {date}.', { date: fmtDay(data.firstSeen).replace(/\.$/, '') })
      : from && last
        ? `${fmtDay(from)} – ${fmtDay(last)}`
        : null;

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ hero */}
      <section className="card card-glow relative isolate overflow-hidden p-5 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 80% at 0% 0%, rgb(255 197 61 / 0.22), transparent 60%), radial-gradient(50% 70% at 100% 100%, rgb(53 208 255 / 0.16), transparent 60%)',
          }}
        />
        <div aria-hidden className="reward-rays pointer-events-none opacity-50" style={{ inset: 'auto', top: '-45%', right: '-20%', width: '65%', aspectRatio: '1' }} />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
              <RankedIcon className="size-4" />
              {seasonNo ? t('Ranked · Season {n}', { n: seasonNo }) : t('Ranked')}
              {live && state?.daysUntilNext !== null && state?.daysUntilNext !== undefined ? (
                <span className="rounded-full border-2 border-ink bg-brand px-2.5 py-0.5 text-xs text-brand-ink">
                  {state.daysUntilNext <= 1 ? t('Ends tomorrow') : t('Ends in {n} days', { n: state.daysUntilNext })}
                </span>
              ) : seasonNo ? (
                <span className="rounded-full border-2 border-ink bg-surface-3 px-2.5 py-0.5 text-xs">{t('Season over')}</span>
              ) : null}
            </p>
            <h2 className="display text-game-stroke mt-3 text-5xl leading-[0.95] sm:text-6xl">
              {seasonNo ? t('SEASON {n}', { n: seasonNo }) : t('MY SEASON')}
              <br />
              <span className="text-brand">{t('WRAPPED')}</span>
            </h2>
            {subtitle ? <p className="mt-3 max-w-xl text-sm text-muted">{subtitle}</p> : null}
            {!hasSeason && games > 0 ? <p className="mt-1 max-w-xl text-sm text-muted">{t('Season totals show up here within a few hours.')}</p> : null}
          </div>

          {/* Today's rank big, the season's and the all-time best beside it. */}
          {hasRank ? (
            <div className="flex shrink-0 items-end gap-4">
              <div className="text-center">
                {icon(currentTier) ? (
                  <Image src={icon(currentTier)!} alt="" width={128} height={128} unoptimized className="mx-auto size-24 object-contain drop-shadow-[0_6px_0_rgb(5_10_31/0.6)] sm:size-32" />
                ) : null}
                <p className="label-game mt-1 text-xl leading-tight">{rankLabel(player.rankedRankName, t) ?? t('Unranked')}</p>
                {player.rankedElo ? <p className="text-sm font-bold text-brand tabular-nums">{t('{v} elo', { v: formatNumber(player.rankedElo) })}</p> : null}
              </div>
              <div className="flex flex-col gap-2 pb-1">
                {[
                  { label: t('Season best'), tier: seasonTier, name: player.highestSeasonRankedRankName, elo: player.highestSeasonRankedElo },
                  { label: t('All-time best'), tier: allTimeTier, name: player.highestAllTimeRankedRankName, elo: player.highestAllTimeRankedElo },
                ]
                  .filter((r) => r.name)
                  .map((r) => (
                    <div key={r.label} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-surface-2/70 py-1 pl-1 pr-3">
                      {icon(r.tier) ? <Image src={icon(r.tier)!} alt="" width={40} height={40} unoptimized className="size-10 object-contain" /> : null}
                      <div className="leading-tight">
                        <p className="text-[11px] text-muted">{r.label}</p>
                        <p className="label-game text-sm">{rankLabel(r.name, t)}</p>
                        {r.elo ? <p className="text-[11px] tabular-nums text-muted">{formatNumber(r.elo)}</p> : null}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>

        {games > 0 ? (
          <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label={t('Ranked games')} value={formatNumber(games)} />
            <Tile label={t('Win rate')} value={formatPercentWhole(wins / games)} tone="text-brand">
              <WinLossBar wins={wins} games={games} className="mt-2 h-1.5" />
            </Tile>
            <Tile label={t('Wins')} value={formatNumber(wins)} tone="text-victory" />
            <Tile label={t('Losses')} value={formatNumber(games - wins)} tone="text-defeat" />
            <Tile
              label={t('Longest win streak')}
              value={formatNumber(detail.streaks.longestWin)}
              hint={hasSeason && detailDays ? t('Last {n} days', { n: detailDays }) : undefined}
            />
            <Tile label={t('Brawlers played')} value={formatNumber(brawlers.length)} />
          </div>
        ) : null}

        {/* The latest Ranked games, newest first. */}
        {recent.length > 0 ? (
          <div className="relative mt-6">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="label-game text-sm text-muted">{t('Recent form')}</p>
              {current >= 3 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-victory/15 px-2 py-0.5 text-xs font-bold text-victory">
                  <Flame className="size-3.5" />
                  {t('{n} wins in a row', { n: current })}
                </span>
              ) : current <= -3 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-defeat/15 px-2 py-0.5 text-xs font-bold text-defeat">
                  <Snowflake className="size-3.5" />
                  {t('{n} losses in a row', { n: -current })}
                </span>
              ) : null}
            </div>
            <ol className="flex gap-1.5 overflow-x-auto pb-1">
              {recent.slice(0, 15).map((g) => (
                <li key={g.time} className="shrink-0" title={`${words.mode(g.mode)}${g.map ? ` · ${words.map(g.map)}` : ''} · ${g.win ? t('Win') : t('Loss')}`}>
                  <div className={`overflow-hidden rounded-xl border-2 border-ink ${g.win ? 'bg-victory' : 'bg-defeat'}`}>
                    <BrawlerFace id={g.brawlerId} meta={brawlerMeta} size={40} bare />
                    <p aria-hidden className="text-center text-[11px] font-black leading-4 text-ink">{g.win ? '✓' : '✗'}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      {/* -------------------------------------------------------- top 10 */}
      {top.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <SeasonHeading
            title={t('Top 10 brawlers')}
            aside={hasSeason ? t('Most played in Ranked this season') : t('Last {n} Ranked games', { n: games })}
          />

          {/* The podium: the three most played, big. */}
          <ol className="grid grid-cols-3 gap-2 sm:gap-4">
            {top.slice(0, 3).map((b, i) => (
              <li
                key={b.brawlerId}
                className="relative flex flex-col items-center rounded-2xl border-2 border-ink px-2 pb-3 pt-4 text-center shadow-[inset_0_2px_0_rgb(255_255_255/0.1),0_4px_0_var(--ink)] sm:px-4"
                style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${MEDAL[i]} 26%, var(--surface-2)), var(--surface))` }}
              >
                <span
                  className="display text-game-stroke absolute left-2 top-1.5 text-2xl sm:left-3 sm:text-3xl"
                  style={{ color: MEDAL[i] }}
                >
                  {i + 1}
                </span>
                <Link href={lp(brawlerPath(b.brawlerId, brawlerMeta.get(b.brawlerId)?.name))} className="transition-transform hover:-translate-y-0.5">
                  <BrawlerFace id={b.brawlerId} meta={brawlerMeta} size={72} />
                </Link>
                <p className="label-game mt-2 w-full truncate text-base sm:text-lg">{brawlerName(b.brawlerId, brawlerMeta)}</p>
                <p className={`display text-3xl leading-none sm:text-4xl ${rateTone(winRate(b))}`}>{formatPercentWhole(winRate(b))}</p>
                <p className="mt-1 text-xs font-bold tabular-nums">{`${b.wins}–${b.games - b.wins}`}</p>
                <p className="text-[11px] text-muted sm:text-xs">{t('{games} games', { games: b.games })}</p>
              </li>
            ))}
          </ol>

          <ol className="mt-4 divide-y divide-border/60" start={4}>
            {top.slice(3).map((b, i) => (
              <BrawlerRow key={b.brawlerId} rank={i + 4} row={b} max={mostGames} meta={brawlerMeta} average={averageRate.get(b.brawlerId)} lp={lp} />
            ))}
          </ol>

          {/* Everyone's average on the podium three too, under them. */}
          {top.slice(0, 3).some((b) => averageRate.has(b.brawlerId) && b.games >= 10) ? (
            <p className="mt-3 text-xs text-muted">
              {top
                .slice(0, 3)
                .filter((b) => averageRate.has(b.brawlerId) && b.games >= 10)
                .map((b) => `${brawlerName(b.brawlerId, brawlerMeta)} ${diffLabel(winRate(b) - averageRate.get(b.brawlerId)!, t)}`)
                .join(' · ')}
            </p>
          ) : null}

          {rest.length > 0 ? (
            <details className="group mt-4">
              <summary className="cursor-pointer list-none text-sm font-bold text-brand hover:underline">
                {t('All {n} brawlers', { n: brawlers.length })}
              </summary>
              <ol className="mt-2 divide-y divide-border/60">
                {rest.map((b, i) => (
                  <BrawlerRow key={b.brawlerId} rank={i + 11} row={b} max={mostGames} meta={brawlerMeta} average={averageRate.get(b.brawlerId)} lp={lp} />
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ) : null}

      {/* -------------------------------------------------------- awards */}
      {games > 0 ? (
        <section>
          <SeasonHeading title={t('Season awards')} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {top[0] ? (
              <Award label={t('Most played')} art={<BrawlerFace id={top[0].brawlerId} meta={brawlerMeta} size={56} />}>
                <AwardValue main={brawlerName(top[0].brawlerId, brawlerMeta)} sub={t('{games} games', { games: top[0].games })} />
              </Award>
            ) : null}
            {best ? (
              <Award label={t('Best brawler')} art={<BrawlerFace id={best.brawlerId} meta={brawlerMeta} size={56} />}>
                <AwardValue main={brawlerName(best.brawlerId, brawlerMeta)} sub={t('{rate} won · {games} games', { rate: formatPercentWhole(winRate(best)), games: best.games })} />
              </Award>
            ) : null}
            {bestMode ? (
              <Award label={t('Best mode')} art={<ModeArt url={modeIcon(bestMode.key)} />}>
                <AwardValue main={words.mode(bestMode.key)} sub={t('{rate} won · {games} games', { rate: formatPercentWhole(winRate(bestMode)), games: bestMode.games })} />
              </Award>
            ) : null}
            {bestMap ? (
              <Award label={t('Best map')} art={<MapArt map={mapByKey.get(mapNameKey(bestMap.key))} />}>
                <AwardValue main={words.map(bestMap.key)} sub={t('{rate} won · {games} games', { rate: formatPercentWhole(winRate(bestMap)), games: bestMap.games })} />
              </Award>
            ) : null}
            {mate ? (
              <Award label={t('Best teammate')} art={<BrawlerFace id={mate.brawlerId} meta={brawlerMeta} size={56} />}>
                <AwardValue main={brawlerName(mate.brawlerId, brawlerMeta)} sub={t('{rate} won together', { rate: formatPercentWhole(winRate(mate)) })} />
              </Award>
            ) : null}
            {nemesis ? (
              <Award label={t('Toughest opponent')} art={<BrawlerFace id={nemesis.brawlerId} meta={brawlerMeta} size={56} />}>
                <AwardValue main={brawlerName(nemesis.brawlerId, brawlerMeta)} sub={t('{rate} won against', { rate: formatPercentWhole(winRate(nemesis)) })} />
              </Award>
            ) : null}
            {detail.streaks.longestWin >= 2 ? (
              <Award label={t('Longest win streak')} art={<BigNumber value={detail.streaks.longestWin} tone="text-victory" />}>
                <AwardValue main={t('{n} wins in a row', { n: detail.streaks.longestWin })} sub={hasSeason && detailDays ? t('Last {n} days', { n: detailDays }) : null} />
              </Award>
            ) : null}
            {detail.streaks.longestLoss >= 2 ? (
              <Award label={t('Longest losing streak')} art={<BigNumber value={detail.streaks.longestLoss} tone="text-defeat" />}>
                <AwardValue main={t('{n} losses in a row', { n: detail.streaks.longestLoss })} sub={hasSeason && detailDays ? t('Last {n} days', { n: detailDays }) : null} />
              </Award>
            ) : null}
          </div>
        </section>
      ) : null}

      <RankRoad
        now={player.rankedElo ?? null}
        seasonBest={player.highestSeasonRankedElo ?? null}
        allTime={player.highestAllTimeRankedElo ?? null}
        points={eloPoints(data?.elo ?? [], player.rankedElo ?? null, live)}
        from={from ?? todayUtc()}
        to={last ?? todayUtc()}
      />

      {hasSeason && from && last ? <SeasonCalendar days={days} from={from} last={last} /> : null}

      {/* ------------------------------------------------- modes and maps */}
      {detail.modes.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <SeasonHeading title={t('Modes')} aside={t('Last {n} Ranked games', { n: detail.games })} />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {detail.modes.map((m) => (
              <li
                key={m.key}
                className="relative overflow-hidden rounded-2xl border-2 border-ink bg-surface-2/60 p-3 shadow-[inset_0_2px_0_rgb(255_255_255/0.08)] sm:p-4"
                style={{ borderTopColor: modeColor(m.key), borderTopWidth: 4 }}
              >
                <div className="flex items-center gap-2">
                  <ModeArt url={modeIcon(m.key)} small />
                  <p className="label-game min-w-0 truncate text-sm sm:text-base">{words.mode(m.key)}</p>
                </div>
                <p className={`display mt-2 text-3xl leading-none ${rateTone(winRate(m))}`}>{formatPercentWhole(winRate(m))}</p>
                <WinLossBar wins={m.wins} games={m.games} className="mt-2 h-1.5" />
                <p className="mt-1.5 text-xs text-muted">{t('{w}–{l} · {games} games', { w: m.wins, l: m.games - m.wins, games: m.games })}</p>
              </li>
            ))}
          </ul>

          {detail.maps.length > 0 ? (
            <>
              <p className="label-game mb-2 mt-6 text-base">{t('Maps')}</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {detail.maps.slice(0, 12).map((m) => {
                  const art = mapByKey.get(mapNameKey(m.key));
                  const body = (
                    <>
                      <MapArt map={art} small />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                          {modeIcon(m.mode) ? <Image src={modeIcon(m.mode)!} alt="" width={16} height={16} unoptimized className="size-4 shrink-0" /> : null}
                          <span className="truncate">{words.map(m.key)}</span>
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                            <div className={`h-full ${rateFill(winRate(m))}`} style={{ width: `${winRate(m) * 100}%` }} />
                          </div>
                          <span className="shrink-0 text-xs text-muted tabular-nums">{`${m.wins}–${m.games - m.wins}`}</span>
                        </div>
                      </div>
                      <span className={`label-game w-12 shrink-0 text-right text-lg ${rateTone(winRate(m))}`}>{formatPercentWhole(winRate(m))}</span>
                    </>
                  );
                  return (
                    <li key={`${m.mode}-${m.key}`}>
                      {art ? (
                        <Link href={lp(`/maps/${art.modeSlug}/${art.mapSlug}`)} className="flex items-center gap-3 rounded-xl bg-surface-2/40 p-2 transition-colors hover:bg-surface-2">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl bg-surface-2/40 p-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------------------ team-mates, opponents */}
      {detail.allies.length > 0 || detail.enemies.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <PairList
            title={t('Best teammates')}
            aside={t('Brawlers on your team, at least 3 games')}
            rows={detail.allies.slice(0, 6)}
            meta={brawlerMeta}
            caption={(r) => t('{games} games together', { games: r.games })}
          />
          <PairList
            title={t('Toughest opponents')}
            aside={t('Enemy brawlers, at least 3 games')}
            rows={detail.enemies.slice(0, 6)}
            meta={brawlerMeta}
            caption={(r) => t('{games} games against', { games: r.games })}
          />
        </div>
      ) : null}

      {recent.length >= 10 ? (
        <SeasonHours
          games={recent.map((g): [number, 0 | 1] => [Math.round(g.time / 1000), g.win ? 1 : 0])}
          dateLocale={dateLocale}
          percentStyle={locale === 'tr' ? 'pre' : locale === 'fr' ? 'space' : 'post'}
          labels={{
            title: t('When you play'),
            aside: t('Last {n} Ranked games, your time', { n: recent.length }),
            busiest: t('Most games: {hour}'),
            best: t('Best hour: {hour} ({rate} won)'),
            cell: t('{games} games, {rate} won'),
            weekdays: t('Win rate by day'),
          }}
        />
      ) : null}

      {/* ----------------------------------------------------------- share */}
      {games > 0 ? (
      <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <CrownIcon className="size-8 shrink-0" />
          <div>
            <p className="label-game text-lg leading-tight">{t('Share your season')}</p>
            <p className="text-sm text-muted">{t('A story-sized card with your rank, record and top brawlers.')}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {hasSeason ? (
            <a
              href={`/api/bubble/card?kind=season&tag=${encodeURIComponent(tag)}&lang=${locale}`}
              target="_blank"
              rel="nofollow noopener"
              className="btn-game inline-flex items-center gap-2 bg-brand px-4 py-2 text-sm text-brand-ink hover:bg-brand-strong"
            >
              <Download className="size-4" />
              {t('Get the card')}
            </a>
          ) : null}
          <ShareButton title={t('{name}: Season Wrapped', { name: player.name })} text={t('{name}: Season Wrapped', { name: player.name })} />
        </div>
      </section>
      ) : null}

      <p className="text-center text-sm text-muted">
        {t('Your rank and season over the game, live:')}{' '}
        <Link href={lp('/bubble')} className="font-bold text-brand hover:underline">
          BrawlZone Bubble
        </Link>
      </p>
    </div>
  );
}

const MEDAL = ['#FFC53D', '#D7DEEE', '#E59A5C'];

type T = ReturnType<typeof getT>;

/** "+6 pts vs average", in the page's language. */
function diffLabel(diff: number, t: T): string {
  const n = Math.round(diff * 100);
  return t('{n} pts vs average', { n: `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}` });
}

/** Daily readings plus today's live elo, while the season is running. */
function eloPoints(readings: { day: string; elo: number }[], now: number | null, live: boolean) {
  const today = todayUtc();
  const points = readings.filter((p) => p.day !== today);
  if (now && live) points.push({ day: today, elo: now });
  return points;
}

export function Tile({ label, value, tone, hint, children }: { label: string; value: string; tone?: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-surface-2/70 px-4 py-3 shadow-[inset_0_2px_0_rgb(255_255_255/0.08),0_3px_0_var(--ink)]">
      <p className="text-xs text-muted">{label}</p>
      <p className={`display mt-0.5 text-3xl leading-none tabular-nums ${tone ?? ''}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

function BrawlerRow({
  rank,
  row,
  max,
  meta,
  average,
  lp,
}: {
  rank: number;
  row: BrawlerRecord;
  max: number;
  meta: Map<number, BABrawler>;
  average: number | undefined;
  lp: (path: string) => string;
}) {
  const t = getT(requestLocale());
  const rate = winRate(row);
  const diff = average !== undefined && row.games >= 10 ? rate - average : null;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="label-game w-6 shrink-0 text-center text-lg text-muted">{rank}</span>
      <BrawlerFace id={row.brawlerId} meta={meta} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={lp(brawlerPath(row.brawlerId, meta.get(row.brawlerId)?.name))} className="label-game truncate text-base hover:text-brand">
            {brawlerName(row.brawlerId, meta)}
          </Link>
          {diff !== null ? (
            <span className={`shrink-0 text-[11px] font-bold ${diff >= 0.03 ? 'text-victory' : diff <= -0.03 ? 'text-defeat' : 'text-muted'}`}>
              {diffLabel(diff, t)}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-brand/80" style={{ width: `${(row.games / max) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs font-bold tabular-nums">{`${row.wins}–${row.games - row.wins}`}</span>
        </div>
      </div>
      <div className="w-16 shrink-0 text-right">
        <p className={`display text-2xl leading-none ${rateTone(rate)}`}>{formatPercentWhole(rate)}</p>
        <p className="mt-1 text-[11px] text-muted">{t('{games} games', { games: row.games })}</p>
      </div>
    </li>
  );
}

export function Award({ label, art, children }: { label: string; art: ReactNode; children: ReactNode }) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <p className="label-game text-sm text-brand">{label}</p>
      <div className="flex items-center gap-3">
        {art}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function AwardValue({ main, sub }: { main: string; sub?: string | null }) {
  return (
    <>
      <p className="label-game line-clamp-2 break-words text-base leading-tight sm:text-lg">{main}</p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </>
  );
}

export function BigNumber({ value, tone }: { value: number; tone: string }) {
  return (
    <span className={`display text-game-stroke grid size-14 shrink-0 place-items-center rounded-xl border-2 border-ink bg-surface-3 text-3xl ${tone}`}>
      {value}
    </span>
  );
}

export function ModeArt({ url, small = false }: { url: string | null; small?: boolean }) {
  const size = small ? 28 : 56;
  return url ? (
    <Image src={url} alt="" width={size} height={size} unoptimized className="shrink-0 object-contain" style={{ width: size, height: size }} />
  ) : (
    <span className="shrink-0 rounded-xl bg-surface-3" style={{ width: size, height: size }} />
  );
}

export function MapArt({ map, small = false }: { map: GameMap | undefined; small?: boolean }) {
  const w = small ? 44 : 56;
  const h = small ? 44 : 56;
  return map?.map.imageUrl ? (
    <Image
      src={map.map.imageUrl}
      alt=""
      width={w}
      height={h}
      unoptimized
      className="shrink-0 rounded-lg border-2 border-ink bg-surface-3 object-cover"
      style={{ width: w, height: h }}
    />
  ) : (
    <span className="shrink-0 rounded-lg border-2 border-ink bg-surface-3" style={{ width: w, height: h }} />
  );
}

function PairList({
  title,
  aside,
  rows,
  meta,
  caption,
}: {
  title: string;
  aside: string;
  rows: BrawlerRecord[];
  meta: Map<number, BABrawler>;
  caption: (row: BrawlerRecord) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="card p-5 sm:p-6">
      <SeasonHeading title={title} aside={aside} />
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.brawlerId} className="flex items-center gap-3 rounded-xl bg-surface-2/40 p-2">
            <BrawlerFace id={r.brawlerId} meta={meta} size={40} />
            <div className="min-w-0 flex-1">
              <p className="label-game truncate text-base">{brawlerName(r.brawlerId, meta)}</p>
              <p className="text-xs text-muted">{caption(r)}</p>
            </div>
            <span className={`display text-2xl ${rateTone(winRate(r))}`}>{formatPercentWhole(winRate(r))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

