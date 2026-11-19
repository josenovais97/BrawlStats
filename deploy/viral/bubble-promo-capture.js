// The Bubble promo's panel captures (2026-11-19, make.py bubblepromo v3): every
// state the video taps through, as the Play app opens the panel, at 2.5x, and
// where each button sits (CSS px, boxes.json). The owner's in-game name is
// painted over as "YOU" and club mates' names replaced; the settings demo
// (f-*) runs on a made-up mid account (the roster call answered locally).
// TAG comes from the environment and is never written anywhere.
//   docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -e TAG=<tag> -v $PWD:/tool -v <out>:/out -w /tool \
//     mcr.microsoft.com/playwright:v1.49.1-noble node bubble-promo-capture.js   (needs playwright in /tool/node_modules)
// then JPEG q90 into $ASSETS/bubble-promo/v3/ with boxes.json.
const { chromium } = require('playwright');
const fs = require('fs');
const TAG = process.env.TAG;
const OUT = '/out/hi';
const boxes = {};
(async () => {
  const owner = await fetch(`https://brawlzone.net/api/bubble/roster?tag=${TAG}`).then((r) => r.json());
  const NAME = owner.name || '';
  // A typical mid account for the settings demo: 55 owned, 14 at power 11, 4 hypercharged.
  const ids = owner.brawlers.map((b) => b.id).sort((a, b) => a - b);
  const demo = { ...owner, brawlers: ids.filter((id, i) => (i * 7) % 13 < 7 || [16000026, 16000014, 16000031].includes(id)).map((id, i) => ({ id, power: (i % 4 === 0 || [16000026, 16000031].includes(id)) ? 11 : 7 + (i % 4), hypercharge: i % 13 === 0 || id === 16000026 })) };
  const browser = await chromium.launch();
  const open = async (tab, extra = {}, roster = null, scale = 2.5) => {
    const ctx = await browser.newContext({ viewport: { width: 460, height: 860 }, deviceScaleFactor: scale, locale: 'en-US' });
    await ctx.addInitScript(([t, e]) => { try { localStorage.setItem('brawlzone-bubble-tag', t); for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v); } catch {} }, [TAG, extra]);
    if (roster) await ctx.route('**/api/bubble/roster**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(roster) }));
    const page = await ctx.newPage();
    await page.goto(`https://brawlzone.net/bubble/panel?app=bubble#v=54&s=play${tab ? '&tab=' + tab : ''}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    return page;
  };
  const mask = async (page) => NAME && page.evaluate((n) => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let x = walk.nextNode(); x; x = walk.nextNode()) if (x.nodeValue && x.nodeValue.includes(n)) x.nodeValue = x.nodeValue.split(n).join('YOU');
    for (const el of document.querySelectorAll('span,p,div,b,strong')) if (el.children.length === 0 && el.textContent.replace(/\s/g, '') === n) el.textContent = 'YOU';
  }, NAME);
  const box = async (page, loc) => { const b = await loc.boundingBox().catch(() => null); if (!b) return null; const sy = await page.evaluate(() => window.scrollY); return [Math.round(b.x), Math.round(b.y + sy), Math.round(b.width), Math.round(b.height)]; };
  const shot = async (page, name, extra = {}, full = true) => {
    await mask(page);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    const h = await page.evaluate(() => document.body.scrollHeight);
    boxes[name] = { h, ...extra };
    const items = await page.evaluate(() => [...document.querySelectorAll('button, [role=tab], a')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y + scrollY)} ${Math.round(r.width)}x${Math.round(r.height)} ${(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,50)}`; }));
    fs.writeFileSync(`${OUT}/${name}.txt`, items.join('\n'));
    console.log(name, h);
  };
  const step = async (label, fn) => { try { await fn(); } catch (e) { console.log('FAIL', label, String(e).split('\n')[0]); } };
  const btn = (p, re) => p.getByRole('button', { name: re }).first();
  const tabBox = async (p) => { const o = {}; for (const [k, re] of [['meta', /^Meta$/], ['comps', /^Team comp$/], ['draft', /^Draft$/], ['counters', /^Counters$/], ['trophies', /^Trophies$/]]) o[k] = await box(p, p.getByRole('tab', { name: re }).first()); return o; };

  await step('chooser', async () => { const p = await open(null); await shot(p, 'chooser', { meta: await box(p, p.locator('ul button').first()), counters: await box(p, p.locator('ul button').nth(3)) }); await p.context().close(); });
  await step('meta', async () => {
    const p = await open('meta');
    await shot(p, 'meta', { tabs: await tabBox(p), ko: await box(p, btn(p, /^Knockout$/)), bb: await box(p, btn(p, /^Brawl Ball$/)), masters: await box(p, btn(p, /^Masters\+$/)), bibi: await box(p, btn(p, /^Bibi/)), header: await box(p, p.getByText('Last').first()) });
    await btn(p, /^Knockout$/).click(); await p.waitForTimeout(1500); await shot(p, 'meta-ko', { bb: await box(p, btn(p, /^Brawl Ball$/)) });
    await btn(p, /^Brawl Ball$/).click(); await p.waitForTimeout(1500); await shot(p, 'meta-bb', { masters: await box(p, btn(p, /^Masters\+$/)) });
    await btn(p, /^Masters\+$/).click(); await p.waitForTimeout(1500); await shot(p, 'meta-masters');
    await p.context().close();
  });
  await step('build', async () => { const p = await open('meta'); await btn(p, /^Bibi/).click(); await p.waitForTimeout(2200); await shot(p, 'build', {}, false); await p.context().close(); });
  await step('header', async () => {
    const p = await open('meta'); await p.getByText('Last').first().click(); await p.waitForTimeout(2200);
    // Club mates are other players: their names never go in a video.
    await p.evaluate(() => { let n = 2; for (const li of document.querySelectorAll('li, tr')) { const t = li.textContent || ''; if (/^\s*\d/.test(t) && !/YOU|\(you\)/.test(t)) for (const s of li.querySelectorAll('span,a,p')) if (s.children.length === 0 && /[A-Za-z_]/.test(s.textContent) && !/^\d/.test(s.textContent.trim())) { s.textContent = `Club mate ${n}`; n++; break; } } });
    await shot(p, 'header', {}, false); await p.context().close();
  });
  await step('comps', async () => { const p = await open('comps'); await shot(p, 'comps', { tabs: await tabBox(p) }); await p.context().close(); });
  await step('trophies', async () => { const p = await open('trophies'); await shot(p, 'trophies', { tabs: await tabBox(p) }); await p.context().close(); });
  await step('draft', async () => {
    const p = await open('draft');
    await shot(p, 'draft-modes', { ko: await box(p, btn(p, /^Knockout$/)) }, false);
    await btn(p, /^Knockout$/).click(); await p.waitForTimeout(1800);
    await shot(p, 'draft-maps', {}, false);
    const map = p.locator('button').filter({ hasText: /Out in the Open|Flowing Springs|Goldarm Gulch|Belle's Rock|New Horizons/ }).first();
    const mb = await box(p, map);
    await map.click(); await p.waitForTimeout(2500);
    boxes['draft-maps'].map = mb;
    await shot(p, 'draft-picks');
    const bans = p.getByRole('button', { name: /^Bans?$/ }).first();
    boxes['draft-picks'].bans = await box(p, bans);
    await bans.click(); await p.waitForTimeout(1500); await shot(p, 'draft-bans');
    await p.context().close();
  });
  await step('meta-map-bans', async () => {
    const p = await open('meta');
    await btn(p, /^Knockout$/).click(); await p.waitForTimeout(1500);
    await btn(p, /^Out In The Open$/).click(); await p.waitForTimeout(2000);
    await shot(p, 'meta-map', { ban: await box(p, btn(p, /^Ban$/)) });
    await btn(p, /^Ban$/).click(); await p.waitForTimeout(1500); await shot(p, 'meta-map-bans');
    await p.context().close();
  });
  await step('draft-fill', async () => {
    const p = await open('draft');
    await btn(p, /^Knockout$/).click(); await p.waitForTimeout(1500);
    await btn(p, /^Out In The Open$/).click(); await p.waitForTimeout(2500);
    await shot(p, 'draft-board', { ban: await box(p, p.getByRole('button', { name: 'Add a ban…' })), enemy: await box(p, p.getByRole('button', { name: 'Add an enemy…' })) });
    const pick = async (slot, who, snap) => { await p.locator(`button[aria-label="${slot}"], button:has-text("${slot}")`).first().click(); await p.waitForTimeout(1200); if (snap) await shot(p, snap, {}, false); const b = p.locator('button').filter({ hasText: new RegExp('^\\s*' + who + '\\s*$') }).first(); const bb = await box(p, b); await b.click(); await p.waitForTimeout(1200); await p.locator('button').filter({ hasText: /^\s*Done\s*$/ }).first().click().catch(() => console.log('no done')); await p.waitForTimeout(1500); return bb; };
    const mrp = await pick('Add an enemy…', 'Mr\\. P', 'draft-picker'); boxes['draft-picker'].mrp = mrp;
    await shot(p, 'draft-e1');
    boxes['draft-e1'].ban = await box(p, p.getByRole('button', { name: 'Add a ban…' }).first());
    await pick('Add a ban…', 'Angelo');
    await shot(p, 'draft-e1b1');
    await pick('Add an enemy…', 'Brock');
    await shot(p, 'draft-e2b1');
    await p.context().close();
  });
  await step('review', async () => {
    const p = await open('meta');
    const has = await p.evaluate(() => typeof window.__bzShowReview);
    console.log('review hook', has);
    await p.evaluate(() => window.__bzShowReview && window.__bzShowReview({ battleTime: '20261119T183000.000Z', mapName: 'Out in the Open', mode: 'knockout', result: 'victory', eloChange: 11, rank: 'Diamond II', rankIcon: null,
      mine: [{ id: 16000026, you: true, star: true }, { id: 16000069, you: false, star: false }, { id: 16000079, you: false, star: false }],
      theirs: [{ id: 16000031, star: false }, { id: 16000014, star: false }, { id: 16000007, star: false }],
      winChance: 0.58, verdict: 'draftWon', worst: { brawlerId: 16000026, againstId: 16000031, edge: -4.3, battles: 412 }, keyEnemy: { brawlerId: 16000031, edge: 4.3 },
      better: { outId: 16000079, inId: 16000073, gain: 3.6 }, newGames: 1, today: { wins: 3, losses: 1 }, goal: { wins: 3, target: 3, streak: 5 } }));
    await p.waitForTimeout(2500); await shot(p, 'review', {}, false);
    await p.context().close();
  });
  await step('counters', async () => {
    const p = await open('counters');
    await shot(p, 'counters0', { mrp: await box(p, btn(p, /^Mr\. P$/)) }, false);
    await btn(p, /^Mr\. P$/).click(); await p.waitForTimeout(2200); await shot(p, 'counters-mrp');
    await p.context().close();
  });
  for (const [name, f, hide] of [['f-all', 'all', '0'], ['f-p11', 'power11', '0'], ['f-p11-hide', 'power11', '1'], ['f-hyper-hide', 'hypercharge', '1']])
    await step(name, async () => { const p = await open('meta', { 'brawlzone-bubble-filter': f, 'brawlzone-bubble-hide': hide }, demo); await shot(p, name); await p.context().close(); });
  for (const lang of ['es', 'pt', 'fr', 'de', 'ja', 'ko', 'ru', 'ar', 'tr', 'zh-Hans', 'it', 'pl'])
    await step('lang-' + lang, async () => { const p = await open('meta', { 'brawlzone.bubble.lang': lang }); await shot(p, 'lang-' + lang, {}, false); await p.context().close(); });
  // Brawler ids by name, for the review.
  await step('ids', async () => {
    const p = await open('counters', {}, null, 1);
    const map = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('button img')].map((i) => [i.closest('button').textContent.trim(), i.getAttribute('src')])));
    fs.writeFileSync(`${OUT}/ids.json`, JSON.stringify(map, null, 1));
    await p.context().close();
  });
  fs.writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 1));
  await browser.close();
})();
