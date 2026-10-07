import { SITE_URL } from '@/lib/site';
import { mapOfDay } from '@/lib/map-of-day';
import { mapCaption, mapSlideCount } from '@/lib/map-slides';

/**
 * The midday carousel for one day: slide URLs, and the caption.
 *
 * Still served under `/tiers/` although it is now the Ranked map of the day
 * rather than the roster-wide tier list (replaced 2026-10-07). The path is what
 * the posting job, its timer and health check 11 all key on, and the content is
 * still a tier list -- for one map. Renaming it would mean changing four files
 * on the box for a word.
 *
 * The caption is published here rather than assembled on the box, for the same
 * reason the other manifests are: it is made of the numbers the slides draw.
 *
 * An empty `slides` array is a valid answer, not an error: with no map sampled
 * well enough to post, the job reads it as "nothing today".
 */

export const revalidate = 86400;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const post = await mapOfDay(date).catch(() => null);

  const headers = {
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
  };

  if (!post) {
    return Response.json({ date, count: 0, slides: [] }, { headers });
  }

  const count = mapSlideCount(post);
  const caption = mapCaption(post, SITE_URL);

  return Response.json(
    {
      date,
      mode: post.mode,
      map: post.mapName,
      rotation: `${post.position}/${post.poolSize}`,
      battles: post.sampleSize,
      title: caption.title,
      description: caption.description,
      count,
      slides: Array.from(
        { length: count },
        (_unused, i) => `${SITE_URL}/daily/${date}/tiers/slides/${i}/image.jpg`,
      ),
    },
    { headers },
  );
}
