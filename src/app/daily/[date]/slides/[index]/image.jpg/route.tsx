import { ImageResponse } from 'next/og';

import { SLIDE_SIZE, dailySlides, slideCount, toJpeg } from '@/lib/daily-slides';
import { getDailyReport } from '@/lib/stats';

/**
 * One slide of the day's carousel, as a JPEG.
 *
 * The index lives in the path rather than the query string because a posting
 * API fetches these itself from a public URL, and `searchParams` opts a route
 * out of caching entirely (AGENTS.md trap 5) — which would mean re-rendering a
 * 1080x1920 image on every fetch. The set is bounded: one day times at most
 * `slideCount`, and an index outside that range 404s rather than rendering.
 *
 * JPEG rather than PNG is not cosmetic. TikTok's Content Posting API accepts
 * JPEG and WebP only; a PNG is accepted by the init call, given a publish id,
 * and then failed asynchronously as `file_format_check_failed`, so it looks
 * like success and nothing arrives.
 */

export const revalidate = 86400;

/* Runtime ISR. Without an empty `generateStaticParams` a dynamic segment is
   re-rendered per request however long its revalidate (AGENTS.md trap 1). */
export async function generateStaticParams() {
  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string; index: string }> },
) {
  const { date, index } = await params;

  const n = Number(index);
  if (!Number.isInteger(n) || n < 0) {
    return new Response('Not found', { status: 404 });
  }

  const report = await getDailyReport(date).catch(() => null);
  if (n >= slideCount(report)) {
    return new Response('Not found', { status: 404 });
  }

  const slides = await dailySlides(date, report, n);
  const slide = slides[n];
  if (!slide) return new Response('Not found', { status: 404 });

  const png = new ImageResponse(slide, SLIDE_SIZE);
  const jpeg = await toJpeg(await png.arrayBuffer());

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
