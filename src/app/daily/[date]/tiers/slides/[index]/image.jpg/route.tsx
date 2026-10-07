import { ImageResponse } from 'next/og';

import { mapOfDay } from '@/lib/map-of-day';
import { SLIDE_SIZE, mapSlideCount, mapSlides, slideFonts, toJpeg } from '@/lib/map-slides';

/**
 * One slide of the day's Ranked map carousel, as a JPEG.
 *
 * This route and the manifest beside it both derive the slide list from
 * `mapSlideCount` and `mapOfDay`, which picks the map from the date alone, so
 * they agree on the map and the count without sharing state. The set is
 * bounded: one day times five slides, and an index outside that range 404s
 * rather than rendering.
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

  const post = await mapOfDay(date).catch(() => null);
  if (!post || n >= mapSlideCount(post)) {
    return new Response('Not found', { status: 404 });
  }

  const slides = await mapSlides(post, n);
  const slide = slides[n];
  if (!slide) return new Response('Not found', { status: 404 });

  const png = new ImageResponse(slide, { ...SLIDE_SIZE, fonts: await slideFonts() });
  const jpeg = await toJpeg(await png.arrayBuffer());

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
