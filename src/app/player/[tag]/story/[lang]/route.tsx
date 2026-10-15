import { ImageResponse } from 'next/og';

import { brawlerIconUrl, playerIconUrl } from '@/lib/brawlapi';
import { getOfficialBrawlers, getPlayer } from '@/lib/bs-api';
import { nameColorToCss, titleCaseLabel } from '@/lib/format';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { computeSkillScore } from '@/lib/skill-score';
import {
  BG,
  BODY,
  BRAND,
  DIM,
  DISPLAY,
  FG,
  MUTED,
  SLIDE_SIZE,
  loadIcon,
  slideFonts,
} from '@/lib/slide-chrome';
import { displayTag } from '@/lib/tags';
import { translate } from '@/lib/t';

/**
 * A player's profile as a phone-story image (1080x1920), to share.
 *
 * The link preview (`opengraph-image`) is for a link someone pastes; this is
 * for the picture someone posts -- an Instagram or TikTok story, a WhatsApp
 * status, a Discord message. Profiles are the stickiest pages on the site
 * (about five pages per visitor), and an account is the one thing a player
 * wants to show off. The domain is on it, so every post is an advert.
 *
 * Skill Score leads, as on the link card: it is the number only this site has
 * and the one people argue about. Then peak Ranked, trophies and the three
 * highest-trophy brawlers. `/story/es` or `/story/pt` sets the labels, from the page it was
 * shared from.
 *
 * Nothing important sits in the bottom ~330px or the right ~200px, where a
 * story's own buttons and caption cover the picture.
 */

/*
 * Rendered per request, like the profile page: the player comes from a live
 * `no-store` fetch, which a cached (ISR) route may not make -- it threw, the
 * catch below turned that into a 404, and every profile card was "Not found".
 * Only a tap on Share asks for one, and /player is behind the proxy's rate
 * limit (lib/hot-path-limit). The language is a path segment either way.
 */
export const dynamic = 'force-dynamic';

const PANEL = '#151a2e';
const EDGE = '#242b45';

export async function GET(_request: Request, { params }: { params: Promise<{ tag: string; lang: string }> }) {
  const { tag, lang } = await params;
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);
  const fonts = await slideFonts();

  let player;
  try {
    player = await getPlayer(tag);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const accent = nameColorToCss(player.nameColor);
  const number = (n: number) => n.toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR');
  const catalogue = await getOfficialBrawlers()
    .then((res) => res.items.length)
    .catch(() => undefined);
  const skill = computeSkillScore(player, catalogue);
  const peakRankName = player.highestAllTimeRankedRankName ?? player.highestSeasonRankedRankName;

  // "Mythic I" -> "Mítico I": the rank word in the page's language, the
  // division numeral as is.
  const rankLabel = (name: string) => {
    const [word, ...rest] = name.split(' ');
    return [t(word), ...rest].join(' ');
  };

  const top = [...player.brawlers].sort((a, b) => b.trophies - a.trophies).slice(0, 3);
  const [icon, ...portraits] = await Promise.all([
    loadIcon(playerIconUrl(player.icon?.id), 240),
    ...top.map((b) => loadIcon(brawlerIconUrl(b.id), 220)),
  ]);

  const stats: [string, string][] = [
    ...(peakRankName ? ([[t('Peak Ranked'), rankLabel(titleCaseLabel(peakRankName))]] as [string, string][]) : []),
    [t('Trophies'), number(player.trophies)],
    [t('Brawlers'), String(player.brawlers.length)],
    [t('3v3 wins'), number(player['3vs3Victories'])],
  ];

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '110px 84px 330px 84px',
          background: BG,
          color: FG,
          fontFamily: BODY,
        }}
      >
        {/* A wash in the player's own name colour, as on the profile page. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: SLIDE_SIZE.width,
            height: SLIDE_SIZE.height,
            background: `linear-gradient(165deg, ${accent} 0%, rgba(11,15,29,0) 45%)`,
            opacity: 0.35,
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_SIZE.width, height: 10, background: BRAND }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 0 }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
            <img src={icon} alt="" width={170} height={170} style={{ borderRadius: 32, background: '#1b2136' }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 84, color: accent, lineHeight: 1.05 }}>
              {player.name}
            </div>
            <div style={{ display: 'flex', fontSize: 38, color: DIM, marginTop: 10 }}>
              {`${displayTag(player.tag)}${player.club?.name ? `  ·  ${player.club.name}` : ''}`}
            </div>
          </div>
        </div>

        {/* The hero: the number only this site has. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 50,
            padding: '28px 40px',
            flexShrink: 0,
            borderRadius: 32,
            background: PANEL,
            border: `4px solid ${BRAND}`,
          }}
        >
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 40, color: BRAND, letterSpacing: 2 }}>
            {t('SKILL SCORE')}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 6 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 124, lineHeight: 1 }}>
              {skill.score.toFixed(1)}
            </div>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 64, color: DIM }}>/ 10</div>
          </div>
          <div style={{ display: 'flex', fontSize: 44, color: FG, marginTop: 8 }}>
            {skill.flag ? `${t(skill.tier)}  ·  ${skill.flag.label}` : t(skill.tier)}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 22, flexShrink: 0 }}>
          {stats.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: 446,
                padding: '18px 30px',
                borderRadius: 24,
                background: PANEL,
                border: `2px solid ${EDGE}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{label}</div>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 40, color: BRAND, marginTop: 40, letterSpacing: 2, flexShrink: 0 }}>
          {t('TOP BRAWLERS')}
        </div>
        <div style={{ display: 'flex', gap: 30, marginTop: 18, flexShrink: 0 }}>
          {top.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 284 }}>
              {portraits[i] ? (
                // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
                <img src={portraits[i]!} alt="" width={170} height={170} style={{ borderRadius: 22 }} />
              ) : (
                <div style={{ display: 'flex', width: 170, height: 170, borderRadius: 22, background: PANEL }} />
              )}
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 44, marginTop: 14 }}>
                {titleCaseLabel(b.name)}
              </div>
              <div style={{ display: 'flex', fontSize: 34, color: MUTED }}>{t('{n} trophies', { n: number(b.trophies) })}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', width: 10, height: 52, borderRadius: 5, background: BRAND }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, color: BRAND }}>brawlzone.net</div>
            <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{t('Check your own Skill Score')}</div>
          </div>
        </div>
      </div>
    ),
    { ...SLIDE_SIZE, fonts },
  );

  return new Response(await png.arrayBuffer(), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'private, max-age=300',
    },
  });
}
