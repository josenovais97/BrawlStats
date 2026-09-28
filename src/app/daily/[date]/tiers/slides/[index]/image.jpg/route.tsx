import { ImageResponse } from 'next/og';

import { tierOfDay } from '@/lib/tier-of-day';
import { SLIDE_SIZE, tierSlideCount, tierSlides, toJpeg } from '@/lib/tier-slides';

/**
 * One slide of the day's tier-list carousel, as a JPEG.
 *
 * This route and the manifest beside it both derive the slide list from
 * `plan()` in tier-slides, so they agree on how many there are without sharing
 * state. The set is bounded: one day times at most eight slides, and an index
 * outside that range 404s rather than rendering.
 *
 * JPEG because TikTok's Content Posting API accepts JPEG and WebP only, and a
 * PNG is accepted by the init call and then failed asynchronously, which looks
 * exactly like success.
 */

export const revalidate = 86400;

/* Runtime ISR — see AGENTS.md trap 1. */
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

  const post = await tierOfDay(date).catch(() => null);
  if (!post || n >= tierSlideCount(post)) {
    return new Response('Not found', { status: 404 });
  }

  const slides = await tierSlides(post, n);
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
