import Image from 'next/image';
import { cache } from 'react';
import Link from 'next/link';

import { TrophyIcon } from '@/components/game-icons';
import { activityFor } from '@/components/player/player-activity';
import { Award, AwardValue, BigNumber, MapArt, ModeArt, Tile } from '@/components/player/player-season';
import { brawlerName, BrawlerFace, rateTone, SeasonHeading, WinLossBar } from '@/components/player/season/shared';
import { SeasonCalendar } from '@/components/player/season/season-calendar';
import { SeasonHours } from '@/components/player/season/season-hours';
import { getBattleLog } from '@/lib/bs-api';
import { formatNumber, formatPercentWhole } from '@/lib/format';
import { getActiveMaps, type GameMap } from '@/lib/game-maps';
import { DATE_LOCALE, localePath } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { summarizeActivity } from '@/lib/player-activity';
import { todayUtc } from '@/lib/ranked-season';
import { brawlerPath } from '@/lib/slugs';
import { getPlayerTrophyGames, mapNameKey } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import { avgPlace, bestBy, mergeTrophyGames, trophyBreakdown, trophyDays, trophyGamesFromLog } from '@/lib/trophy-games';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSPlayer } from '@/types/brawlstars';

const DAYS = 30;

/** One read per request, shared with the Overview's playstyle panel. */
export const trophyGamesFor = cache((tag: string) => getPlayerTrophyGames(tag));

/** "+12" / "−5" / "±0". */
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n))}`;
const netTone = (n: number) => (n > 0 ? 'text-victory' : n < 0 ? 'text-defeat' : 'text-muted');

/**
 * The profile's Trophies tab (2026-11-11): the trophy ladder's version of
 * the Ranked tab, for the players who push trophies. Counts and win rates
 * over 30 days from the per-day table; trophies won and lost, modes, maps,
 * Showdown places, streaks and hours from the single games (raw, about two
 * weeks, plus the battle log). Accounts the sampler has not met get the log.
 */
export async function PlayerTrophies({
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
  const lp = (path: string) => localePath(locale, path);
  const dateLocale = DATE_LOCALE[locale];
  const fmtDay = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  const rows = (await activityFor(tag)) ?? [];
  const stored = (await trophyGamesFor(tag)) ?? [];
  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => []);
  const games = mergeTrophyGames(stored, trophyGamesFromLog(log, player.tag));
  const detail = trophyBreakdown(games);

  const to = todayUtc();
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const month = summarizeActivity(rows, from, to);
  const hasMonth = month.trophy.battles > 0;
  const days = trophyDays(rows);

  if (!hasMonth && detail.games === 0) {
    return (
      <section className="card p-8 text-center">
        <TrophyIcon className="mx-auto size-10 opacity-60" />
        <p className="label-game mt-3 text-xl">{t('No trophy games in the last 30 days')}</p>
      </section>
    );
  }

  const [words, maps] = await Promise.all([gameWords(locale), getActiveMaps().catch(() => [] as GameMap[])]);
  const mapByKey = new Map(maps.map((m) => [mapNameKey(m.map.name), m]));
  const modeIcon = (mode: string) => modeMeta.get(mode.toLowerCase())?.imageUrl ?? null;
  const modeColor = (mode: string) => modeMeta.get(mode.toLowerCase())?.color ?? 'var(--brand)';
  const detailDays = detail.since ? Math.max(1, Math.ceil((Date.parse(`${to}T23:59:59Z`) - detail.since) / 86_400_000)) : 0;
  const lastDays = detailDays ? t('Last {n} days', { n: detailDays }) : undefined;

  // The month's counts where the sampler has them, else the single games.
  const totalGames = hasMonth ? month.trophy.battles : detail.games;
  const wins = hasMonth ? month.trophy.wins : detail.wins;
  const decided = hasMonth ? month.trophy.decided : detail.decided;
  const netBy = new Map(detail.brawlers.map((b) => [b.brawlerId, b.net]));
  const placeBy = new Map(detail.brawlers.map((b) => [b.brawlerId, avgPlace(b)]));
  const owned = new Map(player.brawlers.map((b) => [b.id, b]));
  const list = hasMonth
    ? month.brawlers
        .filter((b) => b.trophy.battles > 0)
        .map((b) => ({ brawlerId: b.brawlerId, games: b.trophy.battles, wins: b.trophy.wins, decided: b.trophy.decided }))
        .sort((a, b) => b.games - a.games)
    : detail.brawlers.map((b) => ({ brawlerId: b.brawlerId, games: b.games, wins: b.wins, decided: b.decided }));
  const top = list.slice(0, 10);
  const mostGames = Math.max(1, top[0]?.games ?? 1);

  const climber = bestBy(detail.brawlers, 3, (b) => b.net);
  const bestRate = bestBy(list, 10, (b) => (b.decided >= 10 ? b.wins / b.decided : null));
  const bestMode = bestBy(detail.modes, 5, (m) => m.net);
  const bestMap = bestBy(detail.maps, 4, (m) => m.net);
  const showdown = detail.modes.filter((m) => m.places.length > 0);
  const sdGames = showdown.reduce((n, m) => n + m.places.length, 0);
  const sdAvg = sdGames ? showdown.reduce((n, m) => n + m.places.reduce((a, b) => a + b, 0), 0) / sdGames : null;
  const bestDay = detail.days.length ? [...detail.days].sort((a, b) => b.net - a.net)[0] : null;
  const current = detail.current;

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ hero */}
      <section className="card card-glow relative isolate overflow-hidden p-5 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 80% at 0% 0%, rgb(255 197 61 / 0.24), transparent 60%), radial-gradient(50% 70% at 100% 100%, rgb(53 208 127 / 0.14), transparent 60%)',
          }}
        />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-muted">
              <TrophyIcon className="size-4" />
              {t('Trophy road')}
            </p>
            <h2 className="display text-game-stroke mt-3 text-5xl leading-[0.95] sm:text-6xl">
              {t('TROPHIES')}
              <br />
              <span className="text-brand">{t('LAST 30 DAYS')}</span>
            </h2>
            {!hasMonth ? (
              <p className="mt-3 max-w-xl text-sm text-muted">{t('Season totals show up here within a few hours.')}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border-2 border-ink bg-surface-2/70 px-4 py-3 shadow-[0_3px_0_var(--ink)]">
            <TrophyIcon className="size-12" />
            <div>
              <p className="display text-3xl leading-none text-brand tabular-nums">{formatNumber(player.trophies)}</p>
              <p className="mt-1 text-xs text-muted">{t('Best {n}', { n: formatNumber(player.highestTrophies) })}</p>
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label={t('Trophy games')} value={formatNumber(totalGames)} />
          <Tile label={t('Win rate')} value={decided >= 5 ? formatPercentWhole(wins / decided) : '–'} tone="text-brand">
            {decided > 0 ? <WinLossBar wins={wins} games={decided} className="mt-2 h-1.5" /> : null}
          </Tile>
          <Tile label={t('Net trophies')} value={signed(detail.net)} tone={netTone(detail.net)} hint={lastDays} />
          <Tile label={t('Trophies won')} value={`+${formatNumber(detail.won)}`} tone="text-victory" hint={lastDays} />
          <Tile label={t('Trophies lost')} value={`−${formatNumber(detail.lost)}`} tone="text-defeat" hint={lastDays} />
          <Tile label={t('Longest win streak')} value={formatNumber(detail.longestWin)} hint={lastDays} />
        </div>

        {/* The latest trophy games, newest first, with what each one paid. */}
        {games.length > 0 ? (
          <div className="mt-6">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="label-game text-sm text-muted">{t('Recent form')}</p>
              {current >= 3 ? (
                <span className="rounded-full bg-victory/15 px-2 py-0.5 text-xs font-bold text-victory">{t('{n} wins in a row', { n: current })}</span>
              ) : null}
            </div>
            <ol className="flex gap-1.5 overflow-x-auto pb-1">
              {games.slice(0, 15).map((g) => {
                const delta = g.trophyChange ?? 0;
                return (
                  <li key={g.time} className="shrink-0" title={`${words.mode(g.mode)}${g.map ? ` · ${words.map(g.map)}` : ''}`}>
                    <div className={`overflow-hidden rounded-xl border-2 border-ink ${delta > 0 ? 'bg-victory' : delta < 0 ? 'bg-defeat' : 'bg-surface-3'}`}>
                      <BrawlerFace id={g.brawlerId} meta={brawlerMeta} size={40} bare />
                      <p className="text-center text-[11px] font-black leading-4 text-ink tabular-nums">{signed(delta)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </section>

      {/* -------------------------------------------------------- top 10 */}
      {top.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <SeasonHeading title={t('Top 10 brawlers')} aside={hasMonth ? t('Most played on the trophy road, last 30 days') : null} />
          <ol className="divide-y divide-border/60">
            {top.map((b, i) => {
              const rate = b.decided >= 5 ? b.wins / b.decided : null;
              const net = netBy.get(b.brawlerId);
              const now = owned.get(b.brawlerId);
              return (
                <li key={b.brawlerId} className="flex items-center gap-3 py-2.5">
                  <span className="label-game w-6 shrink-0 text-center text-lg text-muted">{i + 1}</span>
                  <BrawlerFace id={b.brawlerId} meta={brawlerMeta} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={lp(brawlerPath(b.brawlerId, brawlerMeta.get(b.brawlerId)?.name))} className="label-game truncate text-base hover:text-brand">
                        {brawlerName(b.brawlerId, brawlerMeta)}
                      </Link>
                      {now ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-brand tabular-nums">
                          <TrophyIcon className="size-3" />
                          {formatNumber(now.trophies)}
                        </span>
                      ) : null}
                      {net !== undefined && net !== 0 ? (
                        <span className={`text-[11px] font-bold tabular-nums ${netTone(net)}`} title={lastDays}>
                          {signed(net)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-brand/80" style={{ width: `${(b.games / mostGames) * 100}%` }} />
                      </div>
                      <span className="shrink-0 text-xs font-bold tabular-nums">{b.decided > 0 ? `${b.wins}–${b.decided - b.wins}` : ''}</span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    {/* Showdown has places, not wins: its brawlers show the average place. */}
                    {rate !== null ? (
                      <p className={`display text-2xl leading-none ${rateTone(rate)}`}>{formatPercentWhole(rate)}</p>
                    ) : placeBy.get(b.brawlerId) != null ? (
                      <p className="display text-2xl leading-none text-brand" title={t('Avg place {v}', { v: placeBy.get(b.brawlerId)!.toFixed(1) })}>
                        #{placeBy.get(b.brawlerId)!.toFixed(1)}
                      </p>
                    ) : (
                      <p className="display text-2xl leading-none text-muted">–</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted">{t('{games} games', { games: b.games })}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* -------------------------------------------------------- awards */}
      <section>
        <SeasonHeading title={t('Awards')} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {climber && climber.net > 0 ? (
            <Award label={t('Biggest climb')} art={<BrawlerFace id={climber.brawlerId} meta={brawlerMeta} size={56} />}>
              <AwardValue main={brawlerName(climber.brawlerId, brawlerMeta)} sub={t('{n} trophies', { n: signed(climber.net) })} />
            </Award>
          ) : null}
          {top[0] ? (
            <Award label={t('Most played')} art={<BrawlerFace id={top[0].brawlerId} meta={brawlerMeta} size={56} />}>
              <AwardValue main={brawlerName(top[0].brawlerId, brawlerMeta)} sub={t('{games} games', { games: top[0].games })} />
            </Award>
          ) : null}
          {bestRate ? (
            <Award label={t('Best brawler')} art={<BrawlerFace id={bestRate.brawlerId} meta={brawlerMeta} size={56} />}>
              <AwardValue main={brawlerName(bestRate.brawlerId, brawlerMeta)} sub={t('{rate} won · {games} games', { rate: formatPercentWhole(bestRate.wins / bestRate.decided), games: bestRate.games })} />
            </Award>
          ) : null}
          {bestMode && bestMode.net > 0 ? (
            <Award label={t('Best mode')} art={<ModeArt url={modeIcon(bestMode.key)} />}>
              <AwardValue main={words.mode(bestMode.key)} sub={t('{n} trophies', { n: signed(bestMode.net) })} />
            </Award>
          ) : null}
          {bestMap && bestMap.net > 0 ? (
            <Award label={t('Best map')} art={<MapArt map={mapByKey.get(mapNameKey(bestMap.key))} />}>
              <AwardValue main={words.map(bestMap.key)} sub={t('{n} trophies', { n: signed(bestMap.net) })} />
            </Award>
          ) : null}
          {bestDay && bestDay.net > 0 ? (
            <Award label={t('Best day')} art={<BigNumber value={Number(bestDay.day.slice(8))} tone="text-brand" />}>
              <AwardValue main={fmtDay(bestDay.day)} sub={t('{n} trophies', { n: signed(bestDay.net) })} />
            </Award>
          ) : null}
          {detail.longestWin >= 2 ? (
            <Award label={t('Longest win streak')} art={<BigNumber value={detail.longestWin} tone="text-victory" />}>
              <AwardValue main={t('{n} wins in a row', { n: detail.longestWin })} sub={lastDays} />
            </Award>
          ) : null}
          {sdAvg !== null && sdGames >= 5 ? (
            <Award label={t('Showdown')} art={<BigNumber value={Math.round(sdAvg * 10) / 10} tone="text-brand" />}>
              <AwardValue main={t('Avg place {v}', { v: sdAvg.toFixed(1) })} sub={t('{games} games', { games: sdGames })} />
            </Award>
          ) : null}
        </div>
      </section>

      {/* Coloured by wins and losses, so only when most games have them:
          a Showdown player's month would read as empty. */}
      {hasMonth && month.trophy.decided * 2 >= month.trophy.battles ? (
        <SeasonCalendar days={days.map((d) => ({ day: d.day, games: d.decided, wins: d.wins }))} from={from} last={to} title={t('Last 30 days')} />
      ) : null}

      {/* ------------------------------------------------- modes and maps */}
      {detail.modes.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <SeasonHeading title={t('Modes')} aside={lastDays} />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {detail.modes.map((m) => {
              const place = avgPlace(m);
              return (
                <li
                  key={m.key}
                  className="rounded-2xl border-2 border-ink bg-surface-2/60 p-3 shadow-[inset_0_2px_0_rgb(255_255_255/0.08)] sm:p-4"
                  style={{ borderTopColor: modeColor(m.key), borderTopWidth: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <ModeArt url={modeIcon(m.key)} small />
                    <p className="label-game min-w-0 truncate text-sm sm:text-base">{words.mode(m.key)}</p>
                  </div>
                  <p className={`display mt-2 text-3xl leading-none tabular-nums ${netTone(m.net)}`}>{signed(m.net)}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    {place !== null
                      ? t('Avg place {v}', { v: place.toFixed(1) })
                      : m.decided > 0
                        ? `${m.wins}–${m.decided - m.wins}`
                        : ''}{' '}
                    · {t('{games} games', { games: m.games })}
                  </p>
                </li>
              );
            })}
          </ul>

          {detail.maps.length > 0 ? (
            <>
              <p className="label-game mb-2 mt-6 text-base">{t('Maps')}</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {detail.maps.slice(0, 12).map((m) => {
                  const art = mapByKey.get(mapNameKey(m.key));
                  return (
                    <li key={`${m.mode}-${m.key}`} className="flex items-center gap-3 rounded-xl bg-surface-2/40 p-2">
                      <MapArt map={art} small />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                          {modeIcon(m.mode) ? <Image src={modeIcon(m.mode)!} alt="" width={16} height={16} unoptimized className="size-4 shrink-0" /> : null}
                          <span className="truncate">{words.map(m.key)}</span>
                        </p>
                        <p className="text-xs text-muted">{t('{games} games', { games: m.games })}</p>
                      </div>
                      <span className={`label-game shrink-0 text-lg tabular-nums ${netTone(m.net)}`}>{signed(m.net)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {games.length >= 10 ? (
        <SeasonHours
          games={games.map((g): [number, 0 | 1] => [Math.round(g.time / 1000), (g.trophyChange ?? 0) > 0 ? 1 : 0])}
          dateLocale={dateLocale}
          percentStyle={locale === 'tr' ? 'pre' : locale === 'fr' ? 'space' : 'post'}
          labels={{
            title: t('When you play'),
            aside: t('Last {n} trophy games, your time', { n: games.length }),
            busiest: t('Most games: {hour}'),
            best: t('Best hour: {hour} ({rate} won)'),
            cell: t('{games} games, {rate} won'),
            weekdays: t('Win rate by day'),
          }}
        />
      ) : null}
    </div>
  );
}
