import { ImageResponse } from 'next/og';

import { patchOfDay } from '@/lib/daily-posts';
import { PATCH_SLIDES, SLIDE_SIZE, patchSlides, slideFonts, toJpeg } from '@/lib/daily-posts-slides';

/**
 * One slide of the day's balance-update carousel, as a JPEG. The subject is a pure
 * function of the date (see `patchOfDay`), so this and the manifest beside it agree
 * without sharing state; an index outside the set 404s.
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
  if (!Number.isInteger(n) || n < 0 || n >= PATCH_SLIDES) {
    return new Response('Not found', { status: 404 });
  }

  const post = await patchOfDay(date).catch(() => null);
  if (!post) return new Response('Not found', { status: 404 });

  const slide = (await patchSlides(post, n))[n];
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
