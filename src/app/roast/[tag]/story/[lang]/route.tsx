import { ImageResponse } from 'next/og';

import { playerIconUrl } from '@/lib/brawlapi';
import { nameColorToCss } from '@/lib/format';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { getRoast } from '@/lib/roast-data';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, SLIDE_SIZE, loadIcon, slideFonts } from '@/lib/slide-chrome';
import { displayTag } from '@/lib/tags';
import { translate } from '@/lib/t';

/**
 * A roast as a phone-story image (1080x1920), to post.
 *
 * Built like the account value card: per request, only when someone taps
 * Share. The score and title lead, then the first three lines -- the five do
 * not fit at a size anyone can read in a story. Nothing important in the
 * bottom ~330px or right ~200px, where a story's own buttons sit.
 */
export const dynamic = 'force-dynamic';

const PANEL = '#151a2e';
const FIRE = '#ff6a2b';
const ROSE = '#f43f5e';

export async function GET(_request: Request, { params }: { params: Promise<{ tag: string; lang: string }> }) {
  const { tag, lang } = await params;
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);
  const fonts = await slideFonts();

  let result;
  try {
    result = await getRoast(tag, locale);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const { player, roast } = result;
  const accent = nameColorToCss(player.nameColor);
  const icon = await loadIcon(playerIconUrl(player.icon?.id), 240);

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
            background: `linear-gradient(165deg, ${FIRE} 0%, rgba(11,15,29,0) 45%)`,
            opacity: 0.35,
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_SIZE.width, height: 10, background: FIRE }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 0 }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
            <img src={icon} alt="" width={140} height={140} style={{ borderRadius: 30, background: '#1b2136' }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 70, color: accent, lineHeight: 1.05 }}>
              {player.name}
            </div>
            <div style={{ display: 'flex', fontSize: 34, color: DIM, marginTop: 8 }}>{displayTag(player.tag)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 42, color: FIRE, letterSpacing: 2, marginTop: 56 }}>
          {t('MY ACCOUNT GOT ROASTED')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 190, lineHeight: 1 }}>{roast.score.toFixed(1)}</div>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 80, color: DIM }}>/10</div>
        </div>
        <div style={{ display: 'flex', marginTop: 14 }}>
          <div
            style={{
              display: 'flex',
              fontFamily: DISPLAY,
              fontSize: 54,
              color: '#fff',
              background: ROSE,
              padding: '10px 30px',
              borderRadius: 22,
              transform: 'rotate(-2deg)',
            }}
          >
            {roast.title.toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 48, flexShrink: 0 }}>
          {roast.lines.slice(0, 3).map((line) => (
            <div
              key={line}
              style={{
                display: 'flex',
                padding: '24px 32px',
                borderRadius: 26,
                background: PANEL,
                borderLeft: `8px solid ${FIRE}`,
                fontSize: 38,
                lineHeight: 1.3,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', width: 10, height: 52, borderRadius: 5, background: FIRE }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, color: BRAND }}>brawlzone.net</div>
            <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{t('Think your account is good? Get roasted.')}</div>
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
