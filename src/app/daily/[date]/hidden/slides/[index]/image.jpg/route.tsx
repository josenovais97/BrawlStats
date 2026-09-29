import { ImageResponse } from 'next/og';

import { getHiddenMeta } from '@/lib/hidden-meta';
import { SLIDE_SIZE, hiddenSlideCount, hiddenSlides, slideFonts, toJpeg } from '@/lib/hidden-slides';

/**
 * One slide of the day's hidden-meta carousel, as a JPEG.
 *
 * This route and the manifest beside it both derive the slide list from
 * `plan()` in hidden-slides, so they agree on how many there are without
 * sharing state. Bounded: one day times at most seven slides.
 *
 * JPEG because TikTok accepts JPEG and WebP only, and a PNG is accepted by the
 * init call and then failed asynchronously, which looks exactly like success.
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
  const { index } = await params;

  const n = Number(index);
  if (!Number.isInteger(n) || n < 0) {
    return new Response('Not found', { status: 404 });
  }

  const data = await getHiddenMeta().catch(() => null);
  if (!data || n >= hiddenSlideCount(data)) {
    return new Response('Not found', { status: 404 });
  }

  const slides = await hiddenSlides(data, n);
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
