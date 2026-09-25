import { ImageResponse } from 'next/og';

import { SLIDE_SIZE, dailySlides, toJpeg } from '@/lib/daily-slides';
import { getDailyReport } from '@/lib/stats';

/**
 * The day as a single image — the carousel's cover slide, on a stable path.
 *
 * Kept after the carousel replaced it because not everywhere takes a set of
 * images: a link unfurl, a reply, anywhere one picture has to stand for the
 * day. It renders slide 0 rather than a design of its own, so there is one
 * layout to maintain and no second version to drift.
 *
 * `opengraph-image` next door is a different thing again: 1200x630 for link
 * previews, headlines and no numbers. This one is 1080x1920 for feeds.
 */

export const revalidate = 86400;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const report = await getDailyReport(date).catch(() => null);
  const [cover] = await dailySlides(date, report, 0);

  const png = new ImageResponse(cover, SLIDE_SIZE);
  const jpeg = await toJpeg(await png.arrayBuffer());

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
