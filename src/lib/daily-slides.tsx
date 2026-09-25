import type { ReactElement } from 'react';

import { dayLabel } from '@/lib/format';
import {
  ACCENT,
  DIM,
  FG,
  Frame,
  MUTED,
  Wordmark,
  loadArt,
  loadLogo,
  outro,
} from '@/lib/slide-chrome';
import type { Discovery, StoredDailyReport } from '@/lib/stats';

export { SLIDE_SIZE, toJpeg } from '@/lib/slide-chrome';

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


/**
 * Every finding the day produced, not the first three.
 *
 * The single card took three because a fourth cost every other one its type
 * size. A carousel has no such trade -- each finding has its own frame -- and
 * keeping the cap was actively harmful, because `buildDiscoveries` pushes in a
 * fixed KIND order rather than by strength: secret-pick, meta-trap,
 * giant-killer, secret-duo, map-surprise, overnight-rise. Slicing to three did
 * not take the three best findings, it discarded the last three kinds every
 * single day, whatever they said.
 *
 * Six is the number of kinds that exist, so this is a ceiling rather than a
 * cut. TikTok allows 35 images.
 */
export const MAX_FINDINGS = 6;

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
          height: art ? 520 : 0,
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

      {/* No wordmark here: the slide immediately after this one is nothing but
          the wordmark, and repeating it two frames apart reads as a loop. */}
      <div style={{ display: 'flex', fontSize: 34, color: DIM, marginTop: 64 }}>
        That is where every number you just read comes from.
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

  // The logo is only drawn on the last slide, so it is only read when that
  // slide is the one being rendered.
  const wantsLogo = only === undefined || only === findings.length + 2;

  const [art, logo] = await Promise.all([
    Promise.all(
      findings.map((d, i) =>
        needed.has(i)
          ? Promise.all(d.brawlerIds.slice(0, 2).map((id) => loadArt(id, 700)))
          : Promise.resolve<(string | null)[]>([]),
      ),
    ),
    wantsLogo ? loadLogo(208) : Promise.resolve(null),
  ]);

  return [
    cover(date, findings, art[0]?.[0] ?? null),
    ...findings.map((d, i) => finding(d, i, findings.length, art[i] ?? [])),
    method(),
    outro(logo),
  ];
}

/**
 * How many slides a day has, without loading any artwork to find out.
 *
 * Findings, plus the cover, the method slide and the closing slide.
 */
export function slideCount(report: StoredDailyReport | null): number {
  return Math.min(report?.discoveries.length ?? 0, MAX_FINDINGS) + 3;
}

/**
 * Hashtags chosen from what the day actually found.
 *
 * The job posted four fixed tags every day forever, which is both a wasted
 * signal and the most obviously automated thing about the account. Two broad
 * tags carry the reach; the narrow ones are where a small account can
 * realistically rank, and they are the ones worth matching to the content.
 */
const KIND_TAGS: Record<string, string> = {
  'secret-pick': '#brawlstarstips',
  'meta-trap': '#brawlstarsmeta',
  'giant-killer': '#brawlstarsdraft',
  'secret-duo': '#brawlstarsdraft',
  'map-surprise': '#brawlstarsmaps',
  'overnight-rise': '#brawlstarsranked',
};

const BASE_TAGS = ['#brawlstars', '#brawlstarstierlist'];

/**
 * The caption, built from the same findings the slides draw.
 *
 * Published by the manifest rather than assembled on the box: it is made of
 * the day's numbers, and deriving it a second time in bash would be two
 * implementations of one claim that disagree the moment either changes. The
 * numbers go in the text as well as on the images because TikTok indexes
 * caption text and does not read pictures.
 */
export function dailyCaption(
  report: StoredDailyReport | null,
  site: string,
): { title: string; description: string } {
  const findings = (report?.discoveries ?? []).slice(0, MAX_FINDINGS);
  const names = (d: Discovery) => d.brawlerNames.map(cap);
  const line = (d: Discovery) => HEADLINE[d.kind]?.(names(d), d.context) ?? names(d).join(' and ');

  const tags = [
    ...BASE_TAGS,
    ...[...new Set(findings.map((d) => KIND_TAGS[d.kind]).filter(Boolean))].slice(0, 3),
  ];

  const title = findings[0] ? line(findings[0]) : 'What the Brawl Stars data says today';

  // findings[1..] rather than [0..]: TikTok renders title and description
  // together, so repeating the first line prints it twice.
  const rest = findings.slice(1).map(line);
  const body = rest.length > 0 ? rest.join(' | ') : 'Measured from sampled Brawl Stars battles.';

  return {
    title: title.slice(0, 90),
    description: `${body} — full findings at ${site}/daily ${tags.join(' ')}`.slice(0, 3900),
  };
}
