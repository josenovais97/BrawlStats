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
  version: '1.5',
  /** Matches `versionCode`; Android upgrades compare this, not the name. */
  versionCode: 15,
  /** Served from this origin rather than a third party, so the download and
   *  the site people already trust come from the same place. */
  path: '/downloads/brawlzone-bubble.apk',
  /** Bytes, for the page and for `Content-Length` expectations. */
  size: 2643753,
  sha256: 'bda5a5ea5908f5631c51b07a0e8b974fd0a6c441e1d6bc65bc5cda5b388d4995',
  /** Android 8.0. Matches `minSdk = 26`. */
  minAndroid: '8.0',
  released: '2026-09-04',
} as const;

/** "2.5 MB", for a reader deciding whether to tap on mobile data. */
export function bubbleAppSize(): string {
  return `${(BUBBLE_APP.size / 1024 / 1024).toFixed(1)} MB`;
}

/** One shipped version and what changed in it. */
export interface BubbleRelease {
  version: string;
  versionCode: number;
  date: string;
  changes: string[];
}

/**
 * What changed, newest first.
 *
 * Lives here rather than in the app because the app cannot be updated to tell
 * you about the update — whatever is installed is by definition the version
 * that does not know. The panel is a web view of this site, so the changelog
 * reaches an out-of-date install the moment the site deploys, which is exactly
 * the property a changelog needs and an APK cannot have.
 *
 * `versionCode` is what the update check compares. Android upgrades on that
 * number, not on the name, so it is the one that has to be right.
 */
export const BUBBLE_CHANGELOG: BubbleRelease[] = [
  {
    version: '1.5',
    versionCode: 15,
    date: '2026-09-04',
    changes: [
      'The update notice downloads the new version directly, instead of sending you to the site to find the button.',
      'Links in the panel now open in your browser rather than inside the overlay.',
    ],
  },
  {
    version: '1.4',
    versionCode: 14,
    date: '2026-09-04',
    changes: [
      'The panel now tells you when a newer version of the app is out, and what changed in it.',
    ],
  },
  {
    version: '1.3',
    versionCode: 13,
    date: '2026-09-03',
    changes: [
      'Fixed the panel in landscape, which is how the game is actually played — it was arriving a third of its intended height.',
      'The bubble and panel now follow the screen when you rotate, instead of keeping coordinates from the previous orientation.',
      'The panel no longer lands on top of the bubble in landscape, which had been swallowing every tap meant for it.',
      'Filter the tier list by game mode, and the choice is remembered next time you open it.',
      'Tap any brawler for the star power, gadget and gears its owners run.',
    ],
  },
  {
    version: '1.2',
    versionCode: 12,
    date: '2026-09-03',
    changes: [
      'The panel opens on the Ranked tier list, built for the overlay, instead of loading the full site into a small window.',
    ],
  },
  {
    version: '1.1',
    versionCode: 11,
    date: '2026-09-03',
    changes: [
      'Rebuilt the app screen: real spacing, the site’s palette, and system bars that match.',
    ],
  },
  {
    version: '1.0',
    versionCode: 10,
    date: '2026-09-03',
    changes: [
      'First release. Tapping the bubble opens and closes the panel, dragging moves it, and dropping it on the target at the bottom closes it.',
    ],
  },
];

/** Releases newer than the version a reader is running. */
export function releasesSince(versionCode: number): BubbleRelease[] {
  return BUBBLE_CHANGELOG.filter((r) => r.versionCode > versionCode);
}
