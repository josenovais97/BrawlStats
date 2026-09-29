import { answerFor, compareGuess } from '@/lib/brawldle';
import { brawldleRoster } from '@/lib/brawldle-data';


/**
 * Judge one guess, server-side.
 *
 * The answer never reaches the browser. The alternative -- shipping the roster
 * with its clue values and comparing in the client -- puts the solution in the
 * page source, where the puzzle is over for anyone who presses Ctrl+U.
 *
 * Costs one small request per guess, which is six or seven per player per day.
 * The Cloudflare rate limit added 2026-09-28 (100 requests per IP per 10s) is
 * the ceiling, and a guessing game will not approach it.
 *
 * `/api/` is already in CRAWLER_DISALLOW, so this adds nothing to the crawl
 * surface.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get('brawler') ?? '').toLowerCase().trim();

  /*
   * The date is server-side, not a parameter. Taking it from the client would
   * let anyone ask for tomorrow's answer, or walk backwards through every
   * past puzzle -- and the whole point of a daily is that everybody gets the
   * same one on the same day.
   */
  const date = new Date().toISOString().slice(0, 10);

  if (!slug) {
    return Response.json({ error: 'no brawler' }, { status: 400 });
  }

  const roster = await brawldleRoster().catch(() => []);
  const answer = answerFor(date, roster);
  if (!answer) {
    return Response.json({ error: 'no puzzle today' }, { status: 503 });
  }

  const guess = roster.find((b) => b.slug === slug);
  if (!guess) {
    return Response.json({ error: 'unknown brawler' }, { status: 404 });
  }

  const result = compareGuess(guess, answer);

  return Response.json(
    {
      date,
      correct: result.correct,
      // The guessed brawler, which the client already knows, plus its clues.
      // The answer is included ONLY once it has been found.
      brawler: { id: guess.id, name: guess.name, slug: guess.slug, imageUrl: guess.imageUrl },
      clues: result.clues,
      answer: result.correct
        ? { id: answer.id, name: answer.name, slug: answer.slug, imageUrl: answer.imageUrl }
        : null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
