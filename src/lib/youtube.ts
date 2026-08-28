import 'server-only';

/**
 * The channel's latest video, from the public RSS feed.
 *
 * No API key and no quota: YouTube still publishes `feeds/videos.xml` for any
 * channel id, which carries the title, id and publish date of the most recent
 * uploads. That is everything a card needs, and it avoids putting a Google API
 * key on the box for one line of text.
 *
 * The channel id is hard-coded rather than resolved from the `@handle` at
 * runtime. Resolving it means fetching and scraping an 800 KB channel page on
 * every cache miss to recover a string that changes never — the handle can be
 * renamed, the id cannot.
 *
 * Checked 2026-08-28: the feed returns 200 with the channel title and zero
 * entries, because the channel has no public videos yet. That is the reason
 * every caller here is built to render nothing rather than to show a frame —
 * the empty state is the *current* state, not a hypothetical one.
 */

/** youtube.com/@brawlzonenet. Stable across handle renames. */
const CHANNEL_ID = 'UCFHUOC2ySM5BLMVhY9Hxdjw';

const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;

/** An upload changes rarely; six hours is plenty and stays polite. */
const REVALIDATE_VIDEO = 21_600;

export interface LatestVideo {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  /** `hqdefault` exists for every video, including ones still processing. */
  thumbnailUrl: string;
}

/** First capture of the first match, unescaped, or null. */
function tag(xml: string, name: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  if (!match) return null;
  const value = match[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
  return value || null;
}

/**
 * Returns null on an empty channel, an unreachable feed, or a malformed one.
 *
 * Three different failures, one outcome, deliberately: the homepage has no
 * useful way to distinguish them and no reason to. A card that cannot say what
 * the latest video is should not be on the page at all.
 */
export async function getLatestVideo(): Promise<LatestVideo | null> {
  try {
    const res = await fetch(FEED, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      next: { revalidate: REVALIDATE_VIDEO },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const xml = await res.text();

    // The channel's own <title> and <published> sit outside every <entry>, so
    // the first entry has to be isolated before anything is read — otherwise
    // an empty channel yields the channel name and its creation date dressed
    // up as a video.
    const entry = /<entry>([\s\S]*?)<\/entry>/.exec(xml)?.[1];
    if (!entry) return null;

    const id = tag(entry, 'yt:videoId');
    const title = tag(entry, 'title');
    if (!id || !title) return null;

    return {
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      publishedAt: tag(entry, 'published'),
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  } catch {
    // An unreachable feed costs the card, never the page.
    return null;
  }
}
