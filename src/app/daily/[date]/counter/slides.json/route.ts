import { counterOfDay } from '@/lib/daily-posts';
import { COUNTER_SLIDES, counterCaption } from '@/lib/daily-posts-slides';
import { SITE_URL } from '@/lib/site';

/**
 * The counter-of-the-day carousel for one day: slide URLs and the caption, for the
 * posting job on the box (`brawlzone-tiktok counter`). An empty `slides` list
 * means nothing worth posting today, which the job treats as a quiet day.
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
  const post = await counterOfDay(date).catch(() => null);
  const headers = {
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
  };
  if (!post) return Response.json({ date, count: 0, slides: [] }, { headers });

  const caption = counterCaption(post, SITE_URL);
  return Response.json(
    {
      date,
      brawler: post.target.name,
      title: caption.title,
      description: caption.description,
      count: COUNTER_SLIDES,
      slides: Array.from(
        { length: COUNTER_SLIDES },
        (_unused, i) => `${SITE_URL}/daily/${date}/counter/slides/${i}/image.jpg`,
      ),
    },
    { headers },
  );
}
