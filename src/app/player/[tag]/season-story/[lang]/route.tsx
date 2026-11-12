import { ImageResponse } from 'next/og';

import { seasonFor } from '@/components/player/player-season';
import { brawlerIconUrl, playerIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { getOfficialBrawlers, getPlayer } from '@/lib/bs-api';
import { nameColorToCss, titleCaseLabel } from '@/lib/format';
import { NUMBER_LOCALE, isIntlLocale, type Locale } from '@/lib/i18n';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, MUTED, SLIDE_SIZE, loadIcon, slideFonts } from '@/lib/slide-chrome';
import { displayTag, normalizeTag } from '@/lib/tags';
import { translate } from '@/lib/t';

export const dynamic = 'force-dynamic';

const PANEL = '#151a2e';
const EDGE = '#242b45';

/**
 * The profile's Season Wrapped as a phone story (2026-11-12), for the share
 * button on the Ranked tab: rank, games, win rate, wins, best streak and the
 * three brawlers played most, with brawlzone.net at the foot so every share
 * says where it came from. 404 with fewer than five Ranked games.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ tag: string; lang: string }> }) {
  const { tag, lang } = await params;
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);
  const number = (n: number) => n.toLocaleString(NUMBER_LOCALE[locale]);

  let player;
  try {
    player = await getPlayer(tag);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const { season, view } = await seasonFor(normalizeTag(player.tag), player.tag);
  if (view.games < 5) return new Response('Not enough Ranked games', { status: 404 });

  const fonts = await slideFonts();
  const accent = nameColorToCss(player.nameColor);
  const names = await getOfficialBrawlers()
    .then((r) => new Map(r.items.map((b) => [b.id, b.name])))
    .catch(() => new Map<number, string>());
  const top = [...view.brawlers].sort((a, b) => b.games - a.games).slice(0, 3);
  const rankArt = rankedTierIconUrl(player.rankedRank) ?? rankedTierIconUrl(player.highestSeasonRankedRank);
  const [icon, rank, ...portraits] = await Promise.all([
    loadIcon(playerIconUrl(player.icon?.id), 200),
    rankArt ? loadIcon(rankArt, 300) : Promise.resolve(null),
    ...top.map((b) => loadIcon(brawlerIconUrl(b.brawlerId), 200)),
  ]);
  const rankWord = (name: string | undefined) => {
    if (!name) return null;
    const [word, ...rest] = titleCaseLabel(name).split(' ');
    return [t(word), ...rest].join(' ');
  };
  const pct = (w: number, g: number) => `${Math.round((w / Math.max(1, g)) * 100)}%`;
  const stats: [string, string][] = [
    [t('Ranked games'), number(view.games)],
    [t('Win rate'), pct(view.wins, view.games)],
    [t('Wins'), number(view.wins)],
    [t('Longest win streak'), number(view.detail.streaks.longestWin)],
  ];

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '100px 84px 300px 84px',
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
            width: SLIDE_SIZE.width,
            height: SLIDE_SIZE.height,
            background: 'linear-gradient(160deg, rgba(255,197,61,0.30) 0%, rgba(11,15,29,0) 40%, rgba(11,15,29,0) 70%, rgba(53,208,255,0.18) 100%)',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_SIZE.width, height: 10, background: BRAND }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
            <img src={icon} alt="" width={130} height={130} style={{ borderRadius: 26, background: '#1b2136' }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 68, color: accent, lineHeight: 1.05 }}>{player.name}</div>
            <div style={{ display: 'flex', fontSize: 34, color: DIM }}>{displayTag(player.tag)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40 }}>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 104, lineHeight: 0.95 }}>
            {season?.number ? t('SEASON {n}', { n: season.number }) : t('MY SEASON')}
          </div>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 104, lineHeight: 0.95, color: BRAND }}>{t('WRAPPED')}</div>
        </div>

        {rank || player.rankedRankName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 34, padding: '20px 34px', borderRadius: 30, background: PANEL, border: `2px solid ${EDGE}` }}>
            {rank ? (
              // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
              <img src={rank} alt="" width={150} height={150} />
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 64 }}>{rankWord(player.rankedRankName) ?? t('Unranked')}</div>
              {player.highestSeasonRankedRankName ? (
                <div style={{ display: 'flex', fontSize: 36, color: MUTED }}>
                  {t('Season best')}: {rankWord(player.highestSeasonRankedRankName)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 24 }}>
          {stats.map(([label, value]) => (
            <div
              key={label}
              style={{ display: 'flex', flexDirection: 'column', width: 447, padding: '16px 30px', borderRadius: 24, background: PANEL, border: `2px solid ${EDGE}` }}
            >
              <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{label}</div>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 66, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 40, color: BRAND, marginTop: 32, letterSpacing: 2 }}>{t('MOST PLAYED')}</div>
        <div style={{ display: 'flex', gap: 30, marginTop: 18 }}>
          {top.map((b, i) => (
            <div key={b.brawlerId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 284 }}>
              {portraits[i] ? (
                // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
                <img src={portraits[i]!} alt="" width={160} height={160} style={{ borderRadius: 22 }} />
              ) : (
                <div style={{ display: 'flex', width: 160, height: 160, borderRadius: 22, background: PANEL }} />
              )}
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 42, marginTop: 12 }}>{titleCaseLabel(names.get(b.brawlerId) ?? '')}</div>
              <div style={{ display: 'flex', fontSize: 32, color: MUTED }}>
                {t('{games} games', { games: number(b.games) })} · {pct(b.wins, b.games)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 40 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', width: 10, height: 52, borderRadius: 5, background: BRAND }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, color: BRAND }}>brawlzone.net</div>
            <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{t('Get your own Season Wrapped')}</div>
          </div>
        </div>
      </div>
    ),
    { ...SLIDE_SIZE, fonts },
  );

  return new Response(await png.arrayBuffer(), {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=300' },
  });
}
