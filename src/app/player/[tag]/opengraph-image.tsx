import { ImageResponse } from 'next/og';

import { getPlayer } from '@/lib/bs-api';
import { playerIconUrl } from '@/lib/brawlapi';
import { nameColorToCss } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';
import { displayTag } from '@/lib/tags';

/**
 * Share card for a player profile.
 *
 * A profile link is the most-shared thing on a site like this, and until now
 * it unfurled as bare text. Built with Satori, so this is flexbox and a subset
 * of CSS only — no grid, no custom utilities, no Tailwind.
 */

export const alt = 'Brawl Stars player profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Matches the page it represents, so a shared card is never wildly stale. */
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;

  let player;
  try {
    player = await getPlayer(tag);
  } catch {
    // A card that says nothing beats a broken unfurl, and a 404 here would
    // leave the sharer with no preview at all.
    return fallback();
  }

  const accent = nameColorToCss(player.nameColor);
  const number = (n: number) => n.toLocaleString('en-US');

  const stats: [string, string][] = [
    ['Trophies', number(player.trophies)],
    ['Peak', number(player.highestTrophies)],
    ['Brawlers', String(player.brawlers.length)],
    ['3v3 wins', number(player['3vs3Victories'])],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#0b0f1d',
          color: '#f2f5ff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* A wash in the player's own name colour, the same trick the page
            header uses, so the card feels like the profile it links to.
            A linear gradient rather than the page's radial one: Satori has no
            radial-gradient and no blur, and a plain circle left a hard edge
            cutting across the stat row. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: `linear-gradient(125deg, ${accent} 0%, transparent 60%)`,
            opacity: 0.2,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <img
            src={playerIconUrl(player.icon?.id)}
            alt=""
            width={148}
            height={148}
            style={{ borderRadius: 28, background: '#1b2136' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 76,
                fontWeight: 900,
                letterSpacing: -1,
                color: accent,
                lineHeight: 1.05,
              }}
            >
              {player.name}
            </div>
            {/* One interpolation, not two: Satori requires an explicit display
                on any element with more than one child node, and two adjacent
                expressions count as two. */}
            <div style={{ fontSize: 32, color: '#8b95b8', marginTop: 8 }}>
              {`${displayTag(player.tag)}${player.club?.name ? `  ·  ${player.club.name}` : ''}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {stats.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                padding: '24px 28px',
                borderRadius: 20,
                background: '#151a2e',
                border: '1px solid #242b45',
              }}
            >
              <div style={{ fontSize: 24, color: '#8b95b8' }}>{label}</div>
              <div style={{ fontSize: 48, fontWeight: 900, marginTop: 6 }}>{value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 28,
            fontWeight: 700,
            color: '#ffc53d',
            letterSpacing: 2,
          }}
        >
          {SITE_NAME.toUpperCase()}
        </div>
      </div>
    ),
    size,
  );
}

function fallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f1d',
          color: '#ffc53d',
          fontSize: 64,
          fontWeight: 900,
          letterSpacing: 4,
          fontFamily: 'sans-serif',
        }}
      >
        {SITE_NAME.toUpperCase()}
      </div>
    ),
    size,
  );
}
