import type { ReactElement } from 'react';

import { titleCase } from '@/lib/format';
import {
  type RadarCell,
  cellOf,
  deoverlap,
  isNamed,
  middleRadius,
  portraitRadius,
  radarScales,
} from '@/lib/meta-radar';
import type { HiddenMeta, HiddenPick, MapEdgePick } from '@/lib/hidden-meta';
import {
  ACCENT,
  BRAND,
  Bar,
  Card,
  DIM,
  DISPLAY,
  FG,
  Frame,
  Hero,
  MUTED,
  loadArt,
  loadLogo,
  outro,
  withPips,
} from '@/lib/slide-chrome';

export { SLIDE_SIZE, slideFonts, toJpeg } from '@/lib/slide-chrome';

/**
 * The hidden meta as a carousel: who is strong that nobody plays, who
 * everybody plays that is not, and the map-specific versions of both.
 *
 * The fourth daily post, and the one with the strongest hook. The other three
 * answer questions a viewer already knows they have -- what changed, what to
 * buy, who is strong. This one tells them something they did not know to ask,
 * which is the kind of thing a person sends to a friend.
 *
 * Every number comes from `getHiddenMeta`, the same function the page uses, so
 * a viewer who opens brawlzone.net after seeing this finds the same list. That
 * is not tidiness: a post and a page disagreeing is the one thing that makes
 * both look made up.
 */

const pct = (n: number | null) => (n === null ? '--' : `${(n * 100).toFixed(1)}%`);
const cap = (name: string) => titleCase(name);

/** Shown per section. Six fits; more shrinks the type past readable. */
const PER_SECTION = 5;

function cover(data: HiddenMeta, art: string | null, logo: string | null): ReactElement {
  const star = data.sleepers[0];
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 32, letterSpacing: 3, color: ACCENT }}>
          THE HIDDEN META
        </div>
        <div style={{ display: 'flex', fontSize: 112, fontFamily: DISPLAY, marginTop: 10 }}>
          Who is
        </div>
        <div style={{ display: 'flex', fontSize: 112, fontFamily: DISPLAY, color: BRAND }}>
          everyone
        </div>
        <div style={{ display: 'flex', fontSize: 112, fontFamily: DISPLAY }}>sleeping on</div>
      </div>

      <div style={{ display: 'flex', marginTop: 18 }}>
        <Hero src={art} size={440} />
      </div>

      {star ? (
        <div style={{ display: 'flex', fontSize: 40, color: MUTED, marginTop: 8 }}>
          {`${cap(star.brawlerName)} wins ${pct(star.winRate)} and nobody picks them`}
        </div>
      ) : (
        <div style={{ display: 'flex' }} />
      )}

      <div style={{ display: 'flex', fontSize: 34, color: ACCENT, marginTop: 26 }}>
        Swipe for all four lists
      </div>
      {logo ? <div style={{ display: 'flex' }} /> : <div style={{ display: 'flex' }} />}
    </Frame>
  );
}

/** A section of brawlers, with whichever number that section is actually about. */
function list(
  kicker: string,
  headline: string,
  subline: string,
  rows: HiddenPick[],
  art: (string | null)[],
  figure: (p: HiddenPick) => string,
  figureLabel: string,
  barOf: (p: HiddenPick) => number | null,
): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
          {kicker}
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontFamily: DISPLAY, marginTop: 10 }}>
          {headline}
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: DIM, marginTop: 10 }}>{subline}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 40 }}>
        {rows.slice(0, PER_SECTION).map((p, i) => (
          <Card key={p.brawlerId} accent={p.rarityColor} lead={i === 0} pad="20px 26px">
            {art[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art[i] as string} width={104} height={104} alt="" />
            ) : (
              <div style={{ display: 'flex', width: 104, height: 104 }} />
            )}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 396, marginLeft: 20 }}
            >
              <div style={{ display: 'flex', fontSize: 46, fontFamily: DISPLAY, color: FG }}>
                {cap(p.brawlerName)}
              </div>
              <Bar value={barOf(p)} width={350} color={p.rarityColor ?? ACCENT} />
              <div style={{ display: 'flex', fontSize: 26, color: DIM }}>
                {`${pct(p.winRate)} win · ${pct(p.usageRate)} picked`}
              </div>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}
            >
              <div style={{ display: 'flex', fontSize: 48, fontFamily: DISPLAY, color: ACCENT }}>
                {figure(p)}
              </div>
              <div style={{ display: 'flex', fontSize: 24, color: DIM }}>{figureLabel}</div>
            </div>
          </Card>
        ))}
      </div>
    </Frame>
  );
}

/** Map gems and traps, where the map matters as much as the brawler. */
function edges(
  kicker: string,
  headline: string,
  subline: string,
  rows: MapEdgePick[],
  art: (string | null)[],
  rising: boolean,
): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
          {kicker}
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontFamily: DISPLAY, marginTop: 10 }}>
          {headline}
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: DIM, marginTop: 10 }}>{subline}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 40 }}>
        {rows.slice(0, PER_SECTION).map((e, i) => (
          <Card key={`${e.brawlerId}-${e.mapName}`} accent={e.rarityColor} lead={i === 0} pad="20px 26px">
            {art[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art[i] as string} width={104} height={104} alt="" />
            ) : (
              <div style={{ display: 'flex', width: 104, height: 104 }} />
            )}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 396, marginLeft: 20 }}
            >
              <div style={{ display: 'flex', fontSize: 44, fontFamily: DISPLAY, color: FG }}>
                {cap(e.brawlerName)}
              </div>
              <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>
                {titleCase(e.mapName)}
              </div>
              <div style={{ display: 'flex', fontSize: 24, color: DIM }}>
                {`${e.sampleSize.toLocaleString('en-GB')} battles on this map`}
              </div>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 46,
                  fontFamily: DISPLAY,
                  color: rising ? '#63d471' : '#ff5c8a',
                }}
              >
                {`${e.edge > 0 ? '+' : ''}${(e.edge * 100).toFixed(1)}`}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: DIM }}>pts</div>
            </div>
          </Card>
        ))}
      </div>
    </Frame>
  );
}

function method(data: HiddenMeta): ReactElement {
  const lines = [
    `${data.rated} brawlers with enough ranked battles to judge`,
    'At least 300 decided battles each',
    'Cut-offs are percentiles, not fixed numbers',
    'Map gaps measured against the brawler itself',
    'Only maps in rotation right now',
  ];
  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        WHY BELIEVE THIS
      </div>
      <div style={{ display: 'flex', fontSize: 74, fontFamily: DISPLAY, marginTop: 14 }}>
        It is measured
      </div>
      <div style={{ display: 'flex', fontSize: 34, color: DIM, marginTop: 14 }}>
        {`Last ${data.windowDays} days of sampled ranked battles`}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          marginTop: 48,
          padding: '38px 34px',
          borderRadius: 28,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                width: 14,
                height: 14,
                borderRadius: 7,
                background: ACCENT,
                marginTop: 18,
              }}
            />
            <div style={{ display: 'flex', fontSize: 34, color: FG }}>{line}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 40 }}>
        Every number is on the site. Go and check.
      </div>
    </Frame>
  );
}

type Step = 'cover' | 'radar' | 'sleepers' | 'overrated' | 'gems' | 'traps' | 'method' | 'outro';

/**
 * Which sections today has. An empty one is left out rather than rendered
 * saying nothing -- a week where nobody is being slept on is a real answer,
 * and the page says the same thing in words.
 */
/* ----------------------------------------------------------------- radar -- */

/**
 * The plot, inside `Frame`'s padding.
 *
 * Taller than it is wide because the canvas is 9:16 and the first render left
 * roughly three hundred pixels of nothing between the plot and the footer.
 * Height is the dimension this format has spare, and spending it on the chart
 * is what makes a face readable at arm's length.
 */
const RADAR_W = 796;
const RADAR_H = 980;

/**
 * Space kept clear inside each corner for its title.
 *
 * Larger than the site's 30px because everything here is scaled up: at 34 the
 * out-of-favour cluster still printed over its own label, since the strip has
 * to clear the *radius* of the portrait nearest it, not just its centre.
 */
const RADAR_LABEL_STRIP = 62;

const CELL_INK: Record<RadarCell, string> = {
  sleeper: '#35d07f',
  overrated: '#ff5c72',
  meta: BRAND,
  dead: DIM,
  middle: DIM,
};

/**
 * The hidden meta as one picture, before the lists that follow.
 *
 * The four sections after this are the four corners of this plot, and a
 * carousel is the one place that relationship can actually be shown: slide two
 * is the shape, slides three to six are the names in it. A viewer who swipes
 * away after this one has still learned the finding.
 *
 * Shares `meta-radar` with the page, which is the point rather than a
 * convenience. The cut lines are `getHiddenMeta`'s own percentiles, so a
 * brawler is in the sleepers corner here exactly when it is in the sleepers
 * corner on the site and in the list on the next slide. Three places agreeing
 * by construction rather than by maintenance.
 *
 * Built from absolutely positioned divs, not SVG. Satori lays out flexbox and
 * nothing else -- `<svg>`, `clipPath` and `<circle>` all render as nothing,
 * silently, which on a scatter plot means a slide that posts as an empty
 * frame.
 */
function radar(
  data: HiddenMeta,
  art: Map<number, string | null>,
): ReactElement {
  const scales = radarScales(data.points, data.cuts);
  if (!scales) {
    // No points to place. Returns an empty frame rather than throwing, so one
    // thin day cannot take the whole carousel down.
    return (
      <Frame>
        <div style={{ display: 'flex' }} />
        <div style={{ display: 'flex' }} />
      </Frame>
    );
  }

  const maxSample = Math.max(...data.points.map((p) => p.sampleSize), 1);
  const x = (usage: number) => scales.x.at(usage) * RADAR_W;
  const y = (score: number) => (1 - scales.y.at(score)) * RADAR_H;

  const xLow = x(data.cuts.lowUsage);
  const xHigh = x(data.cuts.highUsage);
  const yStrong = y(data.cuts.strong);
  const yWeak = y(data.cuts.weak);

  const boundsFor = (cell: RadarCell) => {
    switch (cell) {
      case 'sleeper':
        return { x0: 0, y0: RADAR_LABEL_STRIP, x1: xLow, y1: yStrong };
      case 'meta':
        return { x0: xHigh, y0: RADAR_LABEL_STRIP, x1: RADAR_W, y1: yStrong };
      case 'dead':
        return { x0: 0, y0: yWeak, x1: xLow, y1: RADAR_H - RADAR_LABEL_STRIP };
      case 'overrated':
        return { x0: xHigh, y0: yWeak, x1: RADAR_W, y1: RADAR_H - RADAR_LABEL_STRIP };
      default:
        return null;
    }
  };

  const prepared = data.points.map((p) => {
    const cell = cellOf(p, data.cuts);
    const named = isNamed(cell);
    return {
      p,
      cell,
      named,
      /*
       * Faces only in the named corners, which is where this parts company
       * with the site. The page is explored; a slide is read in about three
       * seconds at arm's length, and eighty-five portraits at this size is a
       * texture rather than an answer. The middle stays as dots so the
       * thirty-four that carry the finding are the thirty-four you see.
       */
      face: named ? art.get(p.brawlerId) ?? null : null,
      r: named ? portraitRadius(p.sampleSize, maxSample) * 2.1 : middleRadius(p.sampleSize, maxSample) * 1.2,
    };
  });

  const nudged = new Map(
    deoverlap(
      prepared
        .filter((q) => q.face)
        .map((q) => ({
          id: q.p.brawlerId,
          x: x(q.p.usageRate ?? 0),
          y: y(q.p.metaScore),
          r: q.r,
          bounds: boundsFor(q.cell),
        })),
    ).map((q) => [q.id, q]),
  );

  const placed = prepared
    .map((q) => {
      const moved = nudged.get(q.p.brawlerId);
      return { ...q, cx: moved?.x ?? x(q.p.usageRate ?? 0), cy: moved?.y ?? y(q.p.metaScore) };
    })
    // Named last, so a collision is survived by the brawler being argued about.
    .sort((a, b) => Number(a.named) - Number(b.named));

  const band = (
    left: number,
    top: number,
    width: number,
    height: number,
    colour: string,
  ): ReactElement => (
    <div
      key={`${left}-${top}-${colour}`}
      style={{
        display: 'flex',
        position: 'absolute',
        left,
        top,
        width: Math.max(0, width),
        height: Math.max(0, height),
        background: colour,
        opacity: 0.1,
      }}
    />
  );

  const rule = (left: number, top: number, width: number, height: number): ReactElement => (
    <div
      key={`rule-${left}-${top}`}
      style={{
        display: 'flex',
        position: 'absolute',
        left,
        top,
        width,
        height,
        background: 'rgba(255,255,255,0.28)',
      }}
    />
  );

  const corner = (
    left: number,
    top: number,
    label: string,
    colour: string,
    align: 'flex-start' | 'flex-end',
  ): ReactElement => (
    <div
      key={label}
      style={{
        display: 'flex',
        position: 'absolute',
        left,
        top,
        width: 300,
        justifyContent: align,
        fontSize: 26,
        letterSpacing: 2,
        fontWeight: 700,
        color: colour,
      }}
    >
      {label.toUpperCase()}
    </div>
  );

  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        THE WHOLE ROSTER
      </div>
      <div style={{ display: 'flex', fontSize: 74, fontFamily: DISPLAY, marginTop: 12 }}>
        Who wins, who gets picked
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: DIM, marginTop: 10, marginBottom: 22 }}>
        {`${data.rated} brawlers · last ${data.windowDays} days of ranked battles`}
      </div>

      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: RADAR_W,
          height: RADAR_H,
          borderRadius: 24,
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        {band(0, 0, xLow, yStrong, '#35d07f')}
        {band(xHigh, 0, RADAR_W - xHigh, yStrong, BRAND)}
        {band(0, yWeak, xLow, RADAR_H - yWeak, DIM)}
        {band(xHigh, yWeak, RADAR_W - xHigh, RADAR_H - yWeak, '#ff5c72')}

        {/*
          The cuts. Solid hairlines, because Satori will not draw a dashed
          border — and drawn through `rule` rather than `band` because the
          bands carry 10% opacity, which on a 2px line is invisible on a phone.
        */}
        {[xLow, xHigh].map((v) => rule(v, 0, 2, RADAR_H))}
        {[yStrong, yWeak].map((v) => rule(0, v, RADAR_W, 2))}

        {corner(14, 10, 'Sleepers', '#35d07f', 'flex-start')}
        {corner(RADAR_W - 314, 10, 'Meta', BRAND, 'flex-end')}
        {corner(14, RADAR_H - 44, 'Out of favour', DIM, 'flex-start')}
        {corner(RADAR_W - 314, RADAR_H - 44, 'Overrated', '#ff5c72', 'flex-end')}

        {placed.map(({ p, cell, face, r, cx, cy }) => (
          <div
            key={p.brawlerId}
            style={{
              display: 'flex',
              position: 'absolute',
              left: cx - r,
              top: cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              overflow: 'hidden',
              background: face ? 'rgba(10,14,28,0.9)' : CELL_INK[cell],
              opacity: face ? 1 : 0.35,
              border: face ? `3px solid ${CELL_INK[cell]}` : '0px solid transparent',
            }}
          >
            {face ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={face} width={r * 2} height={r * 2} alt="" style={{ objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', fontSize: 28, color: DIM, marginTop: 18 }}>
        {`Left is rarely picked · right is everywhere · higher wins more`}
      </div>
    </Frame>
  );
}

function plan(data: HiddenMeta): Step[] {
  const out: Step[] = ['cover'];
  /*
   * Second, before the lists it summarises. The four sections that follow are
   * the four corners of this plot, so the shape lands first and the names fill
   * it in -- and a viewer who swipes away after slide two has still been told
   * the finding.
   *
   * Needs enough points to be a picture rather than a scatter of three.
   */
  if (data.points.length >= 20) out.push('radar');
  if (data.sleepers.length > 0) out.push('sleepers');
  if (data.overrated.length > 0) out.push('overrated');
  if (data.gems.length > 0) out.push('gems');
  if (data.traps.length > 0) out.push('traps');
  out.push('method', 'outro');
  return out;
}

export function hiddenSlideCount(data: HiddenMeta | null): number {
  // Nothing to say without at least one of the four lists.
  if (!data) return 0;
  const steps = plan(data);
  return steps.length > 2 ? steps.length : 0;
}

export async function hiddenSlides(data: HiddenMeta, only?: number): Promise<ReactElement[]> {
  const steps = plan(data);
  const wanted = (kind: Step) => only === undefined || steps[only] === kind;

  const portraits = (rows: { brawlerId: number; imageUrl: string | null }[]) =>
    Promise.all(rows.slice(0, PER_SECTION).map((r) => loadArt(r.brawlerId, 128, r.imageUrl)));

  /*
   * Only the named corners, which is where the slide parts company with the
   * page. It is also what keeps this affordable: thirty-four portraits inlined
   * as data URIs rather than eighty-five, on a render that already carries five
   * other slides' art.
   */
  const radarNamed = wanted('radar')
    ? data.points.filter((p) => isNamed(cellOf(p, data.cuts)))
    : [];

  const [coverArt, sleeperArt, overratedArt, gemArt, trapArt, radarArt, logo] = await Promise.all([
    wanted('cover') && data.sleepers[0]
      ? loadArt(data.sleepers[0].brawlerId, 560, data.sleepers[0].imageUrl)
      : Promise.resolve(null),
    wanted('sleepers') ? portraits(data.sleepers) : Promise.resolve<(string | null)[]>([]),
    wanted('overrated') ? portraits(data.overrated) : Promise.resolve<(string | null)[]>([]),
    wanted('gems') ? portraits(data.gems) : Promise.resolve<(string | null)[]>([]),
    wanted('traps') ? portraits(data.traps) : Promise.resolve<(string | null)[]>([]),
    Promise.all(radarNamed.map((p) => loadArt(p.brawlerId, 128, p.imageUrl))),
    wanted('cover') || wanted('outro') ? loadLogo(208) : Promise.resolve(null),
  ]);

  const radarFaces = new Map(radarNamed.map((p, i) => [p.brawlerId, radarArt[i]]));

  return withPips(
    steps.map((step) => {
      switch (step) {
        case 'cover':
          return cover(data, coverArt, logo);
        case 'radar':
          return radar(data, radarFaces);
        case 'sleepers':
          return list(
            'SLEEPER PICKS',
            'Strong, ignored',
            `Under ${pct(data.cuts.lowUsage)} of players pick these`,
            data.sleepers,
            sleeperArt,
            (p) => p.metaScore.toFixed(1),
            'rating',
            (p) => p.winRate,
          );
        case 'overrated':
          return list(
            'OVERRATED',
            'Popular, losing',
            'Picked a lot, and the results do not follow',
            data.overrated,
            overratedArt,
            (p) => pct(p.usageRate),
            'picked',
            (p) => p.winRate,
          );
        case 'gems':
          return edges(
            'HIDDEN GEMS',
            'Map specialists',
            'Win-rate points above their own average',
            data.gems,
            gemArt,
            true,
          );
        case 'traps':
          return edges(
            'TRAP PICKS',
            'Wrong map',
            'Fine overall, losing points on these maps',
            data.traps,
            trapArt,
            false,
          );
        case 'method':
          return method(data);
        default:
          return outro(logo);
      }
    }),
  );
}

/** The caption, from the same numbers the slides draw. */
export function hiddenCaption(data: HiddenMeta, site: string): { title: string; description: string } {
  const star = data.sleepers[0];
  const dud = data.overrated[0];
  const parts: string[] = [];

  if (star) parts.push(`${cap(star.brawlerName)} wins ${pct(star.winRate)} at ${pct(star.usageRate)} pick rate`);
  if (dud) parts.push(`${cap(dud.brawlerName)} is picked ${pct(dud.usageRate)} and wins ${pct(dud.winRate)}`);
  if (data.gems[0]) {
    parts.push(
      `${cap(data.gems[0].brawlerName)} is +${(data.gems[0].edge * 100).toFixed(1)} pts on ${titleCase(data.gems[0].mapName)}`,
    );
  }

  return {
    title: star ? `Nobody is picking ${cap(star.brawlerName)}` : 'The hidden meta',
    description:
      `${parts.join(' | ')} — from ${data.rated} brawlers with enough ranked battles to judge. ` +
      `Full list at ${site}/hidden-meta ` +
      '#brawlstars #brawlstarsmeta #brawlstarstierlist #brawlstarstips #brawlstarsranked',
  };
}
