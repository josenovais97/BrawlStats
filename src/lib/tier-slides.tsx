import type { ReactElement } from 'react';

import { titleCase } from '@/lib/format';
import {
  ACCENT,
  BRAND,
  DIM,
  FG,
  Frame,
  MUTED,
  Wordmark,
  loadArt,
  loadLogo,
  outro,
} from '@/lib/slide-chrome';
import { PER_TIER, type TierMove, type TierPost, type TierPostEntry } from '@/lib/tier-of-day';
import type { Tier } from '@/types/stats';

export { SLIDE_SIZE, toJpeg } from '@/lib/slide-chrome';

/**
 * The tier list as a carousel, with the day's biggest riser and faller.
 *
 * Built on the shared chrome in `slide-chrome` for the reason given there: two
 * carousels carrying their own copies of the palette and the safe areas look
 * like two different accounts within a month.
 *
 * Satori, so flexbox only -- no grid, no custom properties -- and every `div`
 * with more than one child needs an explicit `display: flex`.
 */

const pct = (n: number | null) => (n === null ? '--' : `${(n * 100).toFixed(1)}%`);
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(2)}`;
const signedPct = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n * 100).toFixed(1)}pts`;

/** Names arrive from the API in capitals; the site title-cases them. */
const cap = (name: string) => titleCase(name);

/**
 * Tier colours, matching the site's own.
 *
 * A viewer who sees an S badge in the post and then opens the tier list should
 * see the same badge. Hard-coded rather than imported because the site's are
 * Tailwind classes and Satori cannot resolve those.
 */
const TIER_COLOR: Record<Tier, string> = {
  S: '#ff5c8a',
  A: '#ff9f43',
  B: '#ffd23f',
  C: '#63d471',
  D: '#4aa8ff',
  E: '#8b95b8',
  F: '#6b7394',
};

function Badge({ tier, size = 64 }: { tier: Tier; size?: number }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size / 4,
        background: TIER_COLOR[tier],
        color: '#0b0f1d',
        fontSize: size * 0.55,
        fontWeight: 800,
      }}
    >
      {tier}
    </div>
  );
}

function cover(post: TierPost, logo: string | null): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 32, letterSpacing: 3, color: ACCENT }}>
          RANKED TIER LIST
        </div>
        <div style={{ display: 'flex', fontSize: 118, fontWeight: 800, marginTop: 10 }}>
          Who is strong
        </div>
        <div style={{ display: 'flex', fontSize: 118, fontWeight: 800, color: BRAND }}>
          right now
        </div>
        <div style={{ display: 'flex', fontSize: 44, color: MUTED, marginTop: 20 }}>
          {`Plus the biggest riser and faller`}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          marginTop: 56,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={128} height={128} alt="" style={{ borderRadius: 28 }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: FG }}>
            {`${post.rated} brawlers ranked`}
          </div>
          <div style={{ display: 'flex', fontSize: 32, color: DIM }}>
            {`${post.battles.toLocaleString('en-GB')} decided battles · last ${post.windowLabel}`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', marginTop: 56 }}>
        <Wordmark />
      </div>
    </Frame>
  );
}

/**
 * One tier, as a list of brawlers with their portraits.
 *
 * The meta score sits beside each name rather than the win rate, because the
 * score is what the ordering is: showing a win rate next to a list sorted by
 * something else invites the reader to spot a "mistake" that is not one.
 */
function tierSlide(
  tier: Tier,
  entries: TierPostEntry[],
  art: (string | null)[],
  windowLabel: string,
  headline: string,
  subline: string,
): ReactElement {
  const shown = entries.slice(0, PER_TIER);
  const hidden = entries.length - shown.length;

  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Badge tier={tier} size={96} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', fontSize: 66, fontWeight: 800, color: FG }}>
            {headline}
          </div>
          <div style={{ display: 'flex', fontSize: 32, color: DIM }}>{subline}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 52 }}>
        {shown.map((row, i) => (
          <div
            key={row.brawlerId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              padding: '22px 26px',
              borderRadius: 24,
              background: i === 0 ? 'rgba(53,208,255,0.10)' : 'rgba(255,255,255,0.05)',
            }}
          >
            {art[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art[i] as string} width={96} height={96} alt="" />
            ) : (
              <div style={{ display: 'flex', width: 96, height: 96 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 380 }}>
              <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: FG }}>
                {cap(row.name)}
              </div>
              <div style={{ display: 'flex', fontSize: 28, color: DIM }}>
                {`${pct(row.winRate)} win · ${pct(row.usageRate)} picked`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: ACCENT }}>
                {row.metaScore.toFixed(1)}
              </div>
              <div style={{ display: 'flex', fontSize: 24, color: DIM }}>score</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', fontSize: 28, color: DIM, marginTop: 36 }}>
        {hidden > 0
          ? `${hidden} more in ${tier} tier · full list on brawlzone.net · last ${windowLabel}`
          : `Ranked battles over the last ${windowLabel}.`}
      </div>
    </Frame>
  );
}

/**
 * A mover, as a before-and-after.
 *
 * Both scores are shown, not just the delta. "+0.64" alone says nothing about
 * whether a brawler went from unplayable to fine or from strong to dominant,
 * and the tier badges either side are what make the move mean something.
 */
function mover(m: TierMove, art: string | null, rising: boolean): ReactElement {
  const colour = rising ? '#63d471' : '#ff5c8a';
  const crossed = m.tierNow !== m.tierBefore;

  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 32, letterSpacing: 3, color: ACCENT }}>
          {rising ? 'BIGGEST RISER' : 'BIGGEST FALLER'}
        </div>
        <div style={{ display: 'flex', fontSize: 110, fontWeight: 800, marginTop: 8 }}>
          {cap(m.name)}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: art ? 420 : 0,
          marginTop: 24,
        }}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={400} height={400} alt="" style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      {/* The move itself: tier before, tier now, and the score change. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          marginTop: 20,
          padding: '34px 28px',
          borderRadius: 28,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        <Badge tier={m.tierBefore} size={84} />
        {/* ASCII deliberately. Satori renders with the font ImageResponse
            bundles, and a glyph that font lacks comes out as a blank box --
            which is invisible in code review and obvious on the post. Only
            the middle dot is proven in a rendered string here (the wordmark
            has used one since the first carousel), so an arrow is not worth
            the risk when a chevron says the same thing. */}
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: DIM }}>&gt;</div>
        <Badge tier={m.tierNow} size={84} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 18 }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: colour }}>
            {signed(m.scoreDelta)}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: DIM }}>score</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 34 }}>
        <div style={{ display: 'flex', fontSize: 38, color: FG }}>
          {crossed
            ? `Moved from ${m.tierBefore} tier to ${m.tierNow} tier`
            : `Still ${m.tierNow} tier, but ${rising ? 'closing in' : 'slipping'}`}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: MUTED }}>
          {`Win rate ${signedPct(m.winRateDelta)} · now ${pct(m.winRateNow)}`}
        </div>
        {m.usageDelta !== null ? (
          <div style={{ display: 'flex', fontSize: 34, color: MUTED }}>
            {`Pick rate ${signedPct(m.usageDelta)} · now ${pct(m.usageNow)}`}
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      <div style={{ display: 'flex', fontSize: 28, color: DIM, marginTop: 32 }}>
        {`${m.sampleSize.toLocaleString('en-GB')} decided battles · ${m.fromDate} to ${m.toDate}`}
      </div>
    </Frame>
  );
}

/**
 * How the ranking is made, before the closing slide.
 *
 * The same job the findings carousel's method slide does: a list of names with
 * no stated method is an opinion, and the one thing that separates this from
 * every other tier list on the app store is that the number is reproducible.
 */
function method(post: TierPost): ReactElement {
  const lines = [
    `Ranked battles only, last ${post.windowLabel}`,
    `${post.battles.toLocaleString('en-GB')} decided battles sampled`,
    'Win rate adjusted against the mode baseline',
    'A brawler needs 20 decided battles to be ranked',
    'Score blends win rate with pick rate',
  ];

  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        HOW THIS IS RANKED
      </div>
      <div style={{ display: 'flex', fontSize: 74, fontWeight: 800, marginTop: 14 }}>
        No opinions
      </div>
      <div style={{ display: 'flex', fontSize: 34, color: DIM, marginTop: 14 }}>
        Measured from real battles, updated every 2 hours
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          marginTop: 52,
          padding: '38px 34px',
          borderRadius: 28,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: ACCENT }}
            />
            <div style={{ display: 'flex', fontSize: 36, color: FG }}>{line}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 42 }}>
        Same numbers the site shows. Check them yourself.
      </div>
    </Frame>
  );
}

type Step = 'cover' | 'top' | 'strong' | 'riser' | 'faller' | 'avoid' | 'method' | 'outro';

/**
 * Which slides today has, and in what order.
 *
 * Every section can legitimately be empty -- a week with nothing in F tier, a
 * quiet stretch with no mover clearing the floor -- and an empty section is
 * left out rather than rendered as a slide saying nothing. That is why the
 * count cannot be a constant, and why the manifest and the image route both
 * derive it from this one function instead of agreeing on a number.
 */
function plan(post: TierPost): Step[] {
  const out: Step[] = ['cover'];
  if (post.top.length > 0) out.push('top');
  if (post.strong.length > 0) out.push('strong');
  if (post.riser) out.push('riser');
  if (post.faller) out.push('faller');
  if (post.avoid.length > 0 && post.avoidTier) out.push('avoid');
  out.push('method', 'outro');
  return out;
}

export function tierSlideCount(post: TierPost | null): number {
  return post ? plan(post).length : 0;
}

export async function tierSlides(post: TierPost, only?: number): Promise<ReactElement[]> {
  const steps = plan(post);
  const wanted = (kind: Step) => only === undefined || steps[only] === kind;

  const portraits = (entries: TierPostEntry[]) =>
    Promise.all(
      entries.slice(0, PER_TIER).map((e) => loadArt(e.brawlerId, 128, e.imageUrl)),
    );

  // Only the artwork the requested slide draws. Loading every tier's
  // portraits for every slide turned an eight-slide day into fifty-odd CDN
  // round trips -- the same trap `build-slides` documents.
  const [topArt, strongArt, avoidArt, riserArt, fallerArt, logo] = await Promise.all([
    wanted('top') ? portraits(post.top) : Promise.resolve<(string | null)[]>([]),
    wanted('strong') ? portraits(post.strong) : Promise.resolve<(string | null)[]>([]),
    wanted('avoid') ? portraits(post.avoid) : Promise.resolve<(string | null)[]>([]),
    wanted('riser') && post.riser
      ? loadArt(post.riser.brawlerId, 560, post.riser.imageUrl)
      : Promise.resolve(null),
    wanted('faller') && post.faller
      ? loadArt(post.faller.brawlerId, 560, post.faller.imageUrl)
      : Promise.resolve(null),
    wanted('cover') || wanted('outro') ? loadLogo(208) : Promise.resolve(null),
  ]);

  return steps.map((step) => {
    switch (step) {
      case 'cover':
        return cover(post, logo);
      case 'top':
        return tierSlide('S', post.top, topArt, post.windowLabel, 'S tier', 'The strongest picks right now');
      case 'strong':
        return tierSlide('A', post.strong, strongArt, post.windowLabel, 'A tier', 'Strong, and easier to get');
      case 'riser':
        return mover(post.riser as TierMove, riserArt, true);
      case 'faller':
        return mover(post.faller as TierMove, fallerArt, false);
      case 'avoid':
        return tierSlide(
          post.avoidTier as Tier,
          post.avoid,
          avoidArt,
          post.windowLabel,
          `${post.avoidTier} tier`,
          'Think twice before picking these',
        );
      case 'method':
        return method(post);
      default:
        return outro(logo);
    }
  });
}

/** The caption, built from the same numbers the slides draw. */
export function tierCaption(post: TierPost, site: string): { title: string; description: string } {
  const best = post.top[0] ?? post.strong[0];
  const parts: string[] = [];

  if (best) parts.push(`${cap(best.name)} leads at ${best.metaScore.toFixed(1)}`);
  if (post.riser) parts.push(`${cap(post.riser.name)} up ${signed(post.riser.scoreDelta)}`);
  if (post.faller) parts.push(`${cap(post.faller.name)} down ${signed(post.faller.scoreDelta)}`);

  return {
    title: best ? `${cap(best.name)} tops the ranked tier list` : 'Ranked tier list update',
    description:
      `${parts.join(' | ')} — from ${post.battles.toLocaleString('en-GB')} decided ranked battles ` +
      `over the last ${post.windowLabel}. Full tier list at ${site}/tier-list/ranked ` +
      '#brawlstars #brawlstarstierlist #brawlstarsmeta #brawlstarsranked #brawlstarstips',
  };
}
