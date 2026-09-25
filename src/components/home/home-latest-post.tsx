import { Music2 } from 'lucide-react';
import Image from 'next/image';

import { TIKTOK_PROFILE_URL, getLatestTikTokPost } from '@/lib/tiktok-latest';

/**
 * The newest post on the site's own TikTok, as one row rather than a section.
 *
 * Replaces the YouTube card that sat here. The channel gets an upload when
 * somebody records one; the TikTok account gets two posts a day from the box,
 * so this is the row on the homepage most likely to be showing something new
 * — which is the only thing that makes a "latest" card worth its space.
 *
 * No embed. TikTok's is an iframe carrying its player and its cookies on every
 * homepage view, to show a frame nobody asked to play. A cover image that
 * links out costs one request and behaves the same for anyone who clicks.
 *
 * Renders nothing until the box has written a row, which is the state before
 * the first refresh. The card this replaced shipped without that guard and
 * showed an empty frame for a day; this one keeps it on purpose.
 */
export async function HomeLatestPost() {
  const post = await getLatestTikTokPost();
  if (!post) return null;

  const posted = post.postedAt ? new Date(post.postedAt) : null;
  const dateLabel =
    posted && !Number.isNaN(posted.getTime())
      ? posted.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card card-interactive group flex items-center gap-4 p-3 transition-colors hover:border-brand/50 sm:p-4"
    >
      {/* 9:16, matching what the slides are rendered at, so the cover is not
          letterboxed into a landscape box the way the video thumbnail was. */}
      <span className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-24">
        {post.coverUrl ? (
          <Image
            src={post.coverUrl}
            alt=""
            width={144}
            height={256}
            className="size-full object-cover"
            loading="lazy"
            /* TikTok's CDN signs its cover URLs and rejects the optimizer's
               fetch, so this goes straight to the browser unoptimised. */
            unoptimized
          />
        ) : (
          <span aria-hidden className="grid size-full place-items-center">
            <Music2 className="size-5 text-muted" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="eyebrow text-accent">Latest on TikTok</span>
        <span className="mt-1 line-clamp-2 block font-bold leading-snug transition-colors group-hover:text-brand">
          {post.title || 'Today’s findings, measured from sampled battles'}
        </span>
        <span className="mt-1 block text-xs text-muted">
          {dateLabel ? `${dateLabel} · ` : ''}tiktok.com/@brawlzone.net
        </span>
      </span>
    </a>
  );
}

export { TIKTOK_PROFILE_URL };
