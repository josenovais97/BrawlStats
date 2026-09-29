import { answerFor } from '@/lib/brawldle';
import { brawldleRoster } from '@/lib/brawldle-data';

/**
 * Yesterday's answer.
 *
 * Safe to publish: that puzzle is finished and nobody can still be playing it.
 * It closes the loop for whoever failed it, and it is a small reason to come
 * back — which is the whole job of everything added around the board today.
 *
 * Deliberately only yesterday. An endpoint that took any date would hand over
 * every past answer, and with the answer being a pure function of the date,
 * it would also hand over tomorrow's.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const roster = await brawldleRoster().catch(() => []);
  const answer = answerFor(yesterday, roster);

  if (!answer) {
    return Response.json({ date: yesterday, brawler: null }, { status: 503 });
  }

  return Response.json(
    {
      date: yesterday,
      brawler: { name: answer.name, slug: answer.slug, imageUrl: answer.imageUrl },
    },
    // One hour: the value only changes at midnight UTC, and a stale hour on
    // either side of that is harmless where a stale day would be wrong.
    { headers: { 'cache-control': 'public, max-age=0, s-maxage=3600' } },
  );
}
