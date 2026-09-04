'use client';

import Image from 'next/image';
import { useSyncExternalStore } from 'react';

/**
 * The app running, as a looping clip.
 *
 * Deliberately a video and not a GIF. These nineteen seconds as a GIF would be
 * north of 20 MB; as H.264 it is 1.3 MB, and this sits on the hero of the page
 * the app is downloaded from. On a box with fixed bandwidth and two shared
 * cores that difference is the whole argument — a muted, looping, inline video
 * behaves exactly like a GIF to a reader and costs a twentieth as much.
 *
 * Encoded at crf 32 rather than the 27 it started at. The content is flat UI on
 * a dark ground, which is the easiest thing there is to compress: the brawler
 * names and scores are pixel-identical between the two, and the file is a third
 * smaller.
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
      aria-label="A Hot Zone draft from the queue onward: the bubble opens the Ranked tier list, the filter switches to Hot Zone, tapping Bo shows what owners have unlocked, and Bo is then picked and given that star power."
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
