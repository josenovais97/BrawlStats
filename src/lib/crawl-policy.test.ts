import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  CRAWLER_DISALLOW,
  SOCIAL_AGENTS,
  isCrawlerDisallowed,
  isSearchCrawler,
  shouldBlockCrawl,
} from '@/lib/crawl-policy';

/**
 * The policy that took the site offline on 2026-08-25 when it did not exist.
 *
 * Three things here break silently rather than loudly: a matcher that stops
 * covering a blocked path, an unfurler caught by a rule aimed at crawlers, and
 * a prefix that swallows the bare tool page it was supposed to leave alone.
 */

const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const DEEP_DRAFT = '/draft/gem-grab/hard-rock-mine/1-2-3/4-5';

test('the proxy matcher covers every disallowed prefix', () => {
  /*
   * Read as text rather than imported, because importing `src/proxy` pulls in
   * `next/server`, which pulls React client context, which cannot load outside
   * a request — the same thing that made `draft-route` a separate module.
   *
   * Reading the literal is the right target anyway: `config.matcher` has to be
   * statically analysable, so it cannot be built from `CRAWLER_DISALLOW`, and
   * the string the bundler parses is exactly the string asserted here.
   *
   * The drift this catches is the one that matters. A prefix added to the
   * policy without a matcher would be named in `robots.txt` and agreed with by
   * `shouldBlockCrawl`, while the proxy never ran for it — as unenforced as
   * having written nothing, and silent.
   */
  const source = readFileSync(path.join(__dirname, '..', 'proxy.ts'), 'utf8');
  const matcher = /matcher:\s*\[([^\]]*)\]/.exec(source);
  assert.ok(matcher, 'src/proxy.ts no longer declares a matcher array');

  const covered = new Set(
    [...matcher[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1].replace(/:path\*$/, '')),
  );
  for (const prefix of CRAWLER_DISALLOW) {
    assert.ok(covered.has(prefix), `${prefix} is disallowed but the proxy never sees it`);
  }
});

test('a search crawler is refused on the combinatorial paths', () => {
  assert.equal(shouldBlockCrawl(DEEP_DRAFT, GOOGLEBOT), true);
  assert.equal(shouldBlockCrawl('/compare/players/ABC123/XYZ789', GOOGLEBOT), true);
  assert.equal(shouldBlockCrawl('/player/2PP', GOOGLEBOT), true);
});

test('a person is never refused, on any path', () => {
  // The whole point of enforcing in the proxy rather than the page is that it
  // is decided on the user agent alone. Getting this wrong 404s real visitors
  // on the site's most-used feature.
  for (const agent of [CHROME, IPHONE]) {
    assert.equal(shouldBlockCrawl(DEEP_DRAFT, agent), false);
    assert.equal(shouldBlockCrawl('/player/2PP', agent), false);
    assert.equal(shouldBlockCrawl('/api/player/2PP', agent), false);
  }
});

test('unfurlers keep the exemption robots.txt grants them', () => {
  /*
   * Every name on this list contains `bot` or would otherwise trip the crawler
   * pattern, so the social check has to run first. If it stops doing so, a
   * profile pasted into a club chat silently unfurls as nothing — which is the
   * failure that made these named groups necessary in the first place.
   */
  for (const agent of SOCIAL_AGENTS) {
    assert.equal(isSearchCrawler(agent), false, agent);
    assert.equal(shouldBlockCrawl('/player/2PP', agent), false, agent);
    assert.equal(shouldBlockCrawl(DEEP_DRAFT, agent), false, agent);
    // Except the API, which is not a document set for anyone.
    assert.equal(shouldBlockCrawl('/api/player/2PP', agent), true, agent);
  }
});

test('the bare tools stay crawlable, and the prefix is why', () => {
  // `/draft` and `/compare` are what the sitemap lists. A prefix written
  // without its trailing slash would take both out of the index along with the
  // states beneath them.
  assert.equal(isCrawlerDisallowed('/draft'), false);
  assert.equal(isCrawlerDisallowed('/compare'), false);
  assert.equal(isCrawlerDisallowed('/compare/shelly-vs-colt'), false);
  assert.equal(isCrawlerDisallowed('/draft/gem-grab/hard-rock-mine'), true);
});

test('the crawler pattern is substrings, not a roster of names', () => {
  // Named individually this list would never be finished; these are the ones
  // that were actually seen, and none of them is spelled out in the source.
  for (const agent of [
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
    'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
  ]) {
    assert.equal(isSearchCrawler(agent), true, agent);
  }
});

test('curl is let through, because a documented operation runs on it', () => {
  /*
   * `/api/cron/refresh-stats` is triggered by hand with curl, and the route's
   * own `CRON_SECRET` is what guards it. Blocking the client to catch a
   * scraper that can rename itself anyway would break the trigger and stop
   * nothing.
   */
  assert.equal(shouldBlockCrawl('/api/cron/refresh-stats', 'curl/8.5.0'), false);
  assert.equal(shouldBlockCrawl('/api/cron/refresh-stats', null), false);
});

/*
 * The player allowlist.
 *
 * `/player/[tag]` is refused to crawlers wholesale because the tag space is
 * unbounded — that refusal is what stopped the outage repeating. The allowlist
 * carves a bounded hole in it for the ranked leaderboard's top 100, so the
 * tests that matter are the ones proving the hole stays exactly that size.
 */
const ALLOWED = new Set(['9PVU00U2P', '8PLLQ2C0']);

test('an allowlisted player is served to a crawler', () => {
  assert.equal(shouldBlockCrawl('/player/9PVU00U2P', 'Googlebot', ALLOWED), false);
  assert.equal(isCrawlerDisallowed('/player/9PVU00U2P', ALLOWED), false);
});

test('every other player tag stays refused', () => {
  assert.equal(shouldBlockCrawl('/player/NOTONTHELIST', 'Googlebot', ALLOWED), true);
  assert.equal(isCrawlerDisallowed('/player/NOTONTHELIST', ALLOWED), true);
});

test('an empty allowlist refuses everything, which is the safe build failure', () => {
  // scripts/gen-indexable-players.ts writes an empty set when it cannot reach
  // the database. That must never mean "allow all".
  assert.equal(shouldBlockCrawl('/player/9PVU00U2P', 'Googlebot', new Set()), true);
  assert.equal(shouldBlockCrawl('/player/9PVU00U2P', 'Googlebot', undefined), true);
});

test('the allowlist does not leak past the player route', () => {
  // A tag-shaped segment under another blocked prefix must not be matched.
  assert.equal(shouldBlockCrawl('/club/9PVU00U2P', 'Googlebot', ALLOWED), true);
  assert.equal(shouldBlockCrawl('/api/player/9PVU00U2P', 'Googlebot', ALLOWED), true);
  assert.equal(shouldBlockCrawl('/player/9PVU00U2P/extra', 'Googlebot', ALLOWED), true);
});

test('tag spellings normalise to one allowlist entry', () => {
  // The route canonicalises with normalizeTag, so the guard must agree or a
  // legitimate URL variant would 404 for a crawler that found it.
  for (const spelling of ['9pvu00u2p', '%239PVU00U2P', '9PVUOOU2P']) {
    assert.equal(
      shouldBlockCrawl(`/player/${spelling}`, 'Googlebot', ALLOWED),
      false,
      `${spelling} should resolve to the allowlisted tag`,
    );
  }
});

test('social unfurlers are unaffected by the allowlist', () => {
  // SOCIAL_DISALLOW is /api/ only, so Discord could always fetch a profile.
  // The carve-out must not change that in either direction.
  assert.equal(shouldBlockCrawl('/player/NOTONTHELIST', 'Discordbot', ALLOWED), false);
  assert.equal(shouldBlockCrawl('/api/player/X', 'Discordbot', ALLOWED), true);
});
