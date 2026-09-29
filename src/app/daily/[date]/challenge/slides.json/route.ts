import { challengePost } from '@/lib/challenge-post';
import { challengeCaption, challengeSlideCount } from '@/lib/challenge-slides';
import { SITE_URL } from '@/lib/site';

/** The daily-challenge promo carousel: slide URLs and the caption. */

export const revalidate = 86400;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const post = await challengePost().catch(() => null);
  const headers = {
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
  };

  const count = challengeSlideCount(post);
  if (!post || count === 0) return Response.json({ date, count: 0, slides: [] }, { headers });

  const caption = challengeCaption(post, SITE_URL);
  return Response.json(
    {
      date,
      answer: post.answerName,
      guesses: post.results.length,
      title: caption.title,
      description: caption.description,
      count,
      slides: Array.from(
        { length: count },
        (_unused, i) => `${SITE_URL}/daily/${date}/challenge/slides/${i}/image.jpg`,
      ),
    },
    { headers },
  );
}
