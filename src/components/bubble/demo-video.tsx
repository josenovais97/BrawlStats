'use client';

import Image from 'next/image';
import { useSyncExternalStore } from 'react';

/**
 * The app running, as a looping clip.
 *
 * Deliberately a video and not a GIF. The same nine seconds as a GIF is around
 * 10 MB; as H.264 it is under 900 KB, and this sits on the hero of the page the
 * app is downloaded from. On a box with fixed bandwidth and two shared cores,
 * that difference is the whole argument — a muted, looping, inline video
 * behaves exactly like a GIF to a reader and costs a fifteenth as much.
 *
 * `playsInline` is the one that bites: without it iOS Safari yanks the video
 * fullscreen the moment it autoplays, which on a page about an Android app is
 * a strange thing to do to an iPhone.
 *
 * No WebM. VP9 was measured *larger* than H.264 here (975 KB against 877), and
 * every browser in use plays H.264 in MP4, so a second encode would add a
 * megabyte to the image to serve nobody.
 */
export function DemoVideo() {
  /*
   * Motion is a preference, and autoplay ignores it.
   *
   * `useSyncExternalStore` rather than an effect: a media query is exactly the
   * external store it exists for, the server snapshot is a plain `false`, and
   * it re-renders if the reader changes the setting while the page is open.
   * Rendering the still instead also means the video is never fetched, which a
   * CSS-only `display: none` would not achieve.
   */
  const reduced = useSyncExternalStore(subscribe, snapshot, () => false);

  if (reduced) {
    return (
      <Image
        src="/bubble/in-game.jpg"
        alt="The BrawlZone panel open during a Knockout draft, showing the S, A and B tiers with meta scores"
        width={1560}
        height={720}
        className="w-full"
        priority
      />
    );
  }

  return (
    <video
      className="w-full"
      autoPlay
      muted
      loop
      playsInline
      poster="/bubble/demo-poster.jpg"
      aria-label="The bubble opened during a Hot Zone draft: the panel folds out with the Ranked tier list, the filter switches to Hot Zone, and tapping Bo shows what owners have unlocked."
    >
      <source src="/bubble/demo.mp4" type="video/mp4" />
    </video>
  );
}

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function snapshot() {
  return window.matchMedia(QUERY).matches;
}
