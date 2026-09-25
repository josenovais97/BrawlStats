import type { ReactElement } from 'react';
import sharp from 'sharp';

import { dayLabel } from '@/lib/format';
import { brawlerModelUrl, brawlerPortraitUrl } from '@/lib/brawlapi';
import { SITE_NAME } from '@/lib/site';
import type { Discovery, StoredDailyReport } from '@/lib/stats';

/**
 * The day's findings as a TikTok photo carousel.
 *
 * One image per idea, rather than one image with every idea on it. The single
 * card this replaced put a date, three headlines, three kickers and three
 * detail lines on one 1080x1920 frame; at the size a post is actually first
 * seen — a thumbnail in a feed — none of it was legible, so the whole thing
 * read as a wall of small text. A carousel costs nothing extra to publish
 * (`photo_images` takes up to 35 URLs) and lets each finding have the type
 * size it needs.
 *
 * What makes a finding credible is the evidence behind it, and the old card
 * never showed any: `sampleSize` is on every Discovery and went unrendered.
 * Every finding slide now states how many battles it is drawn from, and the
 * closing slide says how the sampling works.
 *
 * Satori: flexbox and a subset of CSS only. No grid, no custom properties, no
 * Tailwind, and every `div` with more than one child needs an explicit
 * `display: flex`.
 */

export const SLIDE_SIZE = { width: 1080, height: 1920 };

const BG = '#0b0f1d';
const FG = '#f2f5ff';
const MUTED = '#c9d2ea';
const DIM = '#8b95b8';
const ACCENT = '#35d0ff';
const BRAND = '#ffc53d';

/**
 * TikTok draws its own UI over a post: caption and username across the bottom,
 * a column of like/comment/share buttons up the right. Content sits inside
 * these margins rather than being centred on the canvas.
 */
const PAD = '150px 230px 400px 92px';

/** At most three. A fourth finding is a fourth slide nobody swipes to. */
export const MAX_FINDINGS = 3;

/** The claim, in the fewest words that still say what was found. */
const HEADLINE: Record<string, (names: string[], context?: string) => string> = {
  'secret-pick': ([a]) => `Nobody picks ${a}`,
  'meta-trap': ([a]) => `${a} is everywhere`,
  'giant-killer': ([a, b]) => `${a} owns ${b}`,
  'secret-duo': ([a, b]) => `${a} + ${b}`,
  'map-surprise': ([a], context) => `${a} on ${context ?? 'one map'}`,
  'overnight-rise': ([a]) => `${a} is climbing`,
};

/** The turn — what makes the headline worth reading. */
const KICKER: Record<string, string> = {
  'secret-pick': 'and it is winning anyway',
  'meta-trap': 'and it is losing',
  'giant-killer': 'harder than anything else does',
  'secret-duo': 'win far more together than apart',
  'map-surprise': 'is a different brawler there',
  'overnight-rise': 'faster than the whole roster',
};

/** What the two brawlers on a pair slide are to each other. */
const PAIR_GLYPH: Record<string, string> = {
  'giant-killer': 'vs',
  'secret-duo': '+',
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const score = (n: number) => n.toFixed(1);

function cap(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

interface Stat {
  figure: string;
  label: string;
}

/**
 * The two numbers a finding is about, each with the label that makes it true.
 *
 * Worth reading against how `buildDiscoveries` fills `value` and `comparison`,
 * because they do not mean the same thing across kinds and the single-card
 * version got one of them wrong. `giant-killer` is the *enemy* side of
 * `brawler_pair_daily` — A's win rate when B is on the other team, against A's
 * own overall rate. It was labelled "together / apart", which is the ally
 * side's story told about the enemy side's number.
 *
 * `overnight-rise` carries meta scores, not rates, so it is the one kind that
 * must not be rendered as a percentage.
 */
function statsFor(d: Discovery): [Stat, Stat] {
  const names = d.brawlerNames.map(cap);
  switch (d.kind) {
    case 'secret-pick':
    case 'meta-trap':
      return [
        { figure: pct(d.value), label: 'win rate' },
        { figure: pct(d.comparison), label: 'pick rate' },
      ];
    case 'giant-killer':
      return [
        { figure: pct(d.value), label: `vs ${names[1] ?? 'them'}` },
        { figure: pct(d.comparison), label: 'overall' },
      ];
    case 'secret-duo':
      return [
        { figure: pct(d.value), label: `with ${names[1] ?? 'them'}` },
        { figure: pct(d.comparison), label: 'overall' },
      ];
    case 'map-surprise':
      return [
        { figure: pct(d.value), label: `on ${d.context ?? 'this map'}` },
        { figure: pct(d.comparison), label: 'overall' },
      ];
    case 'overnight-rise':
      return [
        { figure: score(d.value), label: 'meta score' },
        { figure: score(d.comparison), label: 'yesterday' },
      ];
    default:
      return [
        { figure: pct(d.value), label: 'rate' },
        { figure: pct(d.comparison), label: 'baseline' },
      ];
  }
}

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
async function loadArt(brawlerId: number, box: number): Promise<string | null> {
  for (const url of [brawlerModelUrl(brawlerId), brawlerPortraitUrl(brawlerId)]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const png = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      // Next candidate, then none. A slide without art is still a slide.
    }
  }
  return null;
}

/** The full-bleed wash every slide sits on. Linear: Satori has no radial. */
function Backdrop(): ReactElement {
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

function Frame({ children }: { children: ReactElement[] }): ReactElement {
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

function Wordmark(): ReactElement {
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

function cover(date: string, findings: Discovery[], art: string | null): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 32, letterSpacing: 3, color: ACCENT }}>
          {dayLabel(date).toUpperCase()}
        </div>
        <div style={{ display: 'flex', fontSize: 108, fontWeight: 800, marginTop: 14 }}>
          What we
        </div>
        <div style={{ display: 'flex', fontSize: 108, fontWeight: 800 }}>found today</div>
        <div style={{ display: 'flex', fontSize: 36, color: MUTED, marginTop: 24 }}>
          {findings.length > 0
            ? `${findings.length} finding${findings.length === 1 ? '' : 's'} from sampled battles`
            : 'Measured from sampled battles, not opinion'}
        </div>
      </div>

      {/* Centred rather than pinned right: the right margin is TikTok's button
          column, and art pushed into it gets a heart drawn over its face. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 520,
          marginTop: 44,
        }}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={500} height={500} alt="" style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 20 }}>
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: ACCENT }}>
          {findings.length > 0 ? `Swipe for all ${findings.length}` : 'Fresh numbers every day'}
        </div>
        <Wordmark />
      </div>
    </Frame>
  );
}

function finding(
  d: Discovery,
  index: number,
  total: number,
  art: (string | null)[],
): ReactElement {
  const names = d.brawlerNames.map(cap);
  const [a, b] = statsFor(d);
  const shown = art.filter((src): src is string => src !== null);
  const glyph = PAIR_GLYPH[d.kind] ?? '';

  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        {`FINDING ${index + 1} OF ${total}`}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, height: 380, marginTop: 24 }}>
        {shown.map((src, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {i > 0 && glyph ? (
              <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: DIM }}>
                {glyph}
              </div>
            ) : (
              <div style={{ display: 'flex' }} />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} width={340} height={340} alt="" style={{ objectFit: 'contain' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', fontSize: 78, fontWeight: 800, marginTop: 28 }}>
        {HEADLINE[d.kind]?.(names, d.context) ?? names.join(' and ')}
      </div>
      <div style={{ display: 'flex', fontSize: 44, color: MUTED, marginTop: 14 }}>
        {KICKER[d.kind] ?? ''}
      </div>

      <div style={{ display: 'flex', gap: 64, marginTop: 56 }}>
        {[a, b].map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 96,
                fontWeight: 800,
                color: i === 0 ? ACCENT : FG,
              }}
            >
              {s.figure}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: DIM }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* The evidence line. A number with no sample behind it is a claim. */}
      <div style={{ display: 'flex', fontSize: 32, color: DIM, marginTop: 44 }}>
        {`from ${d.sampleSize.toLocaleString('en-GB')} decided battles`}
      </div>
    </Frame>
  );
}

function method(): ReactElement {
  const lines = [
    'Battle logs sampled every 2 hours',
    'Rolled up over a 14-day window',
    'Sample floors on every number',
  ];
  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        HOW WE MEASURE
      </div>
      <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, marginTop: 18 }}>
        No opinions.
      </div>
      <div style={{ display: 'flex', fontSize: 88, fontWeight: 800 }}>Just battles.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 34, marginTop: 56 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div
              style={{
                display: 'flex',
                width: 10,
                alignSelf: 'stretch',
                minHeight: 48,
                borderRadius: 4,
                background: ACCENT,
              }}
            />
            <div style={{ display: 'flex', fontSize: 42, color: MUTED }}>{line}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', marginTop: 72 }}>
        <Wordmark />
      </div>
    </Frame>
  );
}

/**
 * Which findings' artwork a given slide actually draws.
 *
 * The cover uses the first finding's art; finding slide k uses finding k-1's;
 * the closing slide uses none. Without this every request for any one slide
 * fetched and resized the art for all three findings and then threw away the
 * elements it did not need — a five-slide day doing twenty CDN round trips and
 * twenty sharp resizes to produce five images. The box has two shared cores
 * and the posting job fetches all five in a row, so this is the difference
 * between a quick sequence and a visible stall.
 */
function artNeededBy(only: number | undefined, findingCount: number): Set<number> {
  if (only === undefined) return new Set(findingCount > 0 ? [...Array(findingCount).keys()] : []);
  if (only === 0) return findingCount > 0 ? new Set([0]) : new Set();
  if (only >= 1 && only <= findingCount) return new Set([only - 1]);
  return new Set();
}

/**
 * Every slide for a day, in carousel order: cover, one per finding, method.
 *
 * Returned as elements rather than rendered here so that both the image route
 * and the manifest route agree on how many there are without either of them
 * rasterising anything. `only` narrows the artwork loaded to what that one
 * slide draws; the other elements are still built, because the caller indexes
 * into the array and the count has to stay right.
 */
export async function dailySlides(
  date: string,
  report: StoredDailyReport | null,
  only?: number,
): Promise<ReactElement[]> {
  const findings = (report?.discoveries ?? []).slice(0, MAX_FINDINGS);
  const needed = artNeededBy(only, findings.length);

  const art = await Promise.all(
    findings.map((d, i) =>
      needed.has(i)
        ? Promise.all(d.brawlerIds.slice(0, 2).map((id) => loadArt(id, 700)))
        : Promise.resolve<(string | null)[]>([]),
    ),
  );

  return [
    cover(date, findings, art[0]?.[0] ?? null),
    ...findings.map((d, i) => finding(d, i, findings.length, art[i] ?? [])),
    method(),
  ];
}

/** How many slides a day has, without loading any artwork to find out. */
export function slideCount(report: StoredDailyReport | null): number {
  return Math.min(report?.discoveries.length ?? 0, MAX_FINDINGS) + 2;
}

/** PNG from Satori to JPEG, which is the only thing TikTok accepts. */
export async function toJpeg(png: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(png))
    .flatten({ background: BG })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();
}
