import { ImageResponse } from 'next/og';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatPercent, titleCase } from '@/lib/format';
import { resolveMap } from '@/lib/game-maps';
import { SITE_NAME } from '@/lib/site';
import { RANKED_MAP_WINDOW_DAYS, getRankedMapPicks } from '@/lib/stats';

/**
 * Share card for a map page.
 *
 * These are the most-shared pages on the site and had no card at all: 445 of
 * the 829 URLs in the sitemap are map pages, and every one of them unfurled as
 * the generic site image. A Brawl Stars link is pasted into Discord far more
 * often than it is searched for, so the card is the page for most of the people
 * who ever see it.
 *
 * Built with Satori, so this is flexbox and a subset of CSS only: no grid, no
 * custom properties, no radial gradients, and an explicit `display` on any
 * element with more than one child.
 */

export const alt = 'Brawl Stars map, and the brawlers that win on it';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Matches the page it represents, so a shared card is never wildly stale. */
export const revalidate = 10800;

/* Runtime ISR. See `/brawlers/[slug]` for why the empty array is required. */
export async function generateStaticParams() {
  return [];
}

/** How many picks fit across the card without shrinking to unreadable. */
const PICKS_SHOWN = 3;

export default async function Image({
  params,
}: {
  params: Promise<{ mode: string; map: string }>;
}) {
  const { mode, map } = await params;
  const entry = await resolveMap(mode, map).catch(() => undefined);
  if (!entry) return fallback();

  const modeLabel = entry.mode?.name ?? entry.map.gameMode.name;
  const accent = entry.mode?.color ?? '#8b95b8';

  // Only the map's own picks, never the mode-wide fallback the page uses. A
  // card is a claim about the thing it names, and mode averages under a map
  // name would be a different and quieter claim than the one it looks like.
  const picks = entry.scHash
    ? await getRankedMapPicks(PICKS_SHOWN, RANKED_MAP_WINDOW_DAYS, {
        mapName: entry.map.name,
        mode: entry.scHash,
      })
        .then((rows) => rows[0]?.picks.slice(0, PICKS_SHOWN) ?? [])
        .catch(() => [])
    : [];

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
        {/* The mode colour, matching the page header. Linear rather than
            radial: Satori has no radial-gradient. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: `linear-gradient(125deg, ${accent} 0%, transparent 62%)`,
            opacity: 0.22,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {entry.map.imageUrl ? (
            <img
              src={entry.map.imageUrl}
              alt=""
              width={160}
              height={224}
              style={{ borderRadius: 24, background: '#1b2136', objectFit: 'cover' }}
            />
          ) : null}
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
              {titleCase(entry.map.name)}
            </div>
            <div style={{ fontSize: 32, color: '#8b95b8', marginTop: 10 }}>
              {entry.retired ? `${modeLabel}  ·  Retired` : `${modeLabel}  ·  Best brawlers`}
            </div>
          </div>
        </div>

        {picks.length > 0 ? (
          <div style={{ display: 'flex', gap: 20 }}>
            {picks.map((pick) => (
              <div
                key={pick.brawlerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  flex: 1,
                  padding: '22px 26px',
                  borderRadius: 20,
                  background: '#151a2e',
                  border: '1px solid #242b45',
                }}
              >
                <img
                  src={brawlerIconUrl(pick.brawlerId)}
                  alt=""
                  width={64}
                  height={64}
                  style={{ borderRadius: 14 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 26, color: '#8b95b8' }}>
                    {titleCase(pick.brawlerName)}
                  </div>
                  {/* `score`, not `winRate`: the page headlines the adjusted
                      figure and shows the raw one as a secondary "raw" label,
                      so a card leading with the raw rate would quote a
                      different number than the page it links to. */}
                  <div style={{ fontSize: 40, fontWeight: 900, marginTop: 2 }}>
                    {formatPercent(pick.score)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Same rule as the brawler card: a card promising numbers it does not
          // have is worse than one that leads with the map.
          <div style={{ display: 'flex', fontSize: 30, color: '#8b95b8' }}>
            {`Map layout, environment and the strongest brawlers in ${modeLabel}`}
          </div>
        )}

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
          letterSpacing: 2,
          fontFamily: 'sans-serif',
        }}
      >
        {SITE_NAME.toUpperCase()}
      </div>
    ),
    size,
  );
}
