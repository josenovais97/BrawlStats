import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getBattleLog, getClub, getPlayer } from '@/lib/bs-api';
import { BrawlApiError } from '@/lib/errors';

// 2026-11-19: a name typed into the Bubble app's tag field reached
// /api/bubble/* as a "tag". The client threw synchronously, past every
// caller's `.catch`, and each route answered 500 instead of "no such tag".
for (const [name, call] of [['getPlayer', getPlayer], ['getBattleLog', getBattleLog], ['getClub', getClub]] as const) {
  test(`${name} rejects a malformed tag instead of throwing`, async () => {
    let promise: Promise<unknown> | undefined;
    assert.doesNotThrow(() => {
      promise = call('MY NAME IS BOB');
    });
    await assert.rejects(promise!, (err: unknown) => err instanceof BrawlApiError && err.code === 'invalidTag');
  });
}
