import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Nothing behind `cachedRead` may return a Map.
 *
 * `unstable_cache` serialises what it stores, and a Map does not survive the
 * round trip: it comes back as a plain object. The failure mode is the worst
 * kind — the uncached call works, so it passes locally, passes review, and
 * passes the first request after a deploy. It breaks only once the cache is
 * warm, as `TypeError: c.get is not a function`, on a page that had been
 * rendering correctly minutes earlier.
 *
 * That shipped twice on 2026-09-02 (`getMapMatchups`, `getLadderMapForm`) and
 * silently removed a section from every map page. The convention that works is
 * the one `getBestPicksByMode` already used: cache the entries, rebuild the Map
 * outside the cache boundary.
 *
 * Checked against the source rather than at runtime because the runtime path
 * needs a database, and because the mistake is visible in the type signature —
 * which is exactly where it should be caught.
 */
const SOURCE = readFileSync(new URL('./stats.ts', import.meta.url), 'utf8');

/** `export const x = cachedRead('key', fn)` and the `const x = ...` form. */
function cachedFunctionNames(source: string): string[] {
  return [...source.matchAll(/cachedRead\(\s*'[^']+'\s*,\s*(\w+)\s*\)/g)].map((m) => m[1]);
}

/**
 * The declared return type of `async function name(...): Promise<T>`.
 *
 * The parameter list is walked with a depth counter rather than matched. A
 * return type like `Promise<{ comps: X[] } | null>` carries braces of its own,
 * so anything scanning for the first `{` after the name stops in the middle of
 * the type it is trying to read.
 */
function declaredReturn(source: string, name: string): string | null {
  const at = source.search(new RegExp(`async function ${name}\\b`));
  if (at === -1) return null;

  const open = source.indexOf('(', at);
  if (open === -1) return null;

  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return null;

  // From the end of the parameters to the brace that opens the body.
  const tail = source.slice(close + 1, source.indexOf('\n', close)).trim();
  const match = /^:\s*(.+?)\s*\{$/.exec(tail);
  return match ? match[1].replace(/\s+/g, ' ') : null;
}

test('every cachedRead function is registered against a real function', () => {
  const names = cachedFunctionNames(SOURCE);
  assert.ok(names.length > 10, `expected many cached reads, found ${names.length}`);

  for (const name of names) {
    assert.notEqual(declaredReturn(SOURCE, name), null, `${name} has no declared return type`);
  }
});

test('no cached read returns a Map, which the data cache cannot store', () => {
  const offenders = cachedFunctionNames(SOURCE).filter((name) => {
    const declared = declaredReturn(SOURCE, name);
    return declared !== null && /Promise<\s*Map</.test(declared);
  });

  assert.deepEqual(
    offenders,
    [],
    `these cached reads return a Map, which survives the first call and then ` +
      `deserialises to a plain object: ${offenders.join(', ')}. Return entries ` +
      `and rebuild the Map in the exported wrapper, as getBestPicksByMode does.`,
  );
});
