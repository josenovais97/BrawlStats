import { answerFor } from '@/lib/brawldle';
import { brawldleRoster } from '@/lib/brawldle-data';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { gadgetIconUrl, starPowerIconUrl } from '@/lib/brawlapi';

/**
 * Hints, unlocked by guess count.
 *
 * Real game art rather than more words: the answer's star power at four
 * guesses, its gadget at eight. An icon is a much better hint than a
 * sentence — it is recognisable to anyone who plays, and useless to anyone
 * who does not, which is the right audience filter for a hint.
 *
 * Names are deliberately NOT sent, only the images. "Come To Papa" is
 * searchable and would end the puzzle; the picture is a memory test, which is
 * what a hint should be.
 *
 * The guess count comes from the client and cannot be verified — there is no
 * session and deliberately no account. A player who lies only spoils their
 * own puzzle, which is the same bargain every daily of this kind makes.
 */

export const dynamic = 'force-dynamic';

const STAR_POWER_AT = 4;
const GADGET_AT = 8;

export async function GET(request: Request) {
  const after = Number(new URL(request.url).searchParams.get('after') ?? '0');
  const guesses = Number.isFinite(after) ? Math.max(0, Math.floor(after)) : 0;

  const unlocked = {
    starPower: guesses >= STAR_POWER_AT,
    gadget: guesses >= GADGET_AT,
  };

  const thresholds = { starPower: STAR_POWER_AT, gadget: GADGET_AT };

  // Nothing unlocked means nothing to look up, and no reason to read the
  // roster or call the game API at all.
  if (!unlocked.starPower && !unlocked.gadget) {
    return Response.json(
      { thresholds, starPower: null, gadget: null },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  const roster = await brawldleRoster().catch(() => []);
  const answer = answerFor(new Date().toISOString().slice(0, 10), roster);
  if (!answer) {
    return Response.json({ thresholds, starPower: null, gadget: null }, { status: 503 });
  }

  const official = await getOfficialBrawlers()
    .then((r) => r.items.find((b) => b.id === answer.id))
    .catch(() => undefined);

  return Response.json(
    {
      thresholds,
      starPower:
        unlocked.starPower && official?.starPowers?.[0]
          ? starPowerIconUrl(official.starPowers[0].id)
          : null,
      gadget:
        unlocked.gadget && official?.gadgets?.[0] ? gadgetIconUrl(official.gadgets[0].id) : null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
