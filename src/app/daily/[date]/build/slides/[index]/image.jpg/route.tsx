import { ImageResponse } from 'next/og';

import { brawlerOfDay } from '@/lib/brawler-of-day';
import { SLIDE_SIZE, buildSlideCount, buildSlides, toJpeg } from '@/lib/build-slides';

/**
 * One slide of the day's brawler-build carousel, as a JPEG.
 *
 * Which brawler is a pure function of the date -- see `brawlerOfDay` -- so
 * this route and the manifest beside it reach the same answer without sharing
 * state. The set is bounded: one day times at most five slides, and an index
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

  const day = await brawlerOfDay(date).catch(() => null);
  if (!day || n >= buildSlideCount(day)) {
    return new Response('Not found', { status: 404 });
  }

  const slides = await buildSlides(day, n);
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
