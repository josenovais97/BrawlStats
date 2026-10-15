"use client";

import { useT } from '@/components/i18n/use-t';

/**
 * The app in 51 seconds, as a vertical clip with sound.
 *
 * Replaced the two silent clips (the Bounty demo and the setup tutorial) in
 * October 2026: one video that covers the bubble over the game, map picks,
 * builds, languages and the look settings, made for the Play listing and the
 * TikTok account at the same time.
 *
 * Tap to play, not autoplay. It is 6 MB with a soundtrack; autoplaying it muted
 * would download all of it on every visit to show half of it, and the old
 * clips were 1.5 MB for the same reason. `preload="none"` means a reader who
 * never presses play never fetches a byte beyond the poster.
 *
 * 720x1280, crf 31, AAC 80k: flat UI on bright grounds compresses well, and
 * the panel's small text stays legible at that rate.
 *
 * `playsInline` keeps iOS Safari from forcing it fullscreen.
 */
export function DemoVideo({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <video
      className={`w-full ${className}`}
      controls
      playsInline
      preload="none"
      poster="/bubble/bubble-demo-poster.jpg"
      width={720}
      height={1280}
      aria-label={t('A 51-second tour of BrawlZone Bubble: the bubble floating over Brawl Stars, the best picks for the exact map, the build owners run, the panel in your language, and the bubble’s size and fade settings.')}
    >
      <source src="/bubble/bubble-demo.mp4" type="video/mp4" />
    </video>
  );
}
