import { SITE_URL } from '@/lib/site';
import { tierOfDay } from '@/lib/tier-of-day';
import { tierCaption, tierSlideCount } from '@/lib/tier-slides';

/**
 * The tier-list carousel for one day: slide URLs, and the caption.
 *
 * The caption is published here rather than assembled on the box, for the same
 * reason the other two manifests are -- it is made of the numbers the slides
 * draw, and deriving it a second time in bash would be two implementations of
 * one claim that disagree the first time either changes.
 *
 * An empty `slides` array is a valid answer, not an error: on a morning when
 * the sampler has not produced enough decided battles to rank anybody, there
 * is nothing to post. The job treats that as "nothing today".
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
  const post = await tierOfDay(date).catch(() => null);

  const headers = {
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
  };

  if (!post) {
    return Response.json({ date, count: 0, slides: [] }, { headers });
  }

  const count = tierSlideCount(post);
  const caption = tierCaption(post, SITE_URL);

  return Response.json(
    {
      date,
      window: post.windowLabel,
      rated: post.rated,
      battles: post.battles,
      riser: post.riser?.name ?? null,
      faller: post.faller?.name ?? null,
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
