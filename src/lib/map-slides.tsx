import type { ReactElement } from 'react';

import { titleCase } from '@/lib/format';
import type { MapPost, MapPostEntry } from '@/lib/map-of-day';
import {
  ACCENT,
  BRAND,
  Card,
  DIM,
  DISPLAY,
  FG,
  Frame,
  MUTED,
  loadArt,
  loadIcon,
  loadLogo,
  loadSized,
  outro,
  withPips,
} from '@/lib/slide-chrome';
import { slugify } from '@/lib/slugs';

export { SLIDE_SIZE, slideFonts, toJpeg } from '@/lib/slide-chrome';

/**
 * The map of the day as a carousel: the mode, the map, its top ten.
 *
 * Built on the shared chrome in `slide-chrome` like every other carousel, and
 * under the same Satori rules: flexbox only, and every `div` with more than
 * one child needs an explicit `display: flex`.
 */

/** Names arrive from the API in capitals; the site title-cases them. */
const cap = (name: string) => titleCase(name);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const points = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n * 100).toFixed(1)}`;

const GREEN = '#63d471';
const RED = '#ff5c8a';

/** The mode's icon in a tile tinted with the mode's own colour. */
function ModeTile({ icon, color, size }: { icon: string | null; color: string; size: number }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size * 0.24,
        border: `3px solid ${color}88`,
        background: `linear-gradient(135deg, ${color}44, ${color}11)`,
      }}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} width={size * 0.72} height={size * 0.72} alt="" style={{ objectFit: 'contain' }} />
      ) : (
        <div style={{ display: 'flex' }} />
      )}
    </div>
  );
}

/** Slide one: which mode today is, said loudly enough to stop a scroll. */
function modeSlide(post: MapPost, icon: string | null): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 32, letterSpacing: 3, color: ACCENT }}>
        RANKED MAP OF THE DAY
      </div>

      <div style={{ display: 'flex', marginTop: 48 }}>
        <ModeTile icon={icon} color={post.modeColor} size={300} />
      </div>

      <div
        style={{
          display: 'flex',
          fontSize: 132,
          fontFamily: DISPLAY,
          fontWeight: 400,
          color: post.modeColor,
          marginTop: 40,
          lineHeight: 1,
        }}
      >
        {post.modeName}
      </div>
      <div style={{ display: 'flex', fontSize: 64, fontFamily: DISPLAY, fontWeight: 400, marginTop: 18 }}>
        Who to pick on
      </div>
      <div style={{ display: 'flex', fontSize: 64, fontFamily: DISPLAY, fontWeight: 400, color: BRAND }}>
        {`today's map`}
      </div>

      <div style={{ display: 'flex', fontSize: 34, color: ACCENT, marginTop: 48 }}>
        Swipe for the map and the top 10
      </div>
    </Frame>
  );
}

/** Slide two: the map itself, as large as the safe area allows. */
function mapSlide(
  post: MapPost,
  icon: string | null,
  art: { src: string; width: number; height: number } | null,
): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <ModeTile icon={icon} color={post.modeColor} size={72} />
        <div style={{ display: 'flex', fontSize: 40, letterSpacing: 2, color: post.modeColor }}>
          {post.modeName.toUpperCase()}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: post.mapName.length > 14 ? 84 : 100,
          fontFamily: DISPLAY,
          fontWeight: 400,
          marginTop: 14,
          lineHeight: 1.05,
        }}
      >
        {post.mapName}
      </div>

      {art ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 34,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={art.src}
            width={art.width}
            height={art.height}
            alt=""
            style={{ borderRadius: 26, border: `4px solid ${post.modeColor}66` }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', fontSize: 36, color: DIM, marginTop: 40 }}>
          Map artwork unavailable today
        </div>
      )}

      <div style={{ display: 'flex', fontSize: 30, color: DIM, marginTop: 30 }}>
        {`${post.sampleSize.toLocaleString('en-GB')} ranked battles here in the last ${post.windowDays} days`}
      </div>
    </Frame>
  );
}

/**
 * Slide three: the top ten, all on one slide.
 *
 * One slide rather than two fives, because the list is the thing people screen
 * shot and share, and half a list is not worth sharing. Ten rows fit inside
 * the safe area at a size that still reads on a phone.
 *
 * The number on the right is the map page's own: the adjusted win rate the
 * list is sorted by, and how far this map moves the brawler from its usual
 * Ranked form. A raw win rate beside a list sorted by something else invites
 * the reader to find a "mistake" that is not one.
 */
function topSlide(post: MapPost, icon: string | null, art: (string | null)[]): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <ModeTile icon={icon} color={post.modeColor} size={88} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', fontSize: 56, fontFamily: DISPLAY, fontWeight: 400, lineHeight: 1 }}>
            {post.mapName}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: DIM }}>
            {`Top 10 in Ranked · last ${post.windowDays} days`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 30 }}>
        {post.picks.map((row: MapPostEntry, i) => (
          <Card key={row.brawlerId} accent={i === 0 ? BRAND : row.rarityColor} lead={i < 3} pad="10px 22px">
            <div
              style={{
                display: 'flex',
                width: 58,
                fontSize: 42,
                fontFamily: DISPLAY,
                color: i === 0 ? BRAND : i < 3 ? FG : 'rgba(255,255,255,0.32)',
              }}
            >
              {i + 1}
            </div>

            {art[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art[i] as string} width={80} height={80} alt="" />
            ) : (
              <div style={{ display: 'flex', width: 80, height: 80 }} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 330, marginLeft: 18 }}>
              <div style={{ display: 'flex', fontSize: 38, fontFamily: DISPLAY, color: FG }}>
                {cap(row.name)}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: DIM }}>
                {`${row.battles.toLocaleString('en-GB')} battles here`}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0, width: 150 }}>
              <div style={{ display: 'flex', fontSize: 42, fontFamily: DISPLAY, color: i === 0 ? BRAND : ACCENT }}>
                {pct(row.score)}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: row.edge >= 0 ? GREEN : RED }}>
                {`${points(row.edge)} vs usual`}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Frame>
  );
}

/**
 * How the list is made, before the closing slide.
 *
 * The same job every carousel's method slide does: a list of names with no
 * stated method is an opinion, and the whole difference between this and any
 * other tier list is that the number can be checked.
 */
function method(post: MapPost): ReactElement {
  const lines = [
    `Ranked battles only, last ${post.windowDays} days`,
    `${post.sampleSize.toLocaleString('en-GB')} decided battles on this map`,
    'Win rate vs the Ranked average',
    'Thin samples lean on usual form',
    'A different map every day',
  ];

  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        HOW THIS IS RANKED
      </div>
      <div style={{ display: 'flex', fontSize: 74, fontFamily: DISPLAY, fontWeight: 400, marginTop: 14 }}>
        No opinions here
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
            <div style={{ display: 'flex', fontSize: 36, color: FG }}>{line}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 42 }}>
        Every Ranked map on brawlzone.net/ranked
      </div>
    </Frame>
  );
}

type Step = 'mode' | 'map' | 'top' | 'method' | 'outro';

/** Fixed, unlike the tier carousel: a post only exists with a full top ten. */
const STEPS: Step[] = ['mode', 'map', 'top', 'method', 'outro'];

export function mapSlideCount(post: MapPost | null): number {
  return post ? STEPS.length : 0;
}

export async function mapSlides(post: MapPost, only?: number): Promise<ReactElement[]> {
  const wanted = (kind: Step) => only === undefined || STEPS[only] === kind;

  // Only the artwork the requested slide draws: each slide is its own request,
  // and ten portraits fetched for the mode slide are ten wasted CDN round trips.
  const [icon, art, portraits, logo] = await Promise.all([
    (wanted('mode') || wanted('map') || wanted('top')) && post.modeIconUrl
      ? loadIcon(post.modeIconUrl, 300)
      : Promise.resolve(null),
    wanted('map') && post.mapArtUrl ? loadSized(post.mapArtUrl, 796, 1060) : Promise.resolve(null),
    wanted('top')
      ? Promise.all(post.picks.map((p) => loadArt(p.brawlerId, 96, p.imageUrl)))
      : Promise.resolve<(string | null)[]>([]),
    wanted('outro') ? loadLogo(208) : Promise.resolve(null),
  ]);

  return withPips(
    STEPS.map((step) => {
      switch (step) {
        case 'mode':
          return modeSlide(post, icon);
        case 'map':
          return mapSlide(post, icon, art);
        case 'top':
          return topSlide(post, icon, portraits);
        case 'method':
          return method(post);
        default:
          return outro(logo);
      }
    }),
  );
}

/** The caption, built from the same numbers the slides draw. */
export function mapCaption(post: MapPost, site: string): { title: string; description: string } {
  const top3 = post.picks
    .slice(0, 3)
    .map((p, i) => `${i + 1}. ${cap(p.name)}`)
    .join(', ');
  const modeTag = `#brawlstars${slugify(post.modeName).replace(/-/g, '')}`;

  return {
    title: `Best brawlers for ${post.mapName} (${post.modeName})`.slice(0, 90),
    description:
      `Who to pick on ${post.mapName} in Ranked: ${top3}. All ten in the slides, from ` +
      `${post.sampleSize.toLocaleString('en-GB')} decided Ranked battles on this map over the last ` +
      `${post.windowDays} days. A different map every day. Full ranking: ${site}${post.mapPath ?? '/ranked'} ` +
      `#brawlstars #brawlstarsranked #brawlstarsmeta ${modeTag} #brawlstarstips`,
  };
}
