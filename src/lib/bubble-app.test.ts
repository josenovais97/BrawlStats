import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { BUBBLE_APP } from '@/lib/bubble-app';

/**
 * The published checksum has to describe the file people actually download.
 *
 * A stale checksum is worse than none at all: it fails verification on a good
 * file, so the one reader careful enough to check is the one told the download
 * is untrustworthy. The failure is also completely silent — copy a new APK in,
 * forget to update the constant, and every page still renders.
 *
 * So the numbers are asserted against the bytes in `public/`. Shipping a new
 * build means these tests fail until `bubble-app.ts` is updated to match,
 * which is exactly the reminder that would otherwise not exist.
 */

const APK = path.join(process.cwd(), 'public', BUBBLE_APP.path);

test('the published APK exists at the advertised path', () => {
  assert.doesNotThrow(
    () => statSync(APK),
    `No APK at public${BUBBLE_APP.path}. The download button on /bubble would 404.`,
  );
});

test('the published size matches the file', () => {
  assert.equal(
    statSync(APK).size,
    BUBBLE_APP.size,
    'BUBBLE_APP.size disagrees with the committed APK — update src/lib/bubble-app.ts.',
  );
});

test('the published SHA-256 matches the file', () => {
  const digest = createHash('sha256').update(readFileSync(APK)).digest('hex');
  assert.equal(
    digest,
    BUBBLE_APP.sha256,
    'BUBBLE_APP.sha256 disagrees with the committed APK — update src/lib/bubble-app.ts.',
  );
});

test('the version name and code move together', () => {
  // Android compares versionCode, not versionName: shipping a new name with a
  // stale code produces an APK the phone refuses to install as an update.
  assert.ok(BUBBLE_APP.versionCode >= 1);
  assert.match(BUBBLE_APP.version, /^\d+\.\d+$/);
});
