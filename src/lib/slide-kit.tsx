import type { ReactElement, ReactNode } from 'react';

import { DISPLAY } from '@/lib/slide-chrome';

/**
 * The second-generation look for the TikTok carousels (2026-10-13).
 *
 * The first generation was a dark slide with a narrow column of text down the
 * left: half of every canvas empty, the cover saying what was inside instead of
 * showing it, and type that read small on a phone. This is the app's own
 * game-menu style from 1.27 -- thick dark outlines, raised blue panels, gold
 * accents and Lilita One with an outline and a drop shadow -- built from
 * original shapes only. Nothing here is Supercell artwork or layout.
 *
 * Satori rules as before: flexbox only, and every `div` with more than one
 * child needs `display: flex`.
 */

/**
 * The design generation, carried on every slide URL as `?v=`. Cloudflare
 * caches slide images for a day by URL, so a redesign shipped mid-day would
 * otherwise post the old images; bump this with any visual change.
 */
export const SLIDE_DESIGN = 2;

export const W = 1080;
export const H = 1920;

/**
 * Where TikTok draws over a post: the tab bar along the top, the like/share
 * column down the right, and caption and username across the bottom. Content
 * fills what is left, edge to edge, rather than a column on one side of it.
 */
export const SAFE = { top: 236, right: 150, bottom: 400, left: 64 };
/** The brand tag, below TikTok's own tab bar (which ends near y=140). */
const BRAND_TOP = 150;
export const INNER_W = W - SAFE.left - SAFE.right;

export const OUTLINE = '#050a1f';
export const NAVY = '#0a1233';
export const PANEL_TOP = '#26398a';
export const PANEL = '#1a2759';
export const PANEL_DEPTH = '#0d1640';
export const GOLD = '#ffc53d';
export const GOLD_DEPTH = '#b86a00';
export const GREEN = '#35d07f';
export const RED = '#ff5c7a';
export const SKY = '#4fd2ff';
export const FG = '#f2f5ff';
export const MUTED = '#a9b6e0';

/** Rarity-free accents for rank badges: gold, silver, bronze, then plain. */
export const PODIUM = ['#ffc53d', '#d7def0', '#e0975a'];

/**
 * The stage every slide stands on: a glow in the slide's colour behind the
 * subject, a fan of soft light rays, and a vignette that weights the bottom.
 * Radial gradients work in this Satori build (checked 2026-10-13).
 */
export function Stage({
  glow = '#2c58ff',
  children,
  brand = true,
}: {
  glow?: string;
  children: ReactNode;
  brand?: boolean;
}): ReactElement {
  return (
    <div
      style={{
        width: W,
        height: H,
        display: 'flex',
        position: 'relative',
        background: NAVY,
        color: FG,
        fontFamily: DISPLAY,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: W,
          height: H,
          background: `radial-gradient(circle at 50% 34%, ${glow}cc 0%, ${glow}44 32%, ${NAVY} 62%, ${OUTLINE} 100%)`,
        }}
      />
      {/* Light rays: wide translucent bars fanned from the top centre. */}
      {[-38, -19, 0, 19, 38].map((deg) => (
        <div
          key={deg}
          style={{
            position: 'absolute',
            top: -300,
            left: W / 2 - 90,
            width: 180,
            height: 1700,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0))',
            transform: `rotate(${deg}deg)`,
            transformOrigin: '50% 0%',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          top: H - 700,
          left: 0,
          width: W,
          height: 700,
          background: `linear-gradient(180deg, rgba(5,10,31,0), ${OUTLINE}ee)`,
        }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: 14, background: GOLD }} />

      <div
        style={{
          position: 'absolute',
          top: SAFE.top,
          left: SAFE.left,
          width: INNER_W,
          height: H - SAFE.top - SAFE.bottom,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>

      {brand ? <BrandTag /> : null}
    </div>
  );
}

/**
 * The domain on every slide, at the top where TikTok's caption cannot cover
 * it: most viewers swipe two slides and leave, and this is how they find us.
 */
function BrandTag(): ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        top: BRAND_TOP,
        left: SAFE.left,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 22px 10px',
        borderRadius: 999,
        background: 'rgba(5,10,31,0.72)',
        border: `3px solid ${GOLD}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 34, color: GOLD }}>brawlzone.net</div>
    </div>
  );
}

/** A label stamped on at an angle, like a sticker on a game menu. */
export function Ribbon({
  children,
  color = GOLD,
  depth = GOLD_DEPTH,
  ink = '#1a1200',
  size = 46,
  tilt = -3,
}: {
  children: ReactNode;
  color?: string;
  depth?: string;
  ink?: string;
  size?: number;
  tilt?: number;
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        padding: `${Math.round(size * 0.22)}px ${Math.round(size * 0.6)}px ${Math.round(size * 0.3)}px`,
        borderRadius: 18,
        background: color,
        color: ink,
        fontSize: size,
        letterSpacing: 1,
        border: `5px solid ${OUTLINE}`,
        boxShadow: `0 10px 0 ${depth}`,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      {children}
    </div>
  );
}

/** Display type with the game's outline and drop: white by default. */
export function Title({
  children,
  size = 120,
  color = FG,
  stroke,
  lineHeight = 1.02,
  align = 'left',
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  stroke?: number;
  lineHeight?: number;
  align?: 'left' | 'center';
}): ReactElement {
  const s = stroke ?? Math.max(4, Math.round(size / 18));
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
        fontSize: size,
        lineHeight,
        color,
        WebkitTextStroke: `${s}px ${OUTLINE}`,
        textShadow: `0 ${Math.round(s * 1.6)}px 0 ${OUTLINE}`,
      }}
    >
      {children}
    </div>
  );
}

/** A raised panel: dark outline, blue face, a lighter top edge and a 3D lip. */
export function Panel({
  children,
  accent,
  pad = '26px 30px',
  column = true,
  gap = 0,
  grow = false,
}: {
  children: ReactNode;
  /** Edges the panel in a colour, for the one that matters. */
  accent?: string;
  pad?: string;
  column?: boolean;
  gap?: number;
  grow?: boolean;
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: column ? 'column' : 'row',
        alignItems: column ? 'stretch' : 'center',
        gap,
        padding: pad,
        borderRadius: 30,
        border: `5px solid ${OUTLINE}`,
        background: accent
          ? `linear-gradient(180deg, ${accent}55, ${PANEL} 70%)`
          : `linear-gradient(180deg, ${PANEL_TOP}, ${PANEL})`,
        boxShadow: `inset 0 4px 0 rgba(255,255,255,0.18), 0 10px 0 ${PANEL_DEPTH}${accent ? `, 0 0 0 4px ${accent}` : ''}`,
        ...(grow ? { flexGrow: 1 } : {}),
      }}
    >
      {children}
    </div>
  );
}

/** A brawler's portrait in an outlined tile, ringed in a colour. */
export function Portrait({
  src,
  size,
  ring = 'rgba(255,255,255,0.25)',
  radius,
}: {
  src: string | null;
  size: number;
  ring?: string;
  radius?: number;
}): ReactElement {
  const r = radius ?? Math.round(size * 0.22);
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: r,
        border: `${Math.max(4, Math.round(size / 26))}px solid ${OUTLINE}`,
        background: `linear-gradient(180deg, #3550b8, #1a2759)`,
        boxShadow: `0 0 0 ${Math.max(3, Math.round(size / 40))}px ${ring}, 0 ${Math.round(size / 18)}px 0 ${OUTLINE}`,
        overflow: 'hidden',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={size} height={size} alt="" style={{ objectFit: 'cover' }} />
      ) : (
        <div style={{ display: 'flex' }} />
      )}
    </div>
  );
}

/** A rank number in a coin: gold, silver, bronze, then navy. */
export function RankCoin({ n, size = 64 }: { n: number; size?: number }): ReactElement {
  const color = PODIUM[n - 1] ?? '#33468f';
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        background: color,
        border: `4px solid ${OUTLINE}`,
        boxShadow: `0 5px 0 ${OUTLINE}`,
        color: n <= 3 ? '#1a1200' : FG,
        fontSize: Math.round(size * 0.56),
      }}
    >
      {n}
    </div>
  );
}

/** A small rounded tag: "WINS MORE", "+3.2 vs usual". */
export function Tag({
  children,
  color = SKY,
  ink = OUTLINE,
  size = 28,
}: {
  children: ReactNode;
  color?: string;
  ink?: string;
  size?: number;
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        padding: `${Math.round(size * 0.18)}px ${Math.round(size * 0.5)}px ${Math.round(size * 0.24)}px`,
        borderRadius: 999,
        background: color,
        color: ink,
        fontSize: size,
        border: `3px solid ${OUTLINE}`,
      }}
    >
      {children}
    </div>
  );
}

/** Body copy in the display face at a reading weight: muted, no outline. */
export function Note({
  children,
  size = 32,
  color = MUTED,
  align = 'left',
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  align?: 'left' | 'center';
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
        fontSize: size,
        color,
        lineHeight: 1.25,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The last slide: where to get this live. The Bubble is the one thing a viewer
 * cannot get from the post itself -- these numbers, floating over their own
 * draft -- so it is the call to action, with the site under it.
 */
export function Outro({ logo, line }: { logo: string | null; line: string }): ReactElement {
  return (
    <Stage glow="#ffb000" brand={false}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 0 }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            width={240}
            height={240}
            alt=""
            style={{ borderRadius: 56, border: `6px solid ${OUTLINE}`, boxShadow: `0 14px 0 ${OUTLINE}` }}
          />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ display: 'flex', marginTop: 54 }}>
          <Title size={92} align="center">
            Get this live
          </Title>
        </div>
        <div style={{ display: 'flex', marginTop: 6 }}>
          <Title size={92} color={GOLD} align="center">
            in your draft
          </Title>
        </div>
        <div style={{ display: 'flex', marginTop: 34, width: 760 }}>
          <Note size={36} color={FG} align="center">
            {line}
          </Note>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 70 }}>
        {[
          'Free Android app: BrawlZone Bubble',
          'Best picks for every Ranked map',
          'Counters and team comps by rank',
        ].map((text, i) => (
          <Panel key={i} pad="22px 30px" column={false} gap={22}>
            <div
              style={{
                display: 'flex',
                width: 22,
                height: 22,
                borderRadius: 11,
                background: GOLD,
                border: `3px solid ${OUTLINE}`,
              }}
            />
            <div style={{ display: 'flex', fontSize: 40 }}>{text}</div>
          </Panel>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 64 }}>
        <Ribbon size={66} tilt={-2}>
          brawlzone.net
        </Ribbon>
      </div>
    </Stage>
  );
}
