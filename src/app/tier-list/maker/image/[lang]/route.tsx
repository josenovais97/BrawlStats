import { ImageResponse } from 'next/og';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap, getBrawlerCatalog } from '@/lib/brawler-catalog';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { BG, BODY, BRAND, DIM, DISPLAY, FG, SLIDE_SIZE, loadIcon, slideFonts } from '@/lib/slide-chrome';
import { getMetaIndex } from '@/lib/stats';
import { translate } from '@/lib/t';
import { decodeBoard, decodeOrder } from '@/lib/tier-board';
import { tierAgreement } from '@/lib/tier-agreement';
import { TIER_COLOR, TIER_ORDER } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

/**
 * A tier list from the maker, drawn as a phone-story image (1080x1920).
 *
 * The board comes in the query, in the same encoding as the maker's share
 * link (`lib/tier-board`), so the picture is a pure function of the URL. It
 * renders per request -- the query is the input -- and sits behind its own
 * rate limit (`/tier-list/maker/image/`), since a full board draws ~100
 * portraits. Those are kept in memory once resized, so after the first few
 * boards a render is mostly layout.
 *
 * The agreement with the measured Ranked list is printed on it: "matches the
 * data 64%" is the line that starts the argument, which is the point of
 * posting a tier list at all.
 */
export const dynamic = 'force-dynamic';

const ICONS = new Map<string, string | null>();
async function icon(id: number, size: number, url: string): Promise<string | null> {
  const key = `${id}:${size}`;
  if (ICONS.has(key)) return ICONS.get(key)!;
  const data = await loadIcon(url, size);
  if (ICONS.size > 2000) ICONS.clear();
  ICONS.set(key, data);
  return data;
}

const W = SLIDE_SIZE.width;
const SIDE = 60;
const LABEL = 110;
const GAP = 8;
const ROWS_HEIGHT = 1150;
const SIZES = [120, 104, 92, 80, 70, 62, 54, 48, 42];

/** The biggest portrait size at which every row still fits the board area. */
function fit(counts: number[]): { size: number; perLine: number } {
  const width = W - SIDE * 2 - LABEL - 24;
  for (const size of SIZES) {
    const perLine = Math.max(1, Math.floor((width + GAP) / (size + GAP)));
    const height = counts.reduce((h, n) => h + Math.max(1, Math.ceil(n / perLine)) * (size + GAP) + 18, 0);
    if (height <= ROWS_HEIGHT) return { size, perLine };
  }
  const size = SIZES[SIZES.length - 1];
  return { size, perLine: Math.floor((width + GAP) / (size + GAP)) };
}

export async function GET(request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';
  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars);

  const catalog = await getBrawlerCatalog().catch(() => null);
  if (!catalog) return new Response('Unavailable', { status: 503 });
  const names = new Map(catalog.current.map((b) => [b.id, b.name]));
  const known = new Set(names.keys());

  const query = new URL(request.url).searchParams;
  const placed = decodeBoard(query, known);
  const order = decodeOrder(query, known);
  if (order.length === 0) return new Response('Empty board', { status: 400 });

  // Rows S..D always, E and F only when used: an empty E/F would only shrink
  // the portraits on every other row.
  const tiers = TIER_ORDER.filter((tier, i) => i < 5 || order.some((id) => placed[id] === tier));
  const rows = new Map<Tier, number[]>(tiers.map((tier) => [tier, []]));
  for (const id of order) rows.get(placed[id])?.push(id);

  const meta = await getMetaIndex('ranked', 7).catch(() => new Map());
  const data = new Map<number, Tier | null>([...meta.entries()].map(([id, b]) => [id, b.tier ?? null]));
  const agreement = tierAgreement(placed, data, 2);

  const { size } = fit(tiers.map((tier) => rows.get(tier)!.length));
  const portraits = new Map<number, string | null>();
  // Same art as the tier lists: the wiki portrait while the mirror lacks one.
  const art = await getBrawlerArtMap().catch(() => new Map());
  await Promise.all(
    order.map(async (id) => portraits.set(id, await icon(id, size, art.get(id)?.imageUrl ?? brawlerIconUrl(id)))),
  );
  const [fonts] = await Promise.all([slideFonts()]);
  const title = (name: string) => name.charAt(0) + name.slice(1).toLowerCase();

  const png = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: `100px ${SIDE}px 0 ${SIDE}px`, background: BG, color: FG, fontFamily: BODY }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: 10, background: BRAND }} />
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 84, letterSpacing: 2 }}>{t('MY TIER LIST')}</div>
        <div style={{ display: 'flex', fontSize: 36, color: DIM, marginTop: 4 }}>{t('Brawl Stars, ranked by me')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34, height: ROWS_HEIGHT, gap: 0 }}>
          {tiers.map((tier) => (
            <div key={tier} style={{ display: 'flex', marginBottom: 10, borderRadius: 18, background: '#151a2e', overflow: 'hidden' }}>
              <div style={{ display: 'flex', width: LABEL, alignItems: 'center', justifyContent: 'center', background: TIER_COLOR[tier], color: '#0b0f1d', fontFamily: DISPLAY, fontSize: 64 }}>
                {tier}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP, padding: '8px 12px', flex: 1, minHeight: size + 16 }}>
                {rows.get(tier)!.map((id) =>
                  portraits.get(id) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain <img>
                    <img key={id} src={portraits.get(id)!} alt="" width={size} height={size} style={{ borderRadius: Math.round(size / 7) }} />
                  ) : (
                    <div key={id} style={{ display: 'flex', width: size, height: size, borderRadius: 10, background: '#242b45' }} />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        {agreement.compared >= 5 ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6, padding: '22px 30px', borderRadius: 24, background: '#151a2e', border: `3px solid ${BRAND}` }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 50, color: BRAND }}>
              {t('Matches the real data: {n}%', { n: agreement.score })}
            </div>
            {agreement.biggest.length ? (
              <div style={{ display: 'flex', fontSize: 32, color: FG, marginTop: 8 }}>
                {agreement.biggest
                  .map((d) => t('{name}: me {mine}, data {data}', { name: title(names.get(d.id) ?? '?'), mine: d.mine, data: d.data }))
                  .join('   ·   ')}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 26 }}>
          <div style={{ display: 'flex', width: 10, height: 52, borderRadius: 5, background: BRAND }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 50, color: BRAND }}>brawlzone.net</div>
            <div style={{ display: 'flex', fontSize: 30, color: DIM }}>{t('Make yours and compare it with the data')}</div>
          </div>
        </div>
      </div>
    ),
    { ...SLIDE_SIZE, fonts },
  );

  return new Response(await png.arrayBuffer(), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
  });
}
