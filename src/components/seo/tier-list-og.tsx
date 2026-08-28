import { ImageResponse } from 'next/og';

import { brawlerPortraitUrl } from '@/lib/brawlapi';
import { SITE_NAME } from '@/lib/site';
import { TIER_COLOR } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

export interface TierListOgEntry {
  brawlerId: number;
  name: string;
  tier: Tier;
  metaScore: number;
}

/**
 * Share card for a tier list.
 *
 * Tier-list links are the ones that get pasted into a club chat, and they were
 * unfurling as the site default — the same generic card as every other page,
 * on the pages most likely to be shared. This one shows the actual top of the
 * actual list, so the embed carries the answer and not just the address.
 *
 * Built with Satori, so this is flexbox and a subset of CSS only: no grid, no
 * custom properties, no Tailwind. Every element with more than one child needs
 * an explicit `display`.
 */
export function tierListOgImage({
  heading,
  scope,
  accent,
  top,
  size,
}: {
  heading: string;
  /** What was sampled, in a few words. */
  scope: string;
  accent: string;
  top: TierListOgEntry[];
  size: { width: number; height: number };
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: '#0b0f1d',
          color: '#f2f5ff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            background: `linear-gradient(125deg, ${accent} 0%, transparent 62%)`,
            opacity: 0.22,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              letterSpacing: -1,
              lineHeight: 1.05,
              color: accent,
            }}
          >
            {heading}
          </div>
          <div style={{ fontSize: 30, color: '#8b95b8', marginTop: 12 }}>{scope}</div>
        </div>

        {top.length > 0 ? (
          <div style={{ display: 'flex', gap: 20 }}>
            {top.map((entry, index) => (
              <div
                key={entry.brawlerId}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  padding: '20px 18px 22px',
                  borderRadius: 24,
                  background: '#151a2e',
                  border: `1px solid ${index === 0 ? accent : '#242b45'}`,
                }}
              >
                {/* Satori renders to a PNG on the server; `next/image` has no
                    meaning inside an ImageResponse. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brawlerPortraitUrl(entry.brawlerId)}
                  alt=""
                  width={112}
                  height={112}
                  style={{ borderRadius: 22, background: '#1b2136' }}
                />
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    marginTop: 12,
                    textTransform: 'capitalize',
                  }}
                >
                  {entry.name.toLowerCase()}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 40,
                    fontWeight: 900,
                    marginTop: 6,
                    color: TIER_COLOR[entry.tier],
                  }}
                >
                  {`${entry.metaScore.toFixed(1)}`}
                </div>
                <div style={{ fontSize: 22, color: '#8b95b8', marginTop: 2 }}>
                  {`${entry.tier} tier`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 30, color: '#8b95b8' }}>
            Ranked and trophy ladder, scored separately from sampled battles
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
