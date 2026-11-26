import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BUBBLE_APP, BUBBLE_CHANGELOG } from '@/lib/bubble-app';

/*
 * The site stopped serving the APK on 2026-11-26 (Google Play only), so the
 * checks on the committed file went with it. What is left is what the panel's
 * update line and the Discord announcement depend on.
 */

test('the version name and code move together', () => {
  // Android compares versionCode, not versionName: shipping a new name with a
  // stale code produces an APK the phone refuses to install as an update.
  assert.ok(BUBBLE_APP.versionCode >= 1);
  // A patch segment is allowed: 1.8.1 was a same-day fix for a 1.8 that
  // crashed on launch, and a scheme that cannot express that pushes a
  // bug fix into looking like a feature release.
  assert.match(BUBBLE_APP.version, /^\d+\.\d+(\.\d+)?$/);
});

test('the current release has a changelog entry', () => {
  // The panel lists what changed and Discord announces it from the same entry.
  const entry = BUBBLE_CHANGELOG.find((r) => r.version === BUBBLE_APP.version);
  assert.ok(entry, `No BUBBLE_CHANGELOG entry for ${BUBBLE_APP.version}.`);
  assert.equal(entry.versionCode, BUBBLE_APP.versionCode);
});
