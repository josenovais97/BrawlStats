import { ImageResponse } from 'next/og';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { isIntlLocale, rankLabel, type Locale } from '@/lib/i18n';
import { bracketBySlug } from '@/lib/rank-brackets';
import { getSeasonState, liveSeasonNumber } from '@/lib/ranked-seasons';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, SLIDE_SIZE, loadIcon, slideFonts } from '@/lib/slide-chrome';
import { getBracketRoster, getScoredRoster, type ScoredBrawler } from '@/lib/stats';
import { TIER_COLOR } from '@/lib/tiers';
import { translate } from '@/lib/t';
import { getWeekTrend } from '@/lib/week-trend';

/**
 * The Ranked tier list as a phone-story image (1080x1920), to share.
 *
 * The Ranked tier list is the second most common way into the site, and a tier
 * list is the thing players post to argue about -- so this is the list as a
 * picture, with the site's name on it. `/story/<rank>/<lang>`: a rank slug
 * (diamond, mythic, legendary, masters) or `all`, then en, es or pt.
 *
 * S, A and B (at most sixteen each) and C (twelve), with "+N" beyond: what fits a story
 * above the margin its own buttons cover, and the bottom of a tier list is not
 * what anyone shares it for. An arrow marks a brawler whose win rate at that
 * rank clearly rose or fell against the week before (2026-11-25, owner).
 */

export const revalidate = 3600;

const PER_TIER = 16;
const TIERS = ['S', 'A', 'B', 'C'] as const;
/* C gets two rows at most: it is the last thing that fits above the margin. */
const CAP: Record<(typeof TIERS)[number], number> = { S: PER_TIER, A: PER_TIER, B: PER_TIER, C: 12 };
const ICON = 104;
const UP = '#3cd26e';
const DOWN = '#ff4d63';

/** A round arrow: up in green, down in red, as on the rank's own list. */
function Arrow({ dir, size }: { dir: 1 | -1; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill={dir > 0 ? UP : DOWN} stroke={BG} strokeWidth="4" />
      <path d={dir > 0 ? 'M20 9 L31 22 H24 V30 H16 V22 H9 Z' : 'M20 31 L31 18 H24 V10 H16 V18 H9 Z'} fill="#ffffff" />
    </svg>
  );
}

/* Runtime ISR -- see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ rank: string; lang: string }> }) {
  // Rank and language are path segments ('all' for every rank): a cached route
  // may not read the request URL, and each combination gets its own image.
  const { rank, lang } = await params;
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);
  const bracket = bracketBySlug(rank);

  const [fonts, roster, season, trend] = await Promise.all([
    slideFonts(),
    bracket
      ? getBracketRoster(bracket.id).then((r) => r?.scored ?? null).catch(() => null)
      : Promise.resolve(null),
    getSeasonState().catch(() => null),
    getWeekTrend(bracket?.id).catch((): Record<number, 1 | -1> => ({})),
  ]);
  const scored: ScoredBrawler[] = roster ?? (await getScoredRoster(7, undefined, 'ranked').catch(() => []));
  const rankName = bracket && roster ? rankLabel(bracket, locale) : t('All ranks');

  const byTier = TIERS.map((tier) => {
    const all = scored.filter((b) => b.tier === tier).sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
    return { tier, shown: all.slice(0, CAP[tier]), more: Math.max(0, all.length - CAP[tier]) };
  });
  const icons = new Map(
    await Promise.all(
      byTier.flatMap((row) => row.shown).map(async (b) => [b.brawlerId, await loadIcon(brawlerIconUrl(b.brawlerId), ICON)] as const),
    ),
  );
  const seasonNo = liveSeasonNumber(season);
  // The rank's own list only: with too few games for it, the picture falls
  // back to every rank and the rank's arrows would be about another list.
  const arrows: Record<number, 1 | -1> = bracket && !roster ? {} : trend;
  const anyArrow = byTier.some((row) => row.shown.some((b) => arrows[b.brawlerId]));

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '100px 84px 330px 84px',
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
            background: 'linear-gradient(160deg, rgba(255,197,61,0.22), rgba(11,15,29,0) 45%)',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_SIZE.width, height: 10, background: BRAND }} />

        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 96, lineHeight: 1, flexShrink: 0 }}>
          {t('RANKED TIER LIST')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 64, color: BRAND }}>{rankName}</div>
          <div style={{ display: 'flex', fontSize: 36, color: DIM }}>
            {seasonNo ? t('Season {n} · last 7 days', { n: seasonNo }) : t('Last 7 days')}
          </div>
        </div>
        {anyArrow ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, fontSize: 32, color: DIM, flexShrink: 0 }}>
            <Arrow dir={1} size={40} />
            <div style={{ display: 'flex', marginRight: 18 }}>{t('Rising this week')}</div>
            <Arrow dir={-1} size={40} />
            <div style={{ display: 'flex' }}>{t('Falling this week')}</div>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: anyArrow ? 18 : 22, marginTop: anyArrow ? 28 : 44, flexShrink: 0 }}>
          {byTier.map((row) => (
            <div key={row.tier} style={{ display: 'flex', gap: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 110,
                  minHeight: ICON + 12,
                  borderRadius: 22,
                  background: TIER_COLOR[row.tier],
                  fontFamily: DISPLAY,
                  fontSize: 80,
                  color: BG,
                  flexShrink: 0,
                }}
              >
                {row.tier}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: 768, alignItems: 'center' }}>
                {row.shown.map((b) => {
                  const src = icons.get(b.brawlerId);
                  const dir = arrows[b.brawlerId];
                  return (
                    <div key={b.brawlerId} style={{ display: 'flex', position: 'relative', width: ICON, height: ICON }}>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
                        <img src={src} alt="" width={ICON} height={ICON} style={{ borderRadius: 16 }} />
                      ) : (
                        <div style={{ display: 'flex', width: ICON, height: ICON, borderRadius: 16, background: '#151a2e' }} />
                      )}
                      {dir ? (
                        <div style={{ display: 'flex', position: 'absolute', right: -6, bottom: -6 }}>
                          <Arrow dir={dir} size={44} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {row.more > 0 ? (
                  <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 40, color: DIM, marginLeft: 8 }}>
                    {`+${row.more}`}
                  </div>
                ) : null}
                {row.shown.length === 0 ? (
                  <div style={{ display: 'flex', fontSize: 34, color: DIM }}>{t('Not enough battles yet')}</div>
                ) : null}
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
