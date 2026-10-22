import { brawldleRoster } from '@/lib/brawldle-data';
import { PICTURE_MODES, PICTURE_TRIES, type PictureMode, pictureAnswer, pictureImage } from '@/lib/brawldle-picture';

/**
 * Today's picture for the Shadow or Zoom puzzle, after `step` wrong guesses.
 *
 * Cut on the server so the browser never sees a URL or a pixel that names the
 * brawler before the puzzle is over. The date is the server's, as in the guess
 * endpoint; the client adds `d` only so a cached image from yesterday is never
 * shown today.
 *
 * Asking for step 6 shows the answer. That is the same as giving up, which the
 * board offers anyway, so there is nothing here worth guarding.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get('mode') as PictureMode;
  const step = Math.max(0, Math.min(PICTURE_TRIES, Math.floor(Number(params.get('step') ?? '0')) || 0));
  if (!PICTURE_MODES.includes(mode)) {
    return Response.json({ error: 'unknown mode' }, { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const roster = await brawldleRoster().catch(() => []);
  const answer = await pictureAnswer(mode, date, roster);
  const image = answer ? await pictureImage(mode, answer, date, step).catch(() => null) : null;
  if (!image) {
    return Response.json({ error: 'no puzzle today' }, { status: 503 });
  }

  return new Response(new Uint8Array(image), {
    headers: {
      'content-type': 'image/webp',
      // Private: the URL carries no date, so a shared cache could hand
      // yesterday's picture to someone today.
      'cache-control': 'private, max-age=600',
    },
  });
}
