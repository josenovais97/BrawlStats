import { ImageResponse } from 'next/og';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { humanizeMode, titleCaseLabel } from '@/lib/format';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { getSeasonState } from '@/lib/ranked-seasons';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, SLIDE_SIZE, loadArt, loadIcon, slideFonts } from '@/lib/slide-chrome';
import { getBrawlerPairings, getMetaIndex, getRankedMapPicks } from '@/lib/stats';
import { slugify } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';
import { translate } from '@/lib/t';

/**
 * A brawler as a phone-story image (1080x1920), to share.
 *
 * What people look a brawler up for, on one picture: how good they are in
 * Ranked right now, the maps they are best on, and the matchups -- who beats
 * them and who they beat. The same reads the brawler page uses. `?lang=es|pt`
 * for the labels and the game's own map and mode names.
 */

export const revalidate = 3600;

/* Runtime ISR -- see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

const PANEL = '#151a2e';
const EDGE = '#242b45';
/* A map's estimate needs this many decided battles behind it to be shown. */
const MIN_MAP_SAMPLE = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; lang: string }> }) {
  // The language is a path segment: a cached route may not read the URL.
  const { slug, lang } = await params;
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);

  const catalog = await getBrawlerCatalog().catch(() => null);
  const entry = catalog?.bySlug.get(slugify(slug));
  if (!entry) return new Response('Not found', { status: 404 });
  const id = entry.id;

  const [fonts, meta, mapPicks, pairings, words, season] = await Promise.all([
    slideFonts(),
    getMetaIndex('ranked', 7).catch(() => new Map()),
    // The current Ranked rotation's per-map picks, the same read as /ranked:
    // all-battle-type map splits ran to 80%+ on trophy maps no one drafts on.
    getRankedMapPicks(60).catch(() => []),
    getBrawlerPairings(id).catch(() => null),
    gameWords(locale),
    getSeasonState().catch(() => null),
  ]);
  // The season's own pool when the wiki has it: the recent battles still hold
  // last season's maps for a few days after a turnover.
  const pool = new Set((season?.mapPool ?? []).flatMap((e) => e.maps.map((m) => slugify(m))));
  const scored = meta.get(id);
  const bestMaps = mapPicks
    .flatMap((m) => {
      if (pool.size > 0 && !pool.has(slugify(m.mapName))) return [];
      const mine = m.picks.find((p) => p.brawlerId === id && p.decidedSampleSize >= MIN_MAP_SAMPLE);
      return mine ? [{ mode: m.mode, mapName: m.mapName, score: mine.score, winRate: mine.winRate }] : [];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  // Portraits first, then the three with one: a brawler too new for the CDN
  // to have a picture is dropped rather than left as an empty square.
  const withFaces = async (list: { brawlerId: number }[]) =>
    (await Promise.all(list.slice(0, 5).map(async (p) => ({ id: p.brawlerId, src: await loadIcon(brawlerIconUrl(p.brawlerId), 150) }))))
      .filter((f): f is { id: number; src: string } => Boolean(f.src))
      .slice(0, 3);
  const [art, beatenBy, beats] = await Promise.all([
    loadArt(id, 560),
    withFaces(pairings?.weakAgainst ?? []),
    withFaces(pairings?.strongAgainst ?? []),
  ]);
  const name = titleCaseLabel(entry.name);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  const Face = ({ src }: { src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
    <img src={src} alt="" width={130} height={130} style={{ borderRadius: 20 }} />
  );

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '90px 84px 330px 84px',
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
            background: 'linear-gradient(165deg, rgba(53,208,255,0.22), rgba(11,15,29,0) 50%)',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_SIZE.width, height: 10, background: BRAND }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
            <img src={art} alt="" width={380} height={380} style={{ objectFit: 'contain' }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 96, lineHeight: 1 }}>{name}</div>
            {scored?.tier ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 22 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 96,
                    height: 96,
                    borderRadius: 20,
                    background: TIER_COLOR[scored.tier as keyof typeof TIER_COLOR],
                    fontFamily: DISPLAY,
                    fontSize: 70,
                    color: BG,
                  }}
                >
                  {scored.tier}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: 30, color: DIM }}>{t('in Ranked')}</div>
                  {scored.normalizedWinRate != null ? (
                    <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 48 }}>
                      {t('{p} win rate', { p: pct(scored.normalizedWinRate) })}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {bestMaps.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, flexShrink: 0 }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 40, color: BRAND, letterSpacing: 2 }}>
              {t('BEST RANKED MAPS')}
            </div>
            {bestMaps.map((m) => (
              <div
                key={`${m.mode}/${m.mapName}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  padding: '18px 28px',
                  borderRadius: 22,
                  background: PANEL,
                  border: `2px solid ${EDGE}`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 44 }}>{words.map(m.mapName)}</div>
                  <div style={{ display: 'flex', fontSize: 28, color: DIM }}>{words.mode(m.mode) || humanizeMode(m.mode)}</div>
                </div>
                <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 48, color: '#34d399' }}>{pct(m.winRate)}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 30, marginTop: 40, flexShrink: 0 }}>
          {[
            { label: t('COUNTERED BY'), list: beatenBy, color: '#ff5c72' },
            { label: t('STRONG AGAINST'), list: beats, color: '#34d399' },
          ].map((col) => (
            <div key={col.label} style={{ display: 'flex', flexDirection: 'column', width: 441 }}>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 36, color: col.color, letterSpacing: 1 }}>
                {col.label}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                {col.list.length > 0 ? (
                  col.list.map((f) => <Face key={f.id} src={f.src} />)
                ) : (
                  <div style={{ display: 'flex', fontSize: 30, color: DIM }}>{t('Not enough battles yet')}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', width: 10, height: 52, borderRadius: 5, background: BRAND }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 52, color: BRAND }}>brawlzone.net</div>
            <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{t('From real Ranked battles, updated every 2 hours')}</div>
          </div>
        </div>
      </div>
    ),
    { ...SLIDE_SIZE, fonts },
  );

  return new Response(await png.arrayBuffer(), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
