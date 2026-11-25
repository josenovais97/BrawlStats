/* eslint-disable @next/next/no-img-element -- Satori renders plain <img> into the PNG; next/image does not apply. */
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

import { brawlerIconUrl, playerIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getBattleLog, getPlayer } from '@/lib/bs-api';
import { appNames, localRank } from '@/lib/bubble-app-l10n';
import { MIN_COMBAT_GAMES, combatRates } from '@/lib/combat';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { RANK_ELO_FLOORS, rankProgress, winsToNext } from '@/lib/ranked-elo';
import { getSeasonPair } from '@/lib/ranked-seasons';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, loadIcon, loadLogo, slideFonts } from '@/lib/slide-chrome';
import { getPlayerCombat } from '@/lib/player-combat';
import { getPlayerPeakElo, getPlayerSeasonStats, getRankedEloRates } from '@/lib/stats';
import { translate } from '@/lib/t';
import { normalizeTag } from '@/lib/tags';
import type { BABrawler } from '@/types/brawlapi';

/**
 * Share cards for the Bubble app (1.40): a phone-story image (1080x1920) the
 * app shares in one tap to TikTok, Instagram or WhatsApp.
 *
 *   ?kind=rank&tag=…&lang=…     "My rank": badge, elo, progress, recent record
 *   ?kind=season&tag=…&lang=…   "Season N Wrapped": peak, games, win rate,
 *                                best brawler, elo gained, longest streak
 *   ?kind=versus&tag=…&lang=…   "Season N vs Season N-1" (1.42): peak, games,
 *                                win rate and best brawler side by side, from
 *                                what the app merged (/api/bubble/seasons plus
 *                                its own count): n g w pk b bid, and ln lg lw
 *                                lpk lb lbid for the last season
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
  const kind = q.get('kind') === 'season' ? 'season' : q.get('kind') === 'versus' ? 'versus' : 'rank';

  const [fonts, player, name, rates, pair, logo] = await Promise.all([
    slideFonts(),
    getPlayer(tag).catch(() => null),
    appNames(lang),
    getRankedEloRates().catch(() => ({})),
    getSeasonPair().catch(() => ({ now: null, last: null })),
    loadLogo(96),
  ]);
  // The running season, or the one before it with which=last (the site's
  // Ranked tab); the app names its own season in n, from and to.
  const span = q.get('which') === 'last' ? pair.last : pair.now;
  const running = !q.get('n') || int(q.get('n')) === pair.now?.number ? q.get('which') !== 'last' : false;
  if (!player) return new Response('not found', { status: 404 });

  const progress = rankProgress(player.rankedElo ?? null);
  const indexOf = (rank: string | undefined | null) =>
    rank ? RANK_ELO_FLOORS.findIndex(([n]) => n === rank.toUpperCase()) : -1;
  const rankIndex = indexOf(progress?.rank);
  const icon = await loadIcon(playerIconUrl(player.icon?.id), 150);
  const seasonNo = int(q.get('n')) ?? span?.number ?? null;

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
  } else if (kind === 'versus') {
    const art = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
    const side = (p: string) => {
      const games = Math.max(0, int(q.get(`${p}g`)) ?? 0);
      const wins = Math.min(games, Math.max(0, int(q.get(`${p}w`)) ?? 0));
      const peak = int(q.get(`${p}pk`)) ?? -1;
      const bestId = int(q.get(`${p}bid`));
      return {
        number: int(q.get(`${p}n`)),
        games,
        wins,
        peak: peak >= 0 && peak < RANK_ELO_FLOORS.length ? peak : -1,
        best: (q.get(`${p}b`) ?? '').slice(0, 24) || null,
        bestId: bestId !== null && art.has(bestId) ? bestId : null,
      };
    };
    const now = side('');
    const last = side('l');
    const [nowBadge, lastBadge, nowBest, lastBest] = await Promise.all([
      now.peak >= 0 ? loadIcon(rankedTierIconUrl(now.peak + 1) ?? '', 220) : Promise.resolve(null),
      last.peak >= 0 ? loadIcon(rankedTierIconUrl(last.peak + 1) ?? '', 220) : Promise.resolve(null),
      now.bestId !== null ? loadIcon(art.get(now.bestId)?.imageUrl ?? brawlerIconUrl(now.bestId), 160) : Promise.resolve(null),
      last.bestId !== null ? loadIcon(art.get(last.bestId)?.imageUrl ?? brawlerIconUrl(last.bestId), 160) : Promise.resolve(null),
    ]);
    const rankName = (i: number) => (i >= 0 ? localRank(rankProgress(RANK_ELO_FLOORS[i][1])?.rank, name) : null);
    const verdict =
      now.peak < 0 || last.peak < 0
        ? null
        : now.peak > last.peak
          ? t('New best: above last season!')
          : now.peak === last.peak
            ? t('Level with last season')
            : t('Reach {rank} to beat last season', { rank: rankName(last.peak + 1) ?? rankName(last.peak) ?? '' });
    const column = (
      x: ReturnType<typeof side>,
      badge: string | null,
      best: string | null,
      lit: boolean,
    ) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 440,
          padding: '30px 20px 34px',
          gap: 14,
          borderRadius: 40,
          background: lit ? 'rgba(255,197,61,0.12)' : 'rgba(255,255,255,0.06)',
          border: `4px solid ${lit ? 'rgba(255,197,61,0.6)' : 'rgba(255,255,255,0.12)'}`,
        }}
      >
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 58, color: lit ? BRAND : FG }}>
          {x.number ? t('SEASON {n}', { n: x.number }) : '–'}
        </div>
        {badge ? <img alt="" src={badge} width={220} height={220} /> : <div style={{ display: 'flex', width: 220, height: 220 }} />}
        <div style={{ display: 'flex', fontSize: 30, color: DIM }}>{t('Peak')}</div>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 54, color: FG, lineHeight: 1 }}>{rankName(x.peak) ?? '–'}</div>
        <div style={{ display: 'flex', width: 360, height: 3, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 76, color: FG, lineHeight: 1 }}>{x.games.toLocaleString(locale)}</div>
        <div style={{ display: 'flex', fontSize: 30, color: DIM }}>{t('Ranked games')}</div>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 76, color: FG, lineHeight: 1, marginTop: 8 }}>
          {x.games > 0 ? `${Math.round((x.wins / x.games) * 100)}%` : '–'}
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: DIM }}>{t('Win rate')}</div>
        {best || x.best ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            {best ? <img alt="" src={best} width={84} height={84} style={{ borderRadius: 20, border: `4px solid ${BRAND}` }} /> : null}
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 40, color: FG }}>{x.best ?? ''}</div>
          </div>
        ) : null}
      </div>
    );
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, marginTop: 40, width: '100%' }}>
        <div style={{ display: 'flex', marginTop: 10 }}>{who}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 20 }}>
          {column(last, lastBadge, lastBest, false)}
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 84, color: BRAND, margin: '0 -10px', zIndex: 2 }}>VS</div>
          {column(now, nowBadge, nowBest, true)}
        </div>
        {verdict ? <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 56, color: BRAND, textAlign: 'center', marginTop: 10 }}>{verdict}</div> : null}
      </div>
    );
  } else {
    const from = q.get('from') ?? span?.from ?? null;
    const to = q.get('to') ?? span?.to ?? null;
    const dated = from && to && DATE.test(from) && DATE.test(to) ? { from, to } : null;
    const db = dated ? await getPlayerSeasonStats(tag, dated.from, dated.to) : null;
    // Kills and deaths (2026-11-25), for players the sampler follows.
    const fought = dated ? await getPlayerCombat(tag, dated.from, dated.to) : null;
    const combat = fought && fought.games >= MIN_COMBAT_GAMES ? combatRates(fought) : null;
    const appGames = int(q.get('g'));
    const appWins = int(q.get('w'));
    const useDb = db !== null && db.games >= (appGames ?? 0);
    const games = useDb ? db.games : (appGames ?? 0);
    const wins = useDb ? db.wins : (appWins ?? 0);
    const art = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());

    /*
     * The top three by wins. From the database for sampled players; otherwise
     * what the app counted (`top`: [[name, games, wins], ...] in the app's
     * language), matched back to a brawler by its localized name for the art.
     */
    const byLocalName = new Map([...art.entries()].map(([id, b]) => [name(b.name).toLowerCase(), id] as const));
    type TopRow = { id: number | null; label: string; games: number; wins: number };
    let top: TopRow[] = [];
    if (useDb) {
      top = db.byBrawler.slice(0, 3).map((r) => ({ id: r.brawlerId, label: name(art.get(r.brawlerId)?.name ?? ''), games: r.games, wins: r.wins }));
    } else {
      try {
        const raw = JSON.parse(q.get('top') ?? '[]') as unknown;
        if (Array.isArray(raw)) {
          top = raw
            .filter((r): r is [string, number, number] => Array.isArray(r) && typeof r[0] === 'string' && Number.isFinite(r[1]) && Number.isFinite(r[2]))
            .map(([label, g, w]) => ({ id: byLocalName.get(label.toLowerCase()) ?? null, label: label.slice(0, 24), games: Math.max(0, Math.round(g)), wins: Math.max(0, Math.round(w)) }))
            .filter((r) => r.games > 0)
            .sort((a, b) => b.wins - a.wins || b.games - a.games)
            .slice(0, 3);
        }
      } catch {
        top = [];
      }
      const best = q.get('best');
      if (top.length === 0 && best) top = [{ id: byLocalName.get(best.toLowerCase()) ?? null, label: best.slice(0, 24), games: 0, wins: 0 }];
    }
    const topIcons = await Promise.all(
      top.map((r) => (r.id !== null ? loadIcon(art.get(r.id)?.imageUrl ?? brawlerIconUrl(r.id), 200) : Promise.resolve(null))),
    );

    // The game's "highest this season" and today's rank are the running season's:
    // a season that is over has only what we read during it, or the app's own.
    const readPeak = !running && dated ? await getPlayerPeakElo(tag, dated.from, dated.to) : null;
    const peakIndex = running
      ? Math.max(indexOf(player.highestSeasonRankedRankName ?? null), int(q.get('peak')) ?? -1, rankIndex)
      : Math.max(readPeak !== null ? indexOf(rankProgress(readPeak)?.rank) : -1, int(q.get('peak')) ?? -1);
    const peakName = peakIndex >= 0 ? localRank(rankProgress(RANK_ELO_FLOORS[peakIndex][1])?.rank, name) : null;
    const peakBadge = peakIndex >= 0 ? await loadIcon(rankedTierIconUrl(peakIndex + 1) ?? '', 200) : null;
    const gain = int(q.get('gain'));
    const streak = int(q.get('streak'));
    const tile = (value: string, label: string) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: combat ? 286 : 420,
          height: combat ? 150 : 168,
          padding: '0 18px',
          borderRadius: 32,
          background: 'rgba(255,255,255,0.07)',
          border: '3px solid rgba(255,255,255,0.12)',
        }}
      >
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: combat ? 64 : 80, color: FG, lineHeight: 1.05 }}>{value}</div>
        <div style={{ display: 'flex', fontSize: combat ? 26 : 30, color: DIM, textAlign: 'center', justifyContent: 'center' }}>{label}</div>
      </div>
    );
    const winsText = (n: number) => t(n === 1 ? '{n} win' : '{n} wins', { n: n.toLocaleString(locale) });
    const lossText = (n: number) => t(n === 1 ? '{n} loss' : '{n} losses', { n: n.toLocaleString(locale) });
    const medal = ['#FFC53D', '#D7DEEE', '#E59A5C'];

    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, marginTop: 26, width: '100%' }}>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 92, color: BRAND, lineHeight: 1 }}>
          {seasonNo ? t('SEASON {n}', { n: seasonNo }) : t('MY SEASON')}
        </div>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 92, color: FG, lineHeight: 1 }}>{running ? t('SO FAR') : t('WRAPPED')}</div>

        {/* Who, and the best rank of the season, in one row. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 8 }}>
          {icon ? <img alt="" src={icon} width={116} height={116} style={{ borderRadius: 26, border: `5px solid ${BRAND}` }} /> : null}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 64, color: FG, lineHeight: 1.05 }}>{player.name}</div>
            {peakName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                {peakBadge ? <img alt="" src={peakBadge} width={64} height={64} /> : null}
                <div style={{ display: 'flex', fontSize: 36, color: DIM }}>{t('Peak')}</div>
                <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 44, color: FG }}>{peakName}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 22, width: 900, marginTop: 6 }}>
          {tile(games.toLocaleString(locale), t('Ranked games'))}
          {tile(games > 0 ? `${Math.round((wins / games) * 100)}%` : '–', t('Win rate'))}
          {/* Elo gained is only known when the app counted from the season's start; otherwise today's elo. */}
          {gain !== null
            ? tile(`${gain > 0 ? '+' : gain < 0 ? '−' : '±'}${Math.abs(gain).toLocaleString(locale)}`, t('Elo this season'))
            : running && player.rankedElo
              ? tile(player.rankedElo.toLocaleString(locale), 'Elo')
              : null}
          {streak !== null && streak > 0 ? tile(String(streak), t('Longest win streak')) : null}
          {!running && gain === null && games > 0 ? tile(wins.toLocaleString(locale), t('Wins')) : null}
          {!running && gain === null && games > 0 ? tile((games - wins).toLocaleString(locale), t('Losses')) : null}
          {combat ? tile(combat.kd.toFixed(2), t('K/D')) : null}
          {combat ? tile(combat.deaths.toFixed(2), t('Deaths a game')) : null}
          {combat && (streak === null || streak <= 0) ? tile(Math.round(combat.damage).toLocaleString(locale), t('Damage a second')) : null}
        </div>

        {/* The season's top three brawlers, spelled out: wins, losses, win rate. */}
        {top.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: 900, gap: 14, marginTop: 8 }}>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: DIM, letterSpacing: 2 }}>{t('Top brawlers').toUpperCase()}</div>
            {top.map((r, i) => (
              <div
                key={`${r.label}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '12px 22px 12px 14px',
                  borderRadius: 28,
                  background: i === 0 ? 'rgba(255,197,61,0.13)' : 'rgba(255,255,255,0.06)',
                  border: `3px solid ${i === 0 ? 'rgba(255,197,61,0.55)' : 'rgba(255,255,255,0.10)'}`,
                }}
              >
                <div style={{ display: 'flex', width: 44, justifyContent: 'center', fontFamily: DISPLAY, fontSize: 52, color: medal[i] }}>{i + 1}</div>
                {topIcons[i] ? (
                  <img alt="" src={topIcons[i]!} width={100} height={100} style={{ borderRadius: 22, border: `4px solid ${medal[i]}` }} />
                ) : (
                  <div style={{ display: 'flex', width: 100, height: 100, borderRadius: 22, background: 'rgba(255,255,255,0.08)' }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, color: FG, lineHeight: 1.05 }}>{r.label}</div>
                  {r.games > 0 ? (
                    <div style={{ display: 'flex', fontSize: 32, color: DIM, marginTop: 2 }}>
                      {`${winsText(r.wins)} · ${lossText(r.games - r.wins)}`}
                    </div>
                  ) : null}
                </div>
                {r.games > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 58, color: BRAND, lineHeight: 1 }}>
                      {`${Math.round((r.wins / r.games) * 100)}%`}
                    </div>
                    <div style={{ display: 'flex', fontSize: 26, color: DIM }}>{t('Win rate')}</div>
                  </div>
                ) : null}
              </div>
            ))}
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
          padding: '80px 70px 260px 70px',
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
