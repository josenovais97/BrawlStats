import { seasonStory } from '@/lib/season-story';

/** The running Ranked season as a phone story; see lib/season-story. */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ tag: string; lang: string }> }) {
  const { tag, lang } = await params;
  return seasonStory(tag, lang, 'auto');
}
