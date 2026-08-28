import { Play } from "lucide-react";
import Image from "next/image";

import { CHANNEL_URL, getLatestVideo } from "@/lib/youtube";

/**
 * The channel's latest video, as one row rather than as a section.
 *
 * Deliberately small. The homepage sells a stats site, and a video embed given
 * real estate proportional to its interest would be an advert wearing the
 * layout of a feature — so this is a single card with a thumbnail, a title and
 * a way in, sitting under the snapshot where someone who has just read the
 * numbers might want them explained out loud.
 *
 * No iframe. An embed loads Google's player, its cookies and a few hundred KB
 * on every homepage view to show a frame nobody asked to play; a thumbnail
 * that links out costs one image and behaves the same for anyone who clicks.
 *
 * Renders nothing when the channel has no videos, which is the state today —
 * see `lib/youtube`. It will appear on its own with the first upload.
 */
export async function HomeLatestVideo() {
  const video = await getLatestVideo();
  if (!video) return null;

  const published = video.publishedAt ? new Date(video.publishedAt) : null;
  const dateLabel =
    published && !Number.isNaN(published.getTime())
      ? published.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card card-interactive group flex items-center gap-4 p-3 transition-colors hover:border-brand/50 sm:p-4"
    >
      <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-40">
        <Image
          src={video.thumbnailUrl}
          alt=""
          width={160}
          height={90}
          className="size-full object-cover"
          loading="lazy"
          unoptimized
        />
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-black/30 transition-colors group-hover:bg-black/10"
        >
          <span className="grid size-8 place-items-center rounded-full bg-black/60">
            <Play className="size-4 translate-x-px fill-white text-white" />
          </span>
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="eyebrow text-accent">Latest video</span>
        <span className="mt-1 line-clamp-2 block font-bold leading-snug transition-colors group-hover:text-brand">
          {video.title}
        </span>
        <span className="mt-1 block text-xs text-muted">
          {dateLabel ? `${dateLabel} · ` : ""}youtube.com/@brawlzonenet
        </span>
      </span>
    </a>
  );
}

/** The channel, for anywhere that wants it without the latest-video fetch. */
export { CHANNEL_URL };
