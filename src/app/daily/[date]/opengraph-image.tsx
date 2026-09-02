import { ImageResponse } from 'next/og';

import { dayLabel } from '@/components/daily/daily-report';
import { SITE_NAME } from '@/lib/site';
import { getDailyReport } from '@/lib/stats';

/**
 * Share card for one day's findings.
 *
 * These get pasted into Discord more than any other page here, and a dated
 * report unfurling as the site default would lose the only thing that makes it
 * worth sharing — what was actually found that day. So the card carries the
 * headline of each finding rather than a title and a logo.
 *
 * Built with Satori: flexbox and a subset of CSS only. No grid, no custom
 * properties, no Tailwind.
 */
export const alt = 'Brawl Stars findings for the day';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Archived days never change, so this can be cached hard. */
export const revalidate = 86400;

/* Runtime ISR, for the same reason as the page. */
export async function generateStaticParams() {
  return [];
}

/** The wording each card leads with, short enough to read at thumbnail size. */
const HEADLINE: Record<string, (names: string[], context?: string) => string> = {
  'secret-pick': ([a]) => `Nobody picks ${a} — and it is winning`,
  'meta-trap': ([a]) => `${a} is everywhere, and losing`,
  'giant-killer': ([a, b]) => `${a} owns ${b}`,
  'secret-duo': ([a, b]) => `${a} and ${b} belong together`,
  'map-surprise': ([a], context) => `${a} is different on ${context ?? 'one map'}`,
  'overnight-rise': ([a]) => `${a} moved more than anything else`,
};

function cap(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const report = await getDailyReport(date).catch(() => null);

  const lines = (report?.discoveries ?? [])
    .slice(0, 4)
    .map((discovery) => {
      const names = discovery.brawlerNames.map(cap);
      return HEADLINE[discovery.kind]?.(names, discovery.context) ?? names.join(' and ');
    });

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
        {/* Linear rather than radial: Satori has no radial-gradient. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: 'linear-gradient(135deg, rgba(53,208,255,0.20), rgba(11,15,29,0) 60%)',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 2, color: '#35d0ff' }}>
            {dayLabel(date).toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, marginTop: 8 }}>
            What we found
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lines.length > 0 ? (
            lines.map((line) => (
              <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: '#35d0ff',
                  }}
                />
                <div style={{ display: 'flex', fontSize: 34, color: '#c9d2ea' }}>{line}</div>
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', fontSize: 34, color: '#c9d2ea' }}>
              Findings from sampled Brawl Stars battles
            </div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: '#8b95b8' }}>
          {SITE_NAME} · measured from sampled battles
        </div>
      </div>
    ),
    size,
  );
}
