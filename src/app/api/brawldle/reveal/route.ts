import { brawldleRoster } from '@/lib/brawldle-data';
import { PICTURE_MODES, type PictureMode, pictureAnswer } from '@/lib/brawldle-picture';

/**
 * Today's Shadow or Zoom answer, for a player who ran out of guesses.
 *
 * Nothing stops asking early: it is the "give up" button, and a fan puzzle
 * gains nothing from pretending otherwise. The classic puzzle has unlimited
 * guesses and no reveal.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get('mode') as PictureMode;
  if (!PICTURE_MODES.includes(mode)) {
    return Response.json({ error: 'unknown mode' }, { status: 400 });
  }
  const date = new Date().toISOString().slice(0, 10);
  const roster = await brawldleRoster().catch(() => []);
  const answer = await pictureAnswer(mode, date, roster);
  if (!answer) {
    return Response.json({ error: 'no puzzle today' }, { status: 503 });
  }
  return Response.json(
    { date, answer: { id: answer.id, name: answer.name, slug: answer.slug, imageUrl: answer.imageUrl } },
    { headers: { 'cache-control': 'no-store' } },
  );
}
