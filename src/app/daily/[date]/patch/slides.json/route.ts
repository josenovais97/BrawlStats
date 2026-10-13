import { SLIDE_DESIGN } from '@/lib/slide-kit';
import { patchOfDay } from '@/lib/daily-posts';
import { PATCH_SLIDES, patchCaption } from '@/lib/daily-posts-slides';
import { SITE_URL } from '@/lib/site';

/**
 * The balance-update carousel for one day: slide URLs and the caption, for the
 * posting job on the box (`brawlzone-tiktok patch`). An empty `slides` list
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
  const post = await patchOfDay(date).catch(() => null);
  const headers = {
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
  };
  if (!post) return Response.json({ date, count: 0, slides: [] }, { headers });

  const caption = patchCaption(post, SITE_URL);
  return Response.json(
    {
      date,
      update: post.title, updateDate: post.updateDate,
      title: caption.title,
      description: caption.description,
      count: PATCH_SLIDES,
      slides: Array.from(
        { length: PATCH_SLIDES },
        (_unused, i) => `${SITE_URL}/daily/${date}/patch/slides/${i}/image.jpg?v=${SLIDE_DESIGN}`,
      ),
    },
    { headers },
  );
}
