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
  version: '1.10',
  /** Matches `versionCode`; Android upgrades compare this, not the name. */
  versionCode: 28,
  /**
   * Served from this origin rather than a third party, so the download and the
   * site people already trust come from the same place.
   *
   * **The version is in the filename, and that is not cosmetic.** This used to
   * be one versionless path that each release overwrote, cached for a day. A
   * day is a long time when six releases ship in one: a phone that had fetched
   * the APK kept serving itself the copy it already had, so every update
   * installed the previous build. Fixes were reported as not working because
   * the binary carrying them never arrived — through four releases, while the
   * page around it updated instantly and said the new version was installed.
   *
   * A new release is now a new URL, which no cache can answer with the wrong
   * bytes. Bump this with `version` and `versionCode`; the test below fails if
   * the file at this path is not the one whose checksum is published.
   */
  path: '/downloads/brawlzone-bubble-1.10.apk',

  /**
   * The old versionless address, kept for links and QR codes already in the
   * world. Redirected to `path` and never cached — see `next.config.ts`.
   */
  legacyPath: '/downloads/brawlzone-bubble.apk',
  /** Bytes, for the page and for `Content-Length` expectations. */
  size: 3378930,
  sha256: '1215d20eb0d589f107c9bb3c6e67ecec0a6e3bf3c660e0f3c71c6d141c07687e',
  /** Android 8.0. Matches `minSdk = 26`. */
  minAndroid: '8.0',
  released: '2026-09-08',
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
    version: '1.10',
    versionCode: 28,
    date: '2026-09-10',
    changes: [
      'Scanning is back, and the bans work for the first time — the game draws them from a different artwork set, which is why they never matched before.',
      'One tap reads the mode, the map, both teams\u2019 picks and all six bans, then scores the picks for that map.',
      'The recognition is now tested against real captures of a real draft on every build, instead of only on your phone.',
    ],
  },
  {
    version: '1.9.3',
    versionCode: 27,
    date: '2026-09-09',
    changes: [
      'Starting the bubble no longer asks to share your screen. That prompt fired on every start once it had been allowed.',
      'The update download now opens the installer itself when it finishes, instead of relying on a notification that may be switched off.',
    ],
  },
  {
    version: '1.9.2',
    versionCode: 26,
    date: '2026-09-09',
    changes: [
      'The app finally asks for notification permission. Without it the update download finished invisibly and the bubble\u2019s Stop control was hidden — both looked like features that did nothing.',
      'The download now says which folder the file landed in, so it is findable even with notifications turned off.',
    ],
  },
  {
    version: '1.9.1',
    versionCode: 25,
    date: '2026-09-09',
    changes: [
      'Allowing screen sharing could ask again, and again, forever. Android was destroying the permission screen before it could receive your answer.',
      'A second scan sometimes did nothing at all. One scan that never finished left the button jammed for the rest of the session.',
      'The Download button in this notice finally downloads. Every version until now was blocked by Android from opening it, silently.',
    ],
  },
  {
    version: '1.9',
    versionCode: 24,
    date: '2026-09-09',
    changes: [
      'The screen-capture prompt no longer interrupts a match. Once you have allowed it, it is asked as the bubble starts instead of on your first scan.',
      'The prompt can no longer be answered with "Share one app", which captured the wrong thing.',
      'The Download button in the update notice works. It was a dead button inside the app.',
    ],
  },
  {
    version: '1.8.5',
    versionCode: 23,
    date: '2026-09-09',
    changes: [
      'The map is read from the screen on the first scan, instead of only after you had confirmed it once.',
      'A map it still cannot place falls back to the old behaviour — pick it once and it is remembered.',
    ],
  },
  {
    version: '1.8.4',
    versionCode: 22,
    date: '2026-09-09',
    changes: [
      'Scanning recognised about one brawler in six. It now matches each brawler on the framing that suits it, and reads the picks on both teams.',
      'Bans are still left blank rather than guessed at — the game draws them with artwork nothing public matches. Tap one in and it is remembered.',
      'The update notice now says which version you have, so you can tell a real update from a stuck banner.',
    ],
  },
  {
    version: '1.8.3',
    versionCode: 21,
    date: '2026-09-09',
    changes: [
      'Scanning read only half the draft. The frame was often captured before the panel had got out of the way, so the panel itself covered the enemy picks — it now waits for a frame taken after the overlay is hidden.',
      'What the scan found now shows immediately, instead of staying hidden until you had picked the map by hand.',
      'The panel says how many brawlers it read, so a scan that worked no longer looks like one that did nothing.',
    ],
  },
  {
    version: '1.8.2',
    versionCode: 20,
    date: '2026-09-09',
    changes: [
      'Scan works again. It could get stuck on “Loading portraits…” with the button disabled for the rest of the session, and never recover.',
      'Tapping Scan before the portraits have finished downloading now waits and then scans, instead of doing nothing.',
    ],
  },
  {
    version: '1.8.1',
    versionCode: 19,
    date: '2026-09-08',
    changes: [
      'Fixes 1.8, which crashed on launch and could not start the bubble at all. If you installed it, download again — this installs over the top.',
    ],
  },
  {
    version: '1.8',
    versionCode: 18,
    date: '2026-09-08',
    changes: [
      'Scan the draft instead of typing it: one tap reads the bans and picks off your screen and fills the board.',
      'The map is remembered. Confirm it once and every later scan on that map fills it in for you.',
      'Anything it is not sure about is left blank rather than guessed at — and correcting it teaches it that brawler for next time.',
    ],
  },
  {
    version: '1.7',
    versionCode: 17,
    date: '2026-09-08',
    changes: [
      'The keyboard no longer buries the draft picker: the panel moves above it, and searching is opt-in so the shortlist of likely picks is visible first.',
      'In landscape the keyboard no longer takes over the whole screen.',
    ],
  },
  {
    version: '1.6',
    versionCode: 16,
    date: '2026-09-04',
    changes: [
      'The panel says when it cannot reach the site, with a tap to retry, instead of spinning forever on a dropped connection.',
    ],
  },
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
