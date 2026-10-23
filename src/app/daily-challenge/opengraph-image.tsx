import { ImageResponse } from 'next/og';
import sharp from 'sharp';

import { brawldleRoster } from '@/lib/brawldle-data';
import { pictureAnswer, pictureImage } from '@/lib/brawldle-picture';

/**
 * Share card for the daily challenge (2026-10-23): today's Shadow puzzle, as a
 * dare. The page is shared to WhatsApp and Discord with the result text, and a
 * plain site card under "BrawlZone Daily #21" gave nobody a reason to tap; a
 * silhouette they can try to name does.
 *
 * It shows only what the Shadow tab shows before the first guess, so the card
 * spoils nothing. Satori: flexbox and a subset of CSS, no WebP, so the
 * silhouette goes in as a PNG data URL.
 */
export const alt = 'Brawl Stars daily challenge: whose shadow is this?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The puzzle changes at midnight UTC; an hour late is the most a card can lag. */
export const revalidate = 3600;

const FIRST_DAY = Date.UTC(2026, 9, 1);

export default async function Image() {
  const date = new Date().toISOString().slice(0, 10);
  const number = Math.floor((Date.parse(`${date}T00:00:00Z`) - FIRST_DAY) / 86_400_000);
  const roster = await brawldleRoster().catch(() => []);
  const answer = await pictureAnswer('shadow', date, roster).catch(() => null);
  const shadow = answer ? await pictureImage('shadow', answer, date, 0).catch(() => null) : null;
  const src = shadow ? `data:image/png;base64,${(await sharp(shadow).png().toBuffer()).toString('base64')}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: 64,
          gap: 56,
          background: 'linear-gradient(135deg, #1a1446, #0b0f1d 65%)',
          color: '#f2f5ff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 460,
            height: 460,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 40,
            background: 'linear-gradient(160deg, #fde047, #f472b6)',
            border: '8px solid rgba(255,255,255,0.85)',
          }}
        >
          {src ? (
            <img src={src} width={380} height={380} style={{ objectFit: 'contain' }} alt="" />
          ) : (
            <div style={{ fontSize: 220, fontWeight: 900, color: '#0e1022' }}>?</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#a78bfa', letterSpacing: 2 }}>
            {`BRAWLZONE DAILY #${number}`}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.05 }}>Whose shadow is this?</div>
          <div style={{ fontSize: 32, color: '#c7cbe0', lineHeight: 1.3 }}>
            Three Brawl Stars puzzles a day: Classic, Shadow and Zoom. Six guesses.
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#fde047' }}>brawlzone.net/daily-challenge</div>
        </div>
      </div>
    ),
    size,
  );
}
