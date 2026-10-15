import { ImageResponse } from 'next/og';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { isIntlLocale, rankLabel, type Locale } from '@/lib/i18n';
import { bracketBySlug } from '@/lib/rank-brackets';
import { getSeasonState } from '@/lib/ranked-seasons';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, SLIDE_SIZE, loadIcon, slideFonts } from '@/lib/slide-chrome';
import { getBracketRoster, getScoredRoster, type ScoredBrawler } from '@/lib/stats';
import { TIER_COLOR } from '@/lib/tiers';
import { translate } from '@/lib/t';

/**
 * The Ranked tier list as a phone-story image (1080x1920), to share.
 *
 * The Ranked tier list is the second most common way into the site, and a tier
 * list is the thing players post to argue about -- so this is the list as a
 * picture, with the site's name on it. `?rank=diamond|mythic|legendary|masters`
 * for one rank (the same precomputed roster the rank page reads), none for
 * every rank; `?lang=es|pt` for the labels.
 *
 * S, A and B (at most sixteen each) and C (twelve), with "+N" beyond: what fits a story
 * above the margin its own buttons cover, and the bottom of a tier list is not
 * what anyone shares it for.
 */

export const revalidate = 3600;

const PER_TIER = 16;
const TIERS = ['S', 'A', 'B', 'C'] as const;
/* C gets two rows at most: it is the last thing that fits above the margin. */
const CAP: Record<(typeof TIERS)[number], number> = { S: PER_TIER, A: PER_TIER, B: PER_TIER, C: 12 };
const ICON = 104;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lang = params.get('lang');
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);
  const bracket = bracketBySlug(params.get('rank'));

  const [fonts, roster, season] = await Promise.all([
    slideFonts(),
    bracket
      ? getBracketRoster(bracket.id).then((r) => r?.scored ?? null).catch(() => null)
      : Promise.resolve(null),
    getSeasonState().catch(() => null),
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
  const seasonNo = season?.current?.number;

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 44, flexShrink: 0 }}>
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
                  return src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
                    <img key={b.brawlerId} src={src} alt="" width={ICON} height={ICON} style={{ borderRadius: 16 }} />
                  ) : (
                    <div key={b.brawlerId} style={{ display: 'flex', width: ICON, height: ICON, borderRadius: 16, background: '#151a2e' }} />
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
