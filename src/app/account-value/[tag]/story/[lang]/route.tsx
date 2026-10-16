import { ImageResponse } from 'next/og';

import { standingLabel, valuePercentile } from '@/lib/account-value';
import { playerIconUrl } from '@/lib/brawlapi';
import { getPlayer } from '@/lib/bs-api';
import { nameColorToCss } from '@/lib/format';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { coinBreakdown } from '@/lib/progression';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, SLIDE_SIZE, loadIcon, slideFonts } from '@/lib/slide-chrome';
import { getAccountValueDistribution } from '@/lib/stats';
import { displayTag } from '@/lib/tags';
import { translate } from '@/lib/t';

/**
 * An account's value as a phone-story image (1080x1920), to post.
 *
 * Built like the profile card (`/player/[tag]/story`): per request, because
 * the player is a live fetch, and only fetched when someone taps Share. The
 * coin total leads, then the standing, then where the coins went. Nothing
 * important in the bottom ~330px or right ~200px, where a story's own
 * buttons sit.
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

  const number = (n: number) => n.toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR');
  const coins = coinBreakdown(player);
  const dist = await getAccountValueDistribution();
  const standing = dist ? standingLabel(valuePercentile(coins.total, dist)) : null;
  const accent = nameColorToCss(player.nameColor);
  const icon = await loadIcon(playerIconUrl(player.icon?.id), 240);
  const headline = coins.total >= 1_000_000 ? `${(coins.total / 1_000_000).toFixed(2)}M` : number(coins.total);

  const parts: [string, number][] = (
    [
      [t('Power levels'), coins.powerLevels],
      [t('Hypercharges'), coins.hyperCharges],
      [t('Star powers'), coins.starPowers],
      [t('Gadgets'), coins.gadgets],
      [t('Gears'), coins.gears],
    ] as [string, number][]
  ).sort((a, b) => b[1] - a[1]);

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
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: SLIDE_SIZE.width,
            height: SLIDE_SIZE.height,
            background: `linear-gradient(165deg, ${BRAND} 0%, rgba(11,15,29,0) 42%)`,
            opacity: 0.28,
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_SIZE.width, height: 10, background: BRAND }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 0 }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
            <img src={icon} alt="" width={150} height={150} style={{ borderRadius: 30, background: '#1b2136' }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 76, color: accent, lineHeight: 1.05 }}>
              {player.name}
            </div>
            <div style={{ display: 'flex', fontSize: 36, color: DIM, marginTop: 8 }}>{displayTag(player.tag)}</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 60,
            padding: '34px 44px',
            flexShrink: 0,
            borderRadius: 34,
            background: PANEL,
            border: `4px solid ${BRAND}`,
          }}
        >
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 42, color: BRAND, letterSpacing: 2 }}>
            {t('MY ACCOUNT VALUE')}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 10 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 150, lineHeight: 1 }}>{headline}</div>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 60, color: DIM }}>{t('coins')}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 40, color: FG, marginTop: 10 }}>
            {t('plus {pp} power points', { pp: number(coins.powerPoints) })}
          </div>
          {standing ? (
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 58, color: BRAND, marginTop: 26 }}>
              {standing.top
                ? t('Top {n}% of players', { n: standing.value })
                : t('Worth more than {n}% of players', { n: standing.value })}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 40, color: BRAND, marginTop: 46, letterSpacing: 2, flexShrink: 0 }}>
          {t('WHERE THE COINS WENT')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18, flexShrink: 0 }}>
          {parts.slice(0, 4).map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 30px',
                borderRadius: 22,
                background: PANEL,
                border: `2px solid ${EDGE}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: 40 }}>{label}</div>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 46 }}>{number(value)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', width: 10, height: 52, borderRadius: 5, background: BRAND }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, color: BRAND }}>brawlzone.net</div>
            <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{t('How much is your account worth?')}</div>
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
