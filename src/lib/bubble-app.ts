/**
 * The Android app's release facts, in one place.
 *
 * The download page, the checksum it publishes and the structured data all
 * have to agree, and the one thing worse than no checksum is a stale one: it
 * fails verification on a good file and teaches the reader to skip the step.
 * So the numbers live here and every consumer reads them.
 *
 * Update all four together when a new APK is copied into `public/downloads/`.
 * `scripts/check-apk-release.ts` fails the test run if `size` or `sha256` stop
 * matching the file actually committed.
 */
export const BUBBLE_APP = {
  /** Matches `versionName` in the app's build.gradle.kts. */
  version: '1.3',
  /** Matches `versionCode`; Android upgrades compare this, not the name. */
  versionCode: 13,
  /** Served from this origin rather than a third party, so the download and
   *  the site people already trust come from the same place. */
  path: '/downloads/brawlzone-bubble.apk',
  /** Bytes, for the page and for `Content-Length` expectations. */
  size: 2642981,
  sha256: '09dab73e660cbb74a3146e8ddbfbd3d84e23007d81bf660b79c60ed5244c9625',
  /** Android 8.0. Matches `minSdk = 26`. */
  minAndroid: '8.0',
  released: '2026-09-03',
} as const;

/** "2.5 MB", for a reader deciding whether to tap on mobile data. */
export function bubbleAppSize(): string {
  return `${(BUBBLE_APP.size / 1024 / 1024).toFixed(1)} MB`;
}
