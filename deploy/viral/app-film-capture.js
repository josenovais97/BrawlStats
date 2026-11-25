// The app film's panel footage (2026-11-25, make.py appfilm): the real panel
// as the Play app opens it, in the states the film moves through, at 3x, and
// what they say (film.json), so the film can redraw a number it animates.
// TAG comes from the environment and is never written anywhere; the player's
// name is replaced by "YOU" before each shot.
//   docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -e TAG=<tag> -v <tool>:/tool -v <out>:/out -w /tool \
//     mcr.microsoft.com/playwright:v1.49.1-noble node app-film-capture.js   (playwright in /tool/node_modules)
const { chromium } = require('playwright');
const fs = require('fs');
const TAG = process.env.TAG;
const BASE = process.env.BASE || 'https://brawlzone.net';
const MODE = process.env.MODE || 'Gem Grab';
const MAP = process.env.MAP || 'Hard Rock Mine';
const RANK = 'masters';
const api = async (p) => (await fetch(`${BASE}${p}`)).json();
(async () => {
  const owner = await api(`/api/bubble/roster?tag=${TAG}`);
  const NAME = owner.name || '';
  const browser = await chromium.launch();
  const film = { map: MAP, mode: MODE, rank: 'MASTERS+' };
  const ctx = await browser.newContext({ viewport: { width: 460, height: 422 }, deviceScaleFactor: 3, locale: 'en-US', userAgent: 'Mozilla/5.0 (Linux; Android 14) BrawlZoneBubble/1.44' });
  await ctx.addInitScript(([t, r]) => { try { localStorage.setItem('brawlzone-bubble-tag', t); localStorage.setItem('brawlzone.bubble.bracket', r); } catch {} }, [TAG, RANK]);
  const open = async (tab) => {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/bubble/panel?app=bubble#v=57&s=play&tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForTimeout(9000);
    return p;
  };
  const mask = (p) => p.evaluate((n) => {
    if (!n) return;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let x = walk.nextNode(); x; x = walk.nextNode()) if (x.nodeValue && x.nodeValue.includes(n)) x.nodeValue = x.nodeValue.split(n).join('YOU');
    for (const el of document.querySelectorAll('span,p,div,b')) if (el.children.length === 0 && /#[0289PYLQGRJCUV]{6,}/.test(el.textContent)) el.textContent = '#YOURTAG';
  }, NAME);
  const shot = async (p, name, full = false) => { await mask(p); await p.screenshot({ path: `/out/${name}.png`, fullPage: full }); console.log(name); };
  const boxOf = async (loc) => { const b = await loc.boundingBox().catch(() => null); return b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null; };

  // Meta, with the ban badges.
  let p = await open('meta');
  await shot(p, 'meta'); await shot(p, 'meta-full', true); await p.close();

  // Draft on the map: bans, then picks, then your pick.
  p = await open('draft');
  const change = p.getByRole('button', { name: /^Change$/ });
  if (await change.count()) { await change.first().click(); await p.waitForTimeout(500); }
  await p.locator('[aria-label="Mode"] button', { hasText: MODE }).first().click(); await p.waitForTimeout(500);
  await p.locator('[aria-label="Map"] button', { hasText: MAP }).first().click(); await p.waitForTimeout(6000);
  await shot(p, 'draft0');
  const bans = await api(`/api/bubble/bans/${RANK}`);
  film.bans = (bans.maps[MAP]?.bans || []).slice(0, 6);
  film.bansWide = bans.maps[MAP]?.wide ?? null;
  for (let i = 0; i < 3; i++) { await p.locator('.bz-panel button[title] img').nth(i).click().catch(() => {}); await p.waitForTimeout(500); }
  await p.waitForTimeout(1500); await shot(p, 'draft1');
  const add = async (label, name) => {
    await p.getByRole('button', { name: label }).first().click(); await p.waitForTimeout(400);
    await p.locator('input[type=search]').fill(name); await p.waitForTimeout(400);
    await p.locator(`button[title="${name}"], button:has(img[alt="${name}"])`).last().click(); await p.waitForTimeout(400);
    const done = p.getByRole('button', { name: /Close/ }); if (await done.count()) await done.first().click().catch(() => {});
    await p.waitForTimeout(400);
  };
  const ALLIES = (process.env.ALLIES || 'Byron,Colette').split(','), ENEMIES = (process.env.ENEMIES || 'Edgar,Piper,Bo').split(',');
  const odds = async () => { await p.waitForTimeout(3500); const m = (await p.evaluate(() => document.body.innerText)).match(/(\d{1,2})%\s*\n?\s*to win/i); return m ? Number(m[1]) : null; };
  film.odds = [];
  try { await add(/Add an enemy|enemy/i, ENEMIES[0]); await add(/Add to your team|team/i, ALLIES[0]); film.odds.push(await odds()); await shot(p, 'draft2'); } catch (e) { console.log('draft2', String(e).split('\n')[0]); }
  try { await add(/Add an enemy|enemy/i, ENEMIES[1]); await add(/Add to your team|team/i, ALLIES[1]); film.odds.push(await odds()); await shot(p, 'draft3'); } catch (e) { console.log('draft3', String(e).split('\n')[0]); }
  fs.writeFileSync('/out/draft.txt', (await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} ${(b.getAttribute('aria-label') || b.title || b.textContent || '').trim().slice(0, 50)}`; }))).join('\n'));
  await p.close();

  // Counters.
  p = await open('counters');
  const ed = p.locator('button', { hasText: /^Edgar/ }).first();
  if (await ed.count()) { await ed.click(); await p.waitForTimeout(4000); }
  await shot(p, 'counters'); await p.close();
  film.counters = (await api(`/api/v1/counters?brawler=16000043&rank=${RANK}`)).counters;

  // Match history and the best game's review.
  const hist = await api(`/api/bubble/history?tag=${TAG}`);
  const wins = hist.games.filter((g) => g.you && g.result === 'victory').sort((a, b) => b.you.k - b.you.d - (a.you.k - a.you.d));
  const g = wins[0];
  film.review = (await api(`/api/bubble/review?tag=${TAG}&lang=en&game=${g.battleTime}`)).game;
  p = await open('meta');
  await p.evaluate(() => window.__bzOpenTab && window.__bzOpenTab('history')); await p.waitForTimeout(5000);
  await shot(p, 'history');
  await p.evaluate((r) => window.__bzShowReview && window.__bzShowReview(r), film.review); await p.waitForTimeout(3500);
  await shot(p, 'review'); await shot(p, 'review-full', true);
  film.reviewBoxes = await p.evaluate(() => [...document.querySelectorAll('.bz-panel,.bz-review-in')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height), (e.textContent || '').slice(0, 30)]; }));
  await p.close();
  fs.writeFileSync('/out/film.json', JSON.stringify(film, null, 1));
  console.log(JSON.stringify({ odds: film.odds, bans: film.bans, review: film.review?.mapName }));
  await browser.close();
})();
