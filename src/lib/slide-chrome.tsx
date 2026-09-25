import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ReactElement } from 'react';
import sharp from 'sharp';

import { brawlerModelUrl, brawlerPortraitUrl } from '@/lib/brawlapi';
import { SITE_NAME } from '@/lib/site';

/**
 * The frame, palette and closing slide every BrawlZone carousel is built from.
 *
 * Extracted from `daily-slides` when a second carousel (the daily brawler
 * build) needed the same chrome. Two carousels with their own copies of the
 * safe areas and the brand colours is two carousels that look like different
 * accounts within a month.
 *
 * Satori: flexbox and a subset of CSS only. No grid, no custom properties, no
 * Tailwind, and every `div` with more than one child needs an explicit
 * `display: flex`.
 */

export const SLIDE_SIZE = { width: 1080, height: 1920 };

export const BG = '#0b0f1d';
export const FG = '#f2f5ff';
export const MUTED = '#c9d2ea';
export const DIM = '#8b95b8';
export const ACCENT = '#35d0ff';
export const BRAND = '#ffc53d';

/**
 * TikTok draws its own UI over a post: caption and username across the bottom,
 * a column of like/comment/share buttons up the right. Content sits inside
 * these margins rather than being centred on the canvas.
 */
export const PAD = '150px 230px 400px 92px';

/**
 * Brawler art as a data URI, or null when there is none to be had.
 *
 * Inlined rather than handed to Satori as a URL, because Satori fetches images
 * itself and a 404 takes down the whole render — and the CDN publishes a
 * brawler's metadata weeks before its artwork, so a 404 is the *expected* case
 * for anyone newly released. `hasBrawlerPortrait` is no help here: it counts a
 * failed probe as a hit deliberately, which is right for an `<img>` the
 * browser can fail quietly and wrong for a render that would throw.
 *
 * The fetch is deliberately left on Next's default (uncached): a `force-cache`
 * here would put a fetch-level revalidate under the route and pin it to
 * whichever is shorter (AGENTS.md trap 2). One CDN request per slide per day
 * is not worth that risk.
 *
 * Downscaled before it reaches Satori because the model renders are far larger
 * than the box they are drawn into, and rasterising them at full size is the
 * slowest part of the whole image.
 */
export async function loadIcon(url: string, box: number): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function loadArt(
  brawlerId: number,
  box: number,
  fallbackUrl?: string | null,
): Promise<string | null> {
  /*
   * `fallbackUrl` is the catalogue's own `imageUrl`, which is documented as a
   * portrait that actually resolves -- it falls back to the wiki for brawlers
   * the mirror has not published yet. Without it a brand-new brawler renders
   * with no art at all: on 2026-09-25 all three CDN paths for Cosmo returned
   * 404, which is the same gap that broke the tier list in September.
   */
  const candidates = [brawlerModelUrl(brawlerId), brawlerPortraitUrl(brawlerId)];
  if (fallbackUrl) candidates.push(fallbackUrl);

  for (const url of candidates) {
    const art = await loadIcon(url, box);
    // Next candidate, then none. A slide without art is still a slide.
    if (art) return art;
  }
  return null;
}

/**
 * What the site offers, for the closing slide.
 *
 * Every line is a page that exists. A carousel that advertises a feature the
 * site does not have is worse than one that advertises nothing, and this is
 * exactly the list that rots quietly — `site-footer` carries the same rule and
 * the same reason.
 */
const OFFERS = [
  'Tier lists for every mode',
  'Best builds, gadgets and gears',
  'Map-by-map ranked picks',
  'A draft helper, pick by pick',
  'Team comps with real sample floors',
  'Player, club and leaderboard stats',
];

/**
 * The app icon as a data URI, read off disk rather than fetched.
 *
 * `public/` is copied next to `server.js` in the standalone output, so
 * `process.cwd()` resolves in both `next dev` and the container. Fetching it
 * from SITE_URL would work too and would be a pointless round trip through
 * Caddy to reach a file already on the same disk. Failure is not fatal: the
 * wordmark carries the brand on its own.
 */
export async function loadLogo(box: number): Promise<string | null> {
  try {
    const raw = await readFile(join(process.cwd(), 'public', 'brand', 'app-icon-1024.png'));
    const png = await sharp(raw)
      .resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

/** The full-bleed wash every slide sits on. Linear: Satori has no radial. */
export function Backdrop(): ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: SLIDE_SIZE.width,
        height: SLIDE_SIZE.height,
        background: 'linear-gradient(160deg, rgba(53,208,255,0.18), rgba(11,15,29,0) 55%)',
      }}
    />
  );
}

export function Frame({ children }: { children: ReactElement[] }): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: PAD,
        background: BG,
        color: FG,
        fontFamily: 'sans-serif',
      }}
    >
      <Backdrop />
      {children}
    </div>
  );
}

export function Wordmark(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, color: BRAND }}>
        brawlzone.net
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: DIM }}>
        {SITE_NAME} · free tier lists, maps and draft help
      </div>
    </div>
  );
}

/**
 * The closing slide: what else is on the site.
 *
 * The method slide before it answers "should I believe this"; this one answers
 * "where do I get more of it". Nothing here is tappable — `post_info` has no
 * link field and a slide is a picture — so the domain is set large enough to
 * be read and remembered off a phone screen, which is the only mechanism
 * available.
 */
export function outro(logo: string | null): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={104} height={104} alt="" style={{ borderRadius: 24 }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
            THERE IS A LOT MORE
          </div>
          <div style={{ display: 'flex', fontSize: 44, color: MUTED, marginTop: 6 }}>
            Find this and more on
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', fontSize: 116, fontWeight: 800, color: BRAND, marginTop: 10 }}>
        BrawlZone
      </div>

      {/* A panel rather than loose lines: it groups the offer as one block and
          keeps it from reading as a continuation of the headline. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          marginTop: 40,
          padding: '38px 34px',
          borderRadius: 28,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        {OFFERS.map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                width: 14,
                height: 14,
                borderRadius: 7,
                background: ACCENT,
              }}
            />
            <div style={{ display: 'flex', fontSize: 36, color: FG }}>{line}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 44 }}>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 800, color: BRAND }}>
          brawlzone.net
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: DIM }}>
          Free. No login. Updated every 2 hours.
        </div>
      </div>
    </Frame>
  );
}

/** PNG from Satori to JPEG, which is the only thing TikTok accepts. */
export async function toJpeg(png: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(png))
    .flatten({ background: BG })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

