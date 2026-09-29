import 'server-only';

import { answerFor, compareGuess } from '@/lib/brawldle';
import { brawldleRoster } from '@/lib/brawldle-data';
import type { ChallengePost } from '@/lib/challenge-slides';

/**
 * A real solved board from yesterday's puzzle, for the promo carousel.
 *
 * Yesterday, never today: today's answer would be handed to everyone who saw
 * the post. Yesterday's is finished and already published by the
 * `/api/brawldle/yesterday` endpoint the board itself uses.
 *
 * The guesses are chosen to be a plausible narrowing rather than random — one
 * far off, one closer, then the answer — because the slide is meant to show
 * how the clues guide you. They are judged by the same `compareGuess` the game
 * uses, so the tiles on the slide are the tiles a player would actually have
 * seen. A mocked-up board would drift from the real one and become a lie about
 * the product.
 */
export async function challengePost(): Promise<ChallengePost | null> {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const roster = await brawldleRoster().catch(() => []);
  const answer = answerFor(yesterday, roster);
  if (!answer) return null;

  /*
   * Pick two wrong guesses by how much they differ, then order them worst
   * first. Scoring on the clue verdicts rather than picking at random is what
   * makes the three rows read as a narrowing: a random pair regularly produced
   * a second guess further away than the first, which shows the mechanic
   * backwards.
   */
  const scored = roster
    .filter((b) => b.id !== answer.id)
    .map((b) => {
      const clues = compareGuess(b, answer).clues;
      return { b, hits: clues.filter((c) => c.verdict !== 'miss').length };
    });

  const far = scored.filter((s) => s.hits <= 1).sort(() => 0)[0] ?? scored[0];
  const near =
    scored.filter((s) => s.hits >= 3 && s.b.id !== far.b.id).sort((a, z) => z.hits - a.hits)[0] ??
    scored.find((s) => s.b.id !== far.b.id);

  const guesses = [far?.b, near?.b, answer].filter(
    (b): b is NonNullable<typeof b> => b !== undefined,
  );

  return {
    date: yesterday,
    answerName: answer.name,
    answerId: answer.id,
    results: guesses.map((g) => compareGuess(g, answer)),
  };
}
