import { brawlerOfDay } from '@/lib/brawler-of-day';
import { buildCaption, buildSlideCount } from '@/lib/build-slides';
import { SITE_URL } from '@/lib/site';

/**
 * The brawler-build carousel for one day: slide URLs, and the caption.
 *
 * The caption is published here rather than assembled on the box, because it
 * is made of the same numbers the slides draw -- which star power leads, by
 * how much, off how many first-buyers. Deriving it a second time in bash would
 * be two implementations of one claim, and they would disagree the first time
 * either changed.
 *
 * An empty `slides` array is a valid answer, not an error: the rotation skips
 * brawlers whose split is too thin to post, and on a day when the sampler has
 * not produced enough data there may be nothing worth posting at all. The job
 * treats that as "nothing today" rather than as a failure.
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
  const day = await brawlerOfDay(date).catch(() => null);

  const headers = {
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
  };

  if (!day) {
    return Response.json({ date, brawler: null, count: 0, slides: [] }, { headers });
  }

  const count = buildSlideCount(day);
  const caption = buildCaption(day, SITE_URL);

  return Response.json(
    {
      date,
      brawler: day.name,
      slug: day.slug,
      confidence: day.choices.confidence,
      firstBuyers: day.choices.sampleSize,
      title: caption.title,
      description: caption.description,
      count,
      slides: Array.from(
        { length: count },
        (_unused, i) => `${SITE_URL}/daily/${date}/build/slides/${i}/image.jpg`,
      ),
    },
    { headers },
  );
}
