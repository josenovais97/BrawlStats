import { ImageResponse } from 'next/og';

import { brawlerPortraitUrl } from '@/lib/brawlapi';
import { formatPercent, titleCase } from '@/lib/format';
import { resolvePair } from '@/lib/compare';
import { SITE_NAME } from '@/lib/site';
import {
  MIN_SAMPLE_FOR_TIER,
  assignTier,
  getBrawlerStat,
  normalizeWinRate,
} from '@/lib/stats';

/**
 * Share card for a head-to-head comparison.
 *
 * "X vs Y" is an argument, and an argument is the thing people paste into a
 * chat. 246 of these are in the sitemap and all of them unfurled as the generic
 * site image, which gives away nothing about the one question the page answers.
 *
 * Built with Satori: flexbox and a subset of CSS only, no grid, no radial
 * gradients, explicit `display` on anything with more than one child.
 */

export const alt = 'Two Brawl Stars brawlers compared';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Matches the page it represents, so a shared card is never wildly stale. */
export const revalidate = 7200;

/* Runtime ISR. See `/brawlers/[slug]` for why the empty array is required. */
export async function generateStaticParams() {
  return [];
}

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const resolved = await resolvePair(pair).catch(() => null);
  if (!resolved) return fallback();

  const sides = await Promise.all(
    [resolved.a, resolved.b].map(async (brawler) => {
      const stat = await getBrawlerStat(brawler.id).catch(() => null);
      const adjusted = stat
        ? normalizeWinRate(stat.winRate, stat.baselineWinRate, stat.decidedSampleSize)
        : null;
      return {
        brawler,
        adjusted,
        tier:
          stat && stat.decidedSampleSize >= MIN_SAMPLE_FOR_TIER ? assignTier(adjusted) : null,
      };
    }),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: '#0b0f1d',
          color: '#f2f5ff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Each brawler's rarity colour washing in from its own side, so the
            card reads as two things facing each other before a word is read. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: `linear-gradient(100deg, ${
              sides[0].brawler.rarity?.color ?? '#8b95b8'
            } 0%, transparent 42%)`,
            opacity: 0.22,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: `linear-gradient(260deg, ${
              sides[1].brawler.rarity?.color ?? '#8b95b8'
            } 0%, transparent 42%)`,
            opacity: 0.22,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {sides.map((side) => (
            <div
              key={side.brawler.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 420,
              }}
            >
              <img
                src={brawlerPortraitUrl(side.brawler.id)}
                alt=""
                width={200}
                height={200}
                style={{ borderRadius: 32, background: '#1b2136' }}
              />
              <div
                style={{
                  fontSize: 54,
                  fontWeight: 900,
                  letterSpacing: -1,
                  marginTop: 18,
                  color: side.brawler.rarity?.color ?? '#f2f5ff',
                }}
              >
                {titleCase(side.brawler.name)}
              </div>
              {/* Only once there is a rating. A tier chip reading "–" beside a
                  real one would look like a verdict rather than a gap. */}
              <div style={{ display: 'flex', fontSize: 34, color: '#8b95b8', marginTop: 8 }}>
                {side.tier
                  ? `${side.tier} tier  ·  ${formatPercent(side.adjusted)}`
                  : 'Not enough data yet'}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', fontSize: 28, color: '#8b95b8' }}>
            Win rates, best modes and the head-to-head record
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
