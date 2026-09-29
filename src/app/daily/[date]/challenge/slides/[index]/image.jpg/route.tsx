import { ImageResponse } from 'next/og';

import { challengePost } from '@/lib/challenge-post';
import {
  SLIDE_SIZE,
  challengeSlideCount,
  challengeSlides,
  slideFonts,
  toJpeg,
} from '@/lib/challenge-slides';

/** One slide of the daily-challenge promo carousel, as a JPEG. */

export const revalidate = 86400;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ index: string }> },
) {
  const { index } = await params;
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0) return new Response('Not found', { status: 404 });

  const post = await challengePost().catch(() => null);
  if (!post || n >= challengeSlideCount(post)) return new Response('Not found', { status: 404 });

  const slides = await challengeSlides(post, n);
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
