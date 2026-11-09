/* eslint-disable @next/next/no-img-element -- Satori renders plain <img> into the PNG; next/image does not apply. */
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

import { brawlerIconUrl, playerIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getBattleLog, getPlayer } from '@/lib/bs-api';
import { appNames, localRank } from '@/lib/bubble-app-l10n';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { RANK_ELO_FLOORS, rankProgress, winsToNext } from '@/lib/ranked-elo';
import { getSeasonState } from '@/lib/ranked-seasons';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, loadIcon, loadLogo, slideFonts } from '@/lib/slide-chrome';
import { getPlayerSeasonStats, getRankedEloRates } from '@/lib/stats';
import { translate } from '@/lib/t';
import { normalizeTag } from '@/lib/tags';

/**
 * Share cards for the Bubble app (1.40): a phone-story image (1080x1920) the
 * app shares in one tap to TikTok, Instagram or WhatsApp.
 *
 *   ?kind=rank&tag=…&lang=…     "My rank": badge, elo, progress, recent record
 *   ?kind=season&tag=…&lang=…   "Season N Wrapped": peak, games, win rate,
 *                                best brawler, elo gained, longest streak
 *
 * Season numbers come from player_battle_daily for sampled players; the app
 * sends what it counted itself (g, w, best, streak, gain, peak) for everyone
 * else and for what the database cannot know. The texts follow the site's
 * seven languages; names follow the app's language.
 */

export const dynamic = 'force-dynamic';

const W = 1080;
const H = 1920;
const RANKED = new Set(['soloRanked', 'teamRanked']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function int(v: string | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const tag = normalizeTag(q.get('tag'));
  if (!tag) return new Response('no tag', { status: 400 });
  const lang = q.get('lang') ?? 'en';
  const base = lang.split('-')[0];
  const locale: Locale = isIntlLocale(base) ? base : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);
  const kind = q.get('kind') === 'season' ? 'season' : 'rank';

  const [fonts, player, name, rates, season, logo] = await Promise.all([
    slideFonts(),
    getPlayer(tag).catch(() => null),
    appNames(lang),
    getRankedEloRates().catch(() => ({})),
    getSeasonState().catch(() => null),
    loadLogo(96),
  ]);
  if (!player) return new Response('not found', { status: 404 });

  const progress = rankProgress(player.rankedElo ?? null);
  const indexOf = (rank: string | undefined | null) =>
    rank ? RANK_ELO_FLOORS.findIndex(([n]) => n === rank.toUpperCase()) : -1;
  const rankIndex = indexOf(progress?.rank);
  const icon = await loadIcon(playerIconUrl(player.icon?.id), 150);
  const seasonNo = int(q.get('n')) ?? season?.current?.number ?? null;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      {logo ? <img alt="" src={logo} width={96} height={96} style={{ borderRadius: 24 }} /> : null}
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, letterSpacing: 2, color: FG }}>BRAWLZONE</div>
    </div>
  );
  const who = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
      {icon ? <img alt="" src={icon} width={130} height={130} style={{ borderRadius: 28, border: `5px solid ${BRAND}` }} /> : null}
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 76, color: FG }}>{player.name}</div>
    </div>
  );
  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 50, color: BRAND }}>{t('Track yours with BrawlZone Bubble')}</div>
      <div style={{ display: 'flex', fontSize: 36, color: DIM }}>{t('Free on Google Play · brawlzone.net')}</div>
    </div>
  );

  let body;
  if (kind === 'rank') {
    const log = await getBattleLog(tag).then((r) => r.items).catch(() => []);
    const games = log.filter((e) => RANKED.has(e.battle.type ?? '') && (e.battle.result === 'victory' || e.battle.result === 'defeat'));
    const wins = games.filter((e) => e.battle.result === 'victory').length;
    const badge = rankIndex >= 0 ? await loadIcon(rankedTierIconUrl(rankIndex + 1) ?? '', 460) : null;
    const toGo = winsToNext(progress, rates);
    const nextLine = !progress?.next
      ? t('Top rank reached')
      : toGo !== null && toGo >= 2
        ? t('≈{n} wins to {rank}', { n: toGo, rank: localRank(progress.next, name) ?? '' })
        : progress.toNext !== null
          ? t('{n} elo to {rank}', { n: progress.toNext.toLocaleString(locale), rank: localRank(progress.next, name) ?? '' })
          : '';
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, marginTop: 50, width: '100%' }}>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 96, color: BRAND }}>{t('MY RANK')}</div>
        {seasonNo ? <div style={{ display: 'flex', fontSize: 40, color: DIM }}>{t('Ranked · Season {n}', { n: seasonNo })}</div> : null}
        <div style={{ display: 'flex', marginTop: 20 }}>{who}</div>
        {badge ? <img alt="" src={badge} width={460} height={460} /> : <div style={{ display: 'flex', height: 120 }} />}
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 124, color: FG }}>{localRank(progress?.rank, name) ?? t('Unranked')}</div>
        {player.rankedElo ? (
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 60, color: BRAND }}>{`${player.rankedElo.toLocaleString(locale)} elo`}</div>
        ) : null}
        {progress?.next ? (
          <div style={{ display: 'flex', width: 820, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.12)' }}>
            <div style={{ display: 'flex', width: Math.max(36, Math.round(820 * progress.share)), height: 36, borderRadius: 18, background: BRAND }} />
          </div>
        ) : null}
        <div style={{ display: 'flex', fontSize: 46, color: FG }}>{nextLine}</div>
        {games.length > 0 ? (
          <div style={{ display: 'flex', fontSize: 42, color: DIM }}>
            {t('Last {n}: {w}–{l}', { n: games.length, w: wins, l: games.length - wins })}
          </div>
        ) : null}
      </div>
    );
  } else {
    const from = q.get('from') ?? season?.current?.startsOn ?? null;
    const to = q.get('to') ?? season?.current?.endsOn ?? null;
    const db = from && to && DATE.test(from) && DATE.test(to) ? await getPlayerSeasonStats(tag, from, to) : null;
    const appGames = int(q.get('g'));
    const appWins = int(q.get('w'));
    const useDb = db !== null && db.games >= (appGames ?? 0);
    const games = useDb ? db.games : (appGames ?? 0);
    const wins = useDb ? db.wins : (appWins ?? 0);
    const art = await getBrawlerArtMap().catch(() => new Map());
    const bestRow = useDb ? db.byBrawler[0] : null;
    const bestName = bestRow ? name(art.get(bestRow.brawlerId)?.name ?? '') : q.get('best');
    const bestIcon = bestRow ? await loadIcon(art.get(bestRow.brawlerId)?.imageUrl ?? brawlerIconUrl(bestRow.brawlerId), 220) : null;
    const peakIndex = Math.max(indexOf(player.highestSeasonRankedRankName ?? null), int(q.get('peak')) ?? -1, rankIndex);
    const peakName = peakIndex >= 0 ? localRank(rankProgress(RANK_ELO_FLOORS[peakIndex][1])?.rank, name) : null;
    const peakBadge = peakIndex >= 0 ? await loadIcon(rankedTierIconUrl(peakIndex + 1) ?? '', 300) : null;
    const gain = int(q.get('gain'));
    const streak = int(q.get('streak'));
    const tile = (value: string, label: string) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: 420,
          height: 196,
          padding: '0 18px',
          borderRadius: 36,
          background: 'rgba(255,255,255,0.07)',
          border: '3px solid rgba(255,255,255,0.12)',
        }}
      >
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 88, color: FG }}>{value}</div>
        <div style={{ display: 'flex', fontSize: 32, color: DIM, textAlign: 'center', justifyContent: 'center' }}>{label}</div>
      </div>
    );
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, marginTop: 30, width: '100%' }}>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 100, color: BRAND, lineHeight: 1 }}>
          {seasonNo ? t('SEASON {n}', { n: seasonNo }) : t('MY SEASON')}
        </div>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 100, color: FG, lineHeight: 1 }}>{t('WRAPPED')}</div>
        <div style={{ display: 'flex', marginTop: 10 }}>{who}</div>
        {peakName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            {peakBadge ? <img alt="" src={peakBadge} width={200} height={200} /> : null}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 40, color: DIM }}>{t('Peak')}</div>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 92, color: FG }}>{peakName}</div>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, width: 900 }}>
          {tile(games.toLocaleString(locale), t('Ranked games'))}
          {tile(games > 0 ? `${Math.round((wins / games) * 100)}%` : '–', t('Win rate'))}
          {/* Elo gained is only known when the app counted from the season's start; otherwise today's elo. */}
          {gain !== null
            ? tile(`${gain > 0 ? '+' : gain < 0 ? '−' : '±'}${Math.abs(gain).toLocaleString(locale)}`, t('Elo this season'))
            : player.rankedElo
              ? tile(player.rankedElo.toLocaleString(locale), 'Elo')
              : null}
          {streak !== null && streak > 0 ? tile(String(streak), t('Longest win streak')) : null}
        </div>
        {bestName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 8 }}>
            {bestIcon ? <img alt="" src={bestIcon} width={150} height={150} style={{ borderRadius: 32, border: `5px solid ${BRAND}` }} /> : null}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 40, color: DIM }}>{t('Best brawler')}</div>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 80, color: FG }}>{bestName}</div>
              {bestRow ? (
                <div style={{ display: 'flex', fontSize: 38, color: BRAND }}>
                  {`${bestRow.wins}–${bestRow.games - bestRow.wins}  ·  ${Math.round((bestRow.wins / bestRow.games) * 100)}%`}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '90px 70px 300px 70px',
          background: BG,
          color: FG,
          fontFamily: BODY,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: H,
            background: 'linear-gradient(165deg, rgba(255,197,61,0.26), rgba(11,15,29,0) 42%, rgba(53,208,255,0.12) 100%)',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: 12, background: BRAND }} />
        {header}
        {body}
        {footer}
      </div>
    ),
    { width: W, height: H, fonts },
  );
  return new Response(await png.arrayBuffer(), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3000' },
  });
}
