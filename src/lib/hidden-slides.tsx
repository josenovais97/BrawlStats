import type { ReactElement } from 'react';

import { titleCase } from '@/lib/format';
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

type Step = 'cover' | 'sleepers' | 'overrated' | 'gems' | 'traps' | 'method' | 'outro';

/**
 * Which sections today has. An empty one is left out rather than rendered
 * saying nothing -- a week where nobody is being slept on is a real answer,
 * and the page says the same thing in words.
 */
function plan(data: HiddenMeta): Step[] {
  const out: Step[] = ['cover'];
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

  const [coverArt, sleeperArt, overratedArt, gemArt, trapArt, logo] = await Promise.all([
    wanted('cover') && data.sleepers[0]
      ? loadArt(data.sleepers[0].brawlerId, 560, data.sleepers[0].imageUrl)
      : Promise.resolve(null),
    wanted('sleepers') ? portraits(data.sleepers) : Promise.resolve<(string | null)[]>([]),
    wanted('overrated') ? portraits(data.overrated) : Promise.resolve<(string | null)[]>([]),
    wanted('gems') ? portraits(data.gems) : Promise.resolve<(string | null)[]>([]),
    wanted('traps') ? portraits(data.traps) : Promise.resolve<(string | null)[]>([]),
    wanted('cover') || wanted('outro') ? loadLogo(208) : Promise.resolve(null),
  ]);

  return withPips(
    steps.map((step) => {
      switch (step) {
        case 'cover':
          return cover(data, coverArt, logo);
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
