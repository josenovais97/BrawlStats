import { SITE_URL } from '@/lib/site';
import { dailyCaption, slideCount } from '@/lib/daily-slides';
import { getDailyReport } from '@/lib/stats';

/**
 * The carousel's contents for one day, as absolute URLs in posting order.
 *
 * The posting job needs to know how many slides exist before it can ask TikTok
 * to fetch them, and the number varies: a quiet day produces fewer findings
 * and therefore fewer slides. Deriving it on the box would mean the job
 * re-implementing `slideCount` and the two drifting apart the first time the
 * carousel changes shape. This makes the render the single source of truth and
 * the job a consumer of it.
 *
 * Absolute URLs because the consumer is TikTok's fetcher, not a browser on
 * this origin.
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
  const report = await getDailyReport(date).catch(() => null);
  const count = slideCount(report);
  const caption = dailyCaption(report, SITE_URL);

  const slides = Array.from(
    { length: count },
    (_unused, i) => `${SITE_URL}/daily/${date}/slides/${i}/image.jpg`,
  );

  return Response.json(
    {
      date,
      findings: report?.discoveries.length ?? 0,
      title: caption.title,
      description: caption.description,
      count,
      slides,
    },
    {
      headers: {
        'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
      },
    },
  );
}
