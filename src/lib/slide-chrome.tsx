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

/**
 * The two faces every slide is set in, read off disk.
 *
 * Until 2026-09-29 the carousels shipped in whatever font `ImageResponse`
 * bundles by default, which is Geist Regular and nothing else. Every headline,
 * every number and every label therefore rendered in one weight of one neutral
 * UI face -- and a post about a *game*, set in the same type as a settings
 * dialog, reads as something a machine emitted. It was the single biggest
 * reason the posts felt automated, and it had nothing to do with the words.
 *
 * Lilita One is already the site's display face, so the post and the page now
 * look like the same product. It is a heavy face by design, which is why
 * headlines and big numbers need no synthetic bold: asking Satori to embolden
 * a font it has one weight of produces a smeared outline, not a bolder letter.
 *
 * Read from `public/` with the same reasoning as `loadLogo` -- the files are
 * on the same disk as the renderer, and fetching them over the network would
 * add a dependency that can stall, which is exactly what dropped Gale's
 * artwork on 2026-09-28.
 */
export const DISPLAY = 'Lilita One';
export const BODY = 'Geist';

let fontCache: { name: string; data: ArrayBuffer; weight: 400; style: 'normal' }[] | null = null;

export async function slideFonts() {
  if (fontCache) return fontCache;
  const dir = join(process.cwd(), 'public', 'fonts');
  const [display, body] = await Promise.all([
    readFile(join(dir, 'LilitaOne-Regular.ttf')),
    readFile(join(dir, 'Geist-Regular.ttf')),
  ]);
  const toAb = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  fontCache = [
    { name: DISPLAY, data: toAb(display), weight: 400 as const, style: 'normal' as const },
    { name: BODY, data: toAb(body), weight: 400 as const, style: 'normal' as const },
  ];
  return fontCache;
}

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
export const PAD = '120px 200px 330px 84px';

/**
 * Where the pinned footer sits, and why the bottom padding shrank.
 *
 * 400px of bottom padding was reserved for TikTok's caption and username, and
 * with `justifyContent: center` above it the result was content floating in
 * the upper two thirds over a third of empty canvas. It read as an unfinished
 * template rather than a deliberate margin.
 *
 * TikTok's own chrome occupies roughly the bottom 280px, so 330px keeps a
 * margin without donating the whole lower third, and the footer below draws
 * the eye to a deliberate end instead of a void.
 */
const FOOTER_BOTTOM = 232;

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
/**
 * Retried once, and given longer than feels necessary, because the failure
 * here is silent and lasts a day.
 *
 * The timeout was 8s with no retry. Measured from the box on 2026-09-28,
 * three back-to-back fetches of the same CDN file returned in 0.05s, timed
 * out entirely at 20s, and returned in 9.07s -- so the link is not slow so
 * much as intermittently stalled, and 8s sat right in the middle of the
 * distribution. A miss is not visible anywhere: `loadArt` falls through its
 * candidates, the slide renders without art, and the result is written into a
 * 24-hour ISR entry. Gale's faller slide shipped with an empty frame that way,
 * and nothing in the logs mentioned it.
 *
 * Two attempts rather than more, and a short pause between them: the point is
 * to survive one stall, not to wait out a dead CDN. `loadArt` still walks its
 * candidate list on top of this, so a genuinely missing file costs the same as
 * it did before.
 */
const ICON_TIMEOUT_MS = 12_000;

export async function loadIcon(url: string, box: number): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(ICON_TIMEOUT_MS) });
      // A 404 is an answer, not a stall: the mirror has not published this
      // brawler yet, and retrying cannot change that. Only a throw -- a
      // timeout or a dropped connection -- is worth a second go.
      if (!res.ok) return null;
      const png = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }
  return null;
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

/**
 * The full-bleed wash every slide sits on. Linear only: Satori has no radial.
 *
 * Three layers rather than one. The single top-left wash left the lower half
 * of every slide as flat, undifferentiated navy, which is what made the posts
 * look like a template with the content missing. The accent bar and the bottom
 * scrim give the frame a top and a bottom, so a slide with little content
 * still looks composed rather than empty.
 */
export function Backdrop(): ReactElement {
  return (
    <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0 }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SLIDE_SIZE.width,
          height: SLIDE_SIZE.height,
          background: 'linear-gradient(160deg, rgba(53,208,255,0.20), rgba(11,15,29,0) 52%)',
        }}
      />
      {/* Weights the bottom, so the safe area reads as margin, not as a gap. */}
      <div
        style={{
          position: 'absolute',
          top: SLIDE_SIZE.height - 760,
          left: 0,
          width: SLIDE_SIZE.width,
          height: 760,
          background: 'linear-gradient(180deg, rgba(11,15,29,0), rgba(4,6,14,0.85))',
        }}
      />
      {/* A brand edge. Two pixels of yellow is the cheapest signal that a
          human chose something about this picture. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SLIDE_SIZE.width,
          height: 10,
          background: BRAND,
        }}
      />
    </div>
  );
}

/**
 * Pinned to the bottom of every slide, over the scrim.
 *
 * Carousels are swiped fast and most viewers never reach the closing slide, so
 * the domain has to be on all of them. Small and quiet: it is a signature, not
 * a banner.
 */
function Footer(): ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        left: 84,
        bottom: FOOTER_BOTTOM,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', width: 8, height: 34, borderRadius: 4, background: BRAND }} />
      <div style={{ display: 'flex', fontSize: 34, fontFamily: DISPLAY, color: BRAND }}>
        brawlzone.net
      </div>
      <div style={{ display: 'flex', fontSize: 26, fontFamily: BODY, color: DIM }}>
        updated every 2h
      </div>
    </div>
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
        fontFamily: BODY,
      }}
    >
      <Backdrop />
      {children}
      <Footer />
    </div>
  );
}

/**
 * Brawler art on a pedestal.
 *
 * The art is the best asset these posts have and it was being rendered at a
 * third of the size it deserved, floating with nothing under it. A disc behind
 * it grounds the figure and separates it from the background without needing a
 * radial gradient, which Satori cannot draw.
 */
export function Hero({ src, size = 520 }: { src: string | null; size?: number }): ReactElement {
  if (!src) return <div style={{ display: 'flex' }} />;
  const disc = Math.round(size * 0.86);
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          background: 'rgba(53,208,255,0.10)',
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={size} height={size} alt="" style={{ objectFit: 'contain' }} />
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

