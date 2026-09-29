import { ImageResponse } from 'next/og';

import { challengePost } from '@/lib/challenge-post';
import { SLIDE_SIZE, challengeFrame, slideFonts, toJpeg } from '@/lib/challenge-slides';

/**
 * One frame of the daily-challenge promo video.
 *
 * `n` is how many clue tiles have turned across the whole board, so a single
 * counter drives the entire animation and the video builder only has to walk
 * 0..n holding each frame for a fixed time.
 *
 * Not linked from anywhere and not in the sitemap: this exists to be scraped
 * by a build script on a laptop, a couple of dozen times, when a promo video
 * is made. It adds nothing to the crawlable surface for that reason — see
 * AGENTS.md on the crawl budget, where the rule is that a route only counts if
 * something links to it.
 */

export const revalidate = 86400;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

/** Three rows of seven, plus a hold at the end. Anything past this 404s. */
const MAX_TURNED = 64;

export async function GET(_request: Request, { params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const turned = Number(n);
  if (!Number.isInteger(turned) || turned < 0 || turned > MAX_TURNED) {
    return new Response('Not found', { status: 404 });
  }

  const post = await challengePost().catch(() => null);
  if (!post) return new Response('Not found', { status: 404 });

  const png = new ImageResponse(await challengeFrame(post, turned), {
    ...SLIDE_SIZE,
    fonts: await slideFonts(),
  });
  const jpeg = await toJpeg(await png.arrayBuffer());

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
