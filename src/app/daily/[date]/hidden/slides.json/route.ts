import { getHiddenMeta } from '@/lib/hidden-meta';
import { hiddenCaption, hiddenSlideCount } from '@/lib/hidden-slides';
import { SITE_URL } from '@/lib/site';

/**
 * The hidden-meta carousel for one day: slide URLs, and the caption.
 *
 * Same contract as the other three manifests. The caption is published here
 * rather than assembled on the box because it is made of the numbers the
 * slides draw, and deriving it twice would give two answers the first time
 * either changed.
 *
 * Note this one is not keyed on the date in any real sense -- the hidden meta
 * is a reading of the last seven days, not of one day. The date stays in the
 * path so the job, the cache key and the other three carousels all work the
 * same way, and so a given day's post stays reproducible after the fact.
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
  const data = await getHiddenMeta().catch(() => null);

  const headers = {
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
  };

  const count = hiddenSlideCount(data);
  if (!data || count === 0) {
    return Response.json({ date, count: 0, slides: [] }, { headers });
  }

  const caption = hiddenCaption(data, SITE_URL);

  return Response.json(
    {
      date,
      rated: data.rated,
      sleepers: data.sleepers.length,
      overrated: data.overrated.length,
      gems: data.gems.length,
      traps: data.traps.length,
      title: caption.title,
      description: caption.description,
      count,
      slides: Array.from(
        { length: count },
        (_unused, i) => `${SITE_URL}/daily/${date}/hidden/slides/${i}/image.jpg`,
      ),
    },
    { headers },
  );
}
