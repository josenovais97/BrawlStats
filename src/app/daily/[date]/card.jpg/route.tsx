import { ImageResponse } from 'next/og';
import sharp from 'sharp';

import { dayLabel } from '@/components/daily/daily-report';
import { SITE_NAME } from '@/lib/site';
import { type Discovery, getDailyReport } from '@/lib/stats';

/**
 * The day's findings as a 9:16 image, ready to post.
 *
 * Separate from `opengraph-image` next door, which is a 1200x630 link unfurl:
 * it exists to make a shared URL look like something, so it carries headlines
 * and no numbers. This one is the post itself — it goes to TikTok, Instagram
 * or anywhere else vertical, where nobody is clicking a link and the image has
 * to carry the whole claim on its own. So each finding gets its number, and
 * the domain sits under the findings because that is the only route back here.
 *
 * Served from a stable path rather than generated on the box, because the
 * posting APIs fetch the image themselves from a public URL.
 *
 * JPEG, not PNG, and that is not cosmetic: TikTok's Content Posting API
 * accepts JPEG and WebP only, and a PNG is taken, queued, and *then* failed
 * asynchronously as `file_format_check_failed` — the init call returns a
 * publish id and looks like success. `ImageResponse` only emits PNG, so the
 * bytes go through sharp on the way out. JPEG has no alpha, hence the flatten
 * onto the same background the card is drawn on; without it the transparent
 * areas come out black.
 *
 * Laid out for where it lands rather than for the canvas. TikTok draws its own
 * UI over the bottom of a post — caption, username, music — and a column of
 * buttons up the right-hand side, so the first version put "brawlzone.net"
 * exactly where the caption covers it, and left a third of the frame empty in
 * the middle. Everything now sits in a centred block clear of both, which also
 * lets the findings be the size they should have been.
 *
 * Satori: flexbox and a subset of CSS only. No grid, no custom properties, no
 * Tailwind, and every `div` with more than one child needs an explicit
 * `display: flex`.
 */

export const revalidate = 86400;

/* Runtime ISR. Without an empty `generateStaticParams` a dynamic segment is
   re-rendered per request however short its revalidate (AGENTS.md trap 1). */
export async function generateStaticParams() {
  return [];
}

const SIZE = { width: 1080, height: 1920 };

const BG = '#0b0f1d';
const FG = '#f2f5ff';
const MUTED = '#c9d2ea';
const DIM = '#8b95b8';
const ACCENT = '#35d0ff';
const BRAND = '#ffc53d';

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

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** The number under each finding, in the units that finding is about. */
function detail(d: Discovery): string {
  switch (d.kind) {
    case 'secret-pick':
      return `${pct(d.value)} win rate · picked ${pct(d.comparison)} of the time`;
    case 'meta-trap':
      return `${pct(d.value)} win rate · picked ${pct(d.comparison)} of the time`;
    case 'giant-killer':
    case 'secret-duo':
      return `${pct(d.value)} together · ${pct(d.comparison)} apart`;
    case 'map-surprise':
      return `${pct(d.value)} there · ${pct(d.comparison)} everywhere else`;
    case 'overnight-rise':
      return `${d.value.toFixed(1)} meta score, up from ${d.comparison.toFixed(1)}`;
    default:
      return `${pct(d.value)} over ${d.sampleSize.toLocaleString()} battles`;
  }
}

function cap(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const report = await getDailyReport(date).catch(() => null);

  /*
   * Three, not four. A vertical post is read at thumbnail size on a phone
   * before anyone decides to stop, and the fourth finding costs every other
   * one its type size.
   */
  const findings = (report?.discoveries ?? []).slice(0, 3);

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          // Generous on the right: that is where the like/comment/share column
          // sits. Deep at the bottom: caption and username.
          padding: '260px 260px 420px 96px',
          background: BG,
          color: FG,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Linear, not radial: Satori has no radial-gradient. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: SIZE.width,
            height: SIZE.height,
            background: `linear-gradient(160deg, rgba(53,208,255,0.18), rgba(11,15,29,0) 55%)`,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 34, letterSpacing: 3, color: ACCENT }}>
            {dayLabel(date).toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontSize: 100, fontWeight: 800, marginTop: 16 }}>
            What we
          </div>
          <div style={{ display: 'flex', fontSize: 100, fontWeight: 800 }}>found today</div>
          <div style={{ display: 'flex', fontSize: 34, color: DIM, marginTop: 20 }}>
            Measured from sampled battles, not opinion
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 52, marginTop: 72 }}>
          {findings.length > 0 ? (
            findings.map((d, i) => {
              const names = d.brawlerNames.map(cap);
              return (
                <div
                  key={`${d.kind}-${i}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        width: 10,
                        height: 66,
                        borderRadius: 4,
                        background: ACCENT,
                      }}
                    />
                    <div style={{ display: 'flex', fontSize: 62, fontWeight: 700 }}>
                      {HEADLINE[d.kind]?.(names, d.context) ?? names.join(' and ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', fontSize: 44, color: MUTED, marginLeft: 30 }}>
                    {KICKER[d.kind] ?? ''}
                  </div>
                  <div style={{ display: 'flex', fontSize: 34, color: DIM, marginLeft: 30 }}>
                    {detail(d)}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ display: 'flex', fontSize: 44, color: MUTED }}>
              Findings from sampled Brawl Stars battles
            </div>
          )}
        </div>

        {/* Immediately under the findings, not pinned to the bottom edge, so
            the one line that brings anybody back is never under a caption. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 88 }}>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: BRAND }}>
            brawlzone.net
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: DIM }}>
            {SITE_NAME} · free tier lists, maps and draft help
          </div>
        </div>
      </div>
    ),
    SIZE,
  );

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
    .flatten({ background: BG })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();

  /* 4:4:4 rather than the default 4:2:0 because the card is thin coloured
     text on a dark field, which is exactly what chroma subsampling smears. */
  return new Response(new Uint8Array(jpeg), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
