"""The weekly Ranked meta video (2026-10-27): a ~3.5-minute YouTube video,
not a Short, drawn on the same engine as the daily ones.

    python weekly.py <data.json> <prev.json|-> <out dir> [--only SECONDS ...]

Why it exists: the Shorts reach ~4k views a day but their links cannot be
tapped, so they send almost nobody to the site. A video over three minutes
is a regular YouTube video, whose description links and chapters work. It is
kept over three minutes on purpose (the hold stretches to TARGET seconds):
under that, YouTube files a vertical video as a Short.

Sections: intro, top 10 by meta score (tiers shown, not win rates -- the
order is the score), the best three picks on every live Ranked map, the
week's climbers and fallers against the snapshot from a week ago (skipped
without one), what is picked at low rank against Masters+, and the links.
Writes frames/NNNN.jpg (PART/PARTS split them) and meta.json (title,
description with chapters, duration).
"""
import json, math, os, sys
from PIL import Image, ImageDraw

import engine
from engine import (W, H, FPS, P, WHITE, GOLD_TOP, TIER, F, Timeline, art, arrow, background, card, clamp,
                    finish, follow_cta, hits, impact, load_face, nice, out_back, out_cubic, pill, put, put_rays,
                    slam, text_sprite, tier_pill)

DATA, PREV, OUT = sys.argv[1:4]
ONLY = [float(x) for x in sys.argv[5:]] if len(sys.argv) > 4 and sys.argv[4] == '--only' else None
data = json.load(open(DATA))
prev = json.load(open(PREV)) if PREV != '-' else None
by_id = {b['id']: b for b in data['all']}
TARGET = 205.0  # seconds: comfortably over the three minutes a Short can be

# Kept in step with make.py's modes section.
MODE_COL = {'hotZone': (255, 70, 70), 'heist': (255, 90, 190), 'knockout': (255, 160, 40), 'brawlBall': (60, 150, 255),
            'gemGrab': (170, 90, 255), 'bounty': (40, 210, 230), 'wipeout': (120, 220, 90)}
MODE_NAME = {'hotZone': 'HOT ZONE', 'heist': 'HEIST', 'knockout': 'KNOCKOUT', 'brawlBall': 'BRAWL BALL',
             'gemGrab': 'GEM GRAB', 'bounty': 'BOUNTY', 'wipeout': 'WIPEOUT'}
def mode_key(m):
    return {k.lower(): k for k in MODE_COL}.get(m.replace('-', '').replace('_', '').lower())

# ------------------------------------------------------------------ content
top = sorted(data['all'], key=lambda b: -(b['score'] or 0))[:10]
maps = []
for e in data['pool']:
    mk = mode_key(e['mode'])
    if not mk:
        continue
    for m in e['maps']:
        picks = [by_id.get(p['id']) or {'id': p['id'], 'n': p['n'], 'tier': 'B'} for p in m['picks'][:3]]
        if len(picks) == 3:
            maps.append((mk, m['m'], picks, m['n']))
maps = maps[:30]  # every live Ranked map; the rotation is ~26
movers = []
if prev:
    base = {b['id']: b for b in prev['recent']}
    rows = []
    for b in data['recent']:
        o = base.get(b['id'])
        if o and b.get('tier') and (b.get('battles') or 0) >= 3000 and (o.get('battles') or 0) >= 3000:
            rows.append({**b, 'was': o['tier'], 'd': b['wr'] - o['wr']})
    rows.sort(key=lambda r: -r['d'])
    up = [r for r in rows if r['tier'] in 'SAB' and r['d'] > 0.005][:3]
    down = [r for r in reversed(rows) if r['was'] in 'SABC' and r['d'] < -0.005][:3]
    if len(up) >= 2 and len(down) >= 2:
        movers = [('up', r) for r in up] + [('down', r) for r in down]
low, pro = data['brackets'].get('low'), data['brackets'].get('pro')
ranks = [(lbl, br) for lbl, br in (('DIAMOND & BELOW', low), ('MASTERS & UP', pro)) if br and len(br.get('top', [])) >= 5]

plan = [(8, 'w_intro', {}), (3, 'w_head', {'title': 'TOP 10', 'sub': 'THE BEST IN RANKED THIS WEEK', 'col': (255, 170, 40)})]
plan += [(4, 'w_top', {'b': b, 'rank': 10 - i}) for i, b in enumerate(reversed(top))]
plan += [(3, 'w_head', {'title': 'EVERY MAP', 'sub': 'THE 3 BEST PICKS ON EACH LIVE MAP', 'col': (60, 150, 255), 'chapter': 'Best picks on every map'})]
plan += [(6, 'w_map', {'mode': mk, 'map': name, 'picks': picks, 'n': n}) for mk, name, picks, n in maps]
if movers:
    plan += [(3, 'w_head', {'title': 'CLIMBERS', 'sub': 'AND WHO FELL OFF THIS WEEK', 'col': (60, 220, 120), 'chapter': 'Climbers and fallers'})]
    plan += [(5, 'w_move', {'dir': d, 'r': r}) for d, r in movers]
if ranks:
    plan += [(3, 'w_head', {'title': 'BY RANK', 'sub': 'WHAT EACH RANK ACTUALLY PICKS', 'col': (150, 90, 255), 'chapter': 'What changes by rank'})]
    plan += [(7, 'w_rank', {'label': lbl, 'top': br['top'][:5]}) for lbl, br in ranks]
plan += [(12, 'w_outro', {'chapter': 'Links: tier list, draft helper, rewards'})]

beats = sum(p[0] for p in plan)
hold = max(1.3, TARGET / (beats * P))
tl = Timeline(hold=hold)
chapters = [(0.0, 'Intro and the top 10')]
for length, kind, kw in plan:
    if kw.get('chapter'):
        chapters.append((tl.dur, kw['chapter']))
    tl.add(length, kind, **kw)

def ts(sec):
    sec = int(sec); return f'{sec // 60}:{sec % 60:02d}'

week = data.get('date', '')
season = data.get('season')
top3 = ', '.join(nice(b['n']) for b in top[:3])
META = {
    'title': f'Brawl Stars Ranked meta this week: best picks for every map (Season {season})',
    'description': (
        f'The Ranked meta for the week of {week}, from hundreds of thousands of real Ranked battles: '
        f'the top 10 brawlers (top 3: {top3}), the 3 best picks on every live map'
        + (', the climbers and fallers' if movers else '') + ', and what each rank actually picks.\n\n'
        '🔗 Full Ranked tier list for your rank: https://brawlzone.net/tier-list/ranked\n'
        '🧠 Draft helper, counters for any pick: https://brawlzone.net/draft\n'
        '🗺️ Best picks for every map: https://brawlzone.net/maps\n'
        '🎁 Free Brawl Stars rewards, every link: https://brawlzone.net/rewards\n'
        '🏆 Giveaway, win the Brawl Pass: https://brawlzone.net/giveaway\n\n'
        'Chapters\n' + '\n'.join(f'{ts(t)} {name}' for t, name in chapters) + '\n\n'
        'New every Monday. Unofficial fan project, not affiliated with Supercell.\n'
        '#brawlstars #brawlstarsranked #brawlstarsmeta #brawlstarstierlist #brawlzone'
    ),
}

_pick_cards = {}
def pick_card(rank, b):
    """engine.card caches by rank and size alone (a countdown shows each rank
    once); here every map has its own #1, so cache by brawler too."""
    key = (rank, b['id'])
    if key not in _pick_cards:
        engine._cards.pop((rank, 290, 350), None)
        _pick_cards[key] = card(rank, b, 290, 350)
    return _pick_cards[key]

# ------------------------------------------------------------------ scenes
def scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'w_intro':
        canvas = background(t, (255, 170, 40)).convert('RGBA')
        put_rays(canvas, (255, 170, 40), t, W / 2, 1400, speed=12, alpha=0.5)
        slam(canvas, 'RANKED META', 150, WHITE, W / 2, 470, bt)
        slam(canvas, 'THIS WEEK', 210, None, W / 2, 680, bt - 1, gold=True)
        if bt > 2: put(canvas, pill(f'SEASON {season} · {week}', (16, 20, 42), fg=GOLD_TOP, size=56), W / 2, 900, scale=out_back((bt - 2) / 0.4, 2.0))
        if bt > 3.2: put(canvas, text_sprite('top 10 · every map · climbers · by rank', 52, WHITE, stroke=6), W / 2, 1060, scale=out_back((bt - 3.2) / 0.4))
        shake, flash = hits(bt, (0, 1, 2), 1.0, 0.4)
    elif k == 'w_head':
        col = s['col']; canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 900, speed=26, alpha=0.7)
        slam(canvas, s['title'], 240 if len(s['title']) <= 8 else 190, None, W / 2, 820, bt, gold=True, k=1.8)
        if bt > 0.7: put(canvas, text_sprite(s['sub'], 64 if len(s['sub']) < 28 else 52, WHITE, stroke=7), W / 2, 1040, scale=out_back((bt - 0.7) / 0.4))
        shake, flash = hits(bt, (0,), 1.4, 0.5)
    elif k == 'w_top':
        b = s['b']; col = TIER[b['tier']]
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 1000, speed=18, alpha=0.6)
        u = lt / 0.4
        put(canvas, art(b, 880, 960), W / 2, 1000, scale=1 + 0.4 * (1 - out_back(u, 1.6)))
        put(canvas, text_sprite(f"#{s['rank']}", 230, gold=True), 230 - 460 * (1 - out_back(u, 1.2)), 400)
        put(canvas, tier_pill(b['tier']), W - 240 + 480 * (1 - out_back((lt - 0.08) / 0.4, 1.2)), 400)
        put(canvas, text_sprite(nice(b['n']).upper(), 160 if len(b['n']) <= 8 else 120, WHITE), W / 2, 1540, scale=out_back((lt - 0.1) / 0.4, 1.5))
        shake = impact(lt, 1.0); flash = impact(lt) * 0.4
    elif k == 'w_map':
        col = MODE_COL[s['mode']]; canvas = background(t, col).convert('RGBA')
        put(canvas, pill(MODE_NAME[s['mode']], col, size=60), W / 2, 330, scale=out_back(bt / 0.35, 2.0))
        name = s['map'].upper()
        slam(canvas, name, 130 if len(name) <= 12 else 100 if len(name) <= 17 else 80, WHITE, W / 2, 500, bt - 0.3)
        for j, b in enumerate(s['picks']):
            u = (bt - 0.8 - j * 0.35) / 0.4
            if u <= 0: continue
            x = W / 2 + (j - 1) * 320; y = 1000 - (60 if j == 0 else 0)
            put(canvas, pick_card(j + 1, b), x, y + 200 * (1 - out_cubic(u)), scale=out_back(u, 2.0) * (1.12 if j == 0 else 1.0))
        if bt > 2.4: put(canvas, text_sprite(f"from {s['n']:,} Ranked battles", 50, WHITE, stroke=6), W / 2, 1420, alpha=clamp(bt - 2.4))
        shake, flash = hits(bt, (0, 0.3), 0.8, 0.3)
    elif k == 'w_move':
        r = s['r']; good = s['dir'] == 'up'; col = (60, 220, 120) if good else (255, 70, 90)
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 1000, speed=16 if good else -16, alpha=0.7)
        u = lt / 0.4
        put(canvas, art(r, 820, 900), W / 2, 1000, scale=1 + 0.4 * (1 - out_back(u, 1.6)))
        put(canvas, text_sprite('CLIMBING' if good else 'FALLING', 120, col), W / 2, 380, scale=out_back(u, 1.4))
        put(canvas, text_sprite(nice(r['n']).upper(), 150 if len(r['n']) <= 8 else 110, WHITE), W / 2, 1500, scale=out_back((lt - 0.1) / 0.4, 1.5))
        if bt > 1:
            sign = '+' if r['d'] >= 0 else ''
            put(canvas, text_sprite(f"{sign}{r['d'] * 100:.1f}% WIN RATE", 90, col, stroke=9), W / 2, 1660, scale=out_back((bt - 1) / 0.35))
        if bt > 1.8 and r['was'] != r['tier']:
            put(canvas, pill(f"{r['was']} TIER → {r['tier']} TIER", (16, 20, 42), fg=GOLD_TOP, size=56), W / 2, 540, scale=out_back((bt - 1.8) / 0.35))
        shake = impact(lt, 1.0); flash = impact(lt) * 0.35
    elif k == 'w_rank':
        canvas = background(t, (150, 90, 255)).convert('RGBA')
        slam(canvas, s['label'], 130, None, W / 2, 380, bt, gold=True)
        if bt > 0.6: put(canvas, text_sprite('MOST PICKED RIGHT NOW', 60, WHITE, stroke=6), W / 2, 540, scale=out_back((bt - 0.6) / 0.4))
        for j, b in enumerate(s['top']):
            u = (bt - 1 - j * 0.3) / 0.4
            if u <= 0: continue
            y = 760 + j * 210
            row = Image.new('RGBA', (900, 180), (0, 0, 0, 0)); d = ImageDraw.Draw(row)
            d.rounded_rectangle((0, 0, 899, 179), 40, fill=(43, 33, 102, 255), outline=(16, 20, 42, 255), width=6)
            row.alpha_composite(load_face(b).resize((150, 150)), (16, 15))
            d.text((190, 90), f'#{j + 1}  {nice(b["n"])}', font=F(80), fill=WHITE, anchor='lm', stroke_width=5, stroke_fill=(16, 20, 42))
            put(canvas, row, W / 2 + 900 * (1 - out_back(u, 1.3)), y)
    else:  # w_outro
        canvas = background(t, (255, 170, 40)).convert('RGBA'); mark = False
        slam(canvas, 'LINKS IN THE', 130, WHITE, W / 2, 360, bt)
        slam(canvas, 'DESCRIPTION', 170, None, W / 2, 530, bt - 0.5, gold=True)
        for j, line in enumerate(('FULL TIER LIST FOR YOUR RANK', 'DRAFT HELPER & COUNTERS', 'FREE REWARDS', 'GIVEAWAY: WIN THE BRAWL PASS')):
            if bt > 1.2 + j * 0.4:
                put(canvas, pill(line, (16, 20, 42), fg=GOLD_TOP, size=54), W / 2, 740 + j * 130, scale=out_back((bt - 1.2 - j * 0.4) / 0.35, 2.0))
        follow_cta(canvas, bt - 3.4, 1420, 'NEW META VIDEO EVERY MONDAY')
        if bt > 4: put(canvas, text_sprite('brawlzone.net', 96, gold=True), W / 2, 1720, scale=out_back((bt - 4) / 0.4))
        shake, flash = hits(bt, (0, 0.5), 0.8, 0.3)
    return finish(canvas, shake, flash, mark)


def frame(t):
    s, bt, lt = tl.at(t)
    return scene(s, t, bt, lt)


if __name__ == '__main__':
    os.makedirs(f'{OUT}/frames', exist_ok=True)
    META['duration'] = round(tl.dur, 3)
    json.dump(META, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False)
    if ONLY is not None:
        for sec in ONLY:
            frame(sec).save(f'{OUT}/w-{sec}.jpg', quality=85)
        print('duration', round(tl.dur, 2), 'maps', len(maps), 'movers', len(movers), 'ranks', len(ranks)); sys.exit()
    n = int(tl.dur * FPS); part, parts = int(os.environ.get('PART', 0)), int(os.environ.get('PARTS', 1))
    for i in range(n):
        if i % parts != part or os.path.exists(f'{OUT}/frames/{i:04d}.jpg'): continue
        frame(i / FPS).save(f'{OUT}/frames/{i:04d}.jpg', quality=90)
    print('frames', n, 'duration', round(tl.dur, 2))
