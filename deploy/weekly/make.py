"""Draw the weekly Ranked report carousel (2026-10-20).

    python make.py <this-week.json> <last-week.json or -> <out dir> <assets dir> <icon cache dir>

Run by deploy/bin/brawlzone-weekly inside a python:3.12-slim container with
Pillow. The JSON comes from scripts/weekly-report.ts; last week's file is the
same script's output seven days earlier, and every "change since last week"
on the slides is the difference between the two. With no last week (the
first report, or the first of a new season) the deltas and the movers slide
are left out rather than compared against a different season.

Writes 1.jpg ... N.jpg and meta.json ({title, description}) into the out dir.
The look is the hand-made Season 50 week-1 report's, which is the one that
did well: dark navy, gold, Lilita One, brawler portraits from Brawlify.
"""
import collections
import json
import os
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont

cur_path, prev_path, OUT, ASSETS, ICONS = sys.argv[1:6]
cur = json.load(open(cur_path))
prev = json.load(open(prev_path)) if prev_path != '-' and os.path.exists(prev_path) else None
if prev and prev.get('season') != cur.get('season'):
    prev = None

W, H = 1080, 1920
YEL = (255, 199, 44); WHITE = (245, 247, 255); MUTED = (176, 186, 222)
GREEN = (52, 211, 153); RED = (248, 113, 113); NAVY = (11, 15, 29)
CARD = (28, 38, 86); EDGE = (70, 85, 160)
TIERC = {'S': (255, 92, 92), 'A': (255, 170, 60), 'B': (250, 210, 70), 'C': (120, 200, 120),
         'D': (140, 150, 190), 'F': (120, 120, 140)}
LABEL = {'gemgrab': 'Gem Grab', 'heist': 'Heist', 'bounty': 'Bounty', 'hotzone': 'Hot Zone',
         'brawlball': 'Brawl Ball', 'knockout': 'Knockout', 'wipeout': 'Wipeout'}


def F(s): return ImageFont.truetype(f'{ASSETS}/LilitaOne-Regular.ttf', s)
def G(s): return ImageFont.truetype(f'{ASSETS}/Geist-Regular.ttf', s)


def nm(s):
    """AMBER -> Amber, LARRY & LAWRIE -> Larry & Lawrie, R-T -> R-T."""
    out = ' '.join(w.capitalize() for w in s.lower().split(' '))
    return out.replace('R-t', 'R-T').replace('8-bit', '8-Bit').replace('Mr. p', 'Mr. P')


def pct(v): return f'{v * 100:.1f}%'


def bg():
    im = Image.new('RGB', (W, H)); dr = ImageDraw.Draw(im)
    for y in range(H):
        t = y / (H - 1)
        dr.line([(0, y), (W, y)], fill=(int(11 + 19 * t), int(15 + 27 * t), int(29 + 67 * t)))
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((-300, -350, 900, 700), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    return Image.composite(Image.new('RGB', (W, H), (110, 85, 10)), im, glow)


def ctext(im, txt, y, font, fill, shadow=True):
    dr = ImageDraw.Draw(im)
    size = font.size
    # Shrink rather than run off the edge: brawler and map names vary.
    while dr.textlength(txt, font=font) > W - 80 and size > 24:
        size -= 4
        font = font.font_variant(size=size)
    x = (W - dr.textlength(txt, font=font)) / 2
    if shadow:
        dr.text((x + 4, y + 5), txt, font=font, fill=(0, 0, 0))
    dr.text((x, y), txt, font=font, fill=fill)
    return y + int(font.size * 1.12)


def rounded(img, r):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), r, fill=255)
    return m


def icon(id_, size):
    path = f'{ICONS}/{id_}.png'
    if not os.path.exists(path):
        req = urllib.request.Request(f'https://cdn.brawlify.com/brawlers/borders/{id_}.png',
                                     headers={'User-Agent': 'brawlzone-weekly'})
        with urllib.request.urlopen(req, timeout=30) as r, open(path + '.tmp', 'wb') as f:
            f.write(r.read())
        os.replace(path + '.tmp', path)
    return Image.open(path).convert('RGBA').resize((size, size), Image.LANCZOS)


APP = Image.open(f'{ASSETS}/app-icon.png').convert('RGBA')


def logo(im, y=100):
    s = APP.resize((80, 80)); im.paste(s, (W // 2 - 200, y), rounded(s, 20))
    dr = ImageDraw.Draw(im)
    dr.text((W // 2 - 104, y + 14), 'BrawlZone', font=F(48), fill=WHITE)
    dr.text((W // 2 + 136, y + 14), 'Ranked', font=F(48), fill=YEL)


def pill(im, txt, y, fill=YEL, fg=NAVY, size=46):
    dr = ImageDraw.Draw(im); f = F(size); tw = dr.textlength(txt, font=f); x = (W - tw) / 2
    dr.rounded_rectangle((x - 34, y - 12, x + tw + 34, y + size + 16), 40, fill=fill)
    dr.text((x, y), txt, font=f, fill=fg)


def delta_tag(d):
    if d is None: return 'NEW', GREEN
    if d >= 0.0005: return f'+{d * 100:.1f}', GREEN
    if d <= -0.0005: return f'{d * 100:.1f}', RED
    return '=', MUTED


# ------------------------------------------------------------------ the data
season, week = cur['season'], cur['week']
ranked = sorted(cur['all'], key=lambda b: -(b.get('score') or 0))
before = {b['n']: b for b in (prev or {}).get('all', [])}
prev_top = max((prev or {}).get('all', []), key=lambda b: b.get('score') or 0, default=None)
top1 = ranked[0]
pool = [e for e in cur['pool'] if e['maps']]
nmaps = sum(len(e['maps']) for e in pool)
top3 = collections.Counter(p['n'] for e in pool for m in e['maps'] for p in m['picks'][:3])
ids = {b['n']: b['id'] for b in cur['all']}
for e in pool:
    for m in e['maps']:
        for p in m['picks']:
            ids.setdefault(p['n'], p['id'])
big3 = top3.most_common(3)

slides = []

# 1 cover: the hook is the #1, and whether it changed hands
im = bg(); logo(im)
ctext(im, f'SEASON {season}', 280, F(150), WHITE)
ctext(im, f'WEEK {week} REPORT', 450, F(120), YEL)
ctext(im, 'What is actually winning in Ranked', 640, G(52), WHITE, shadow=False)
ctext(im, 'right now, from real battles', 705, G(52), WHITE, shadow=False)
a = icon(top1['id'], 460); im.paste(a, ((W - 460) // 2, 830), a)
if prev_top is None:
    head, col = f'{nm(top1["n"]).upper()} IS #1', GREEN
elif prev_top['n'] != top1['n']:
    head, col = 'NEW #1', GREEN
else:
    head, col = 'STILL #1', YEL
ctext(im, head, 1320, F(110), col)
pill(im, f'Swipe for the best picks on all {nmaps} maps', 1490, fill=(30, 40, 90), fg=MUTED, size=40)
slides.append(im)

# 2 the top of the meta, with movement since last week
im = bg(); logo(im)
ctext(im, 'TOP 6 RIGHT NOW', 260, F(110), WHITE)
ctext(im, 'Win rate in Ranked' + (', and change since last week' if prev else ''), 395, G(46), MUTED, shadow=False)
for i, t in enumerate(ranked[:6]):
    r, c = divmod(i, 2); x = 110 + c * 450; y = 500 + r * 420
    ic = icon(t['id'], 240); im.paste(ic, (x + 55, y), ic)
    dr = ImageDraw.Draw(im); n = nm(t['n']); f = F(60)
    while dr.textlength(n, font=f) > 400 and f.size > 36:
        f = f.font_variant(size=f.size - 4)
    dr.text((x + 175 - dr.textlength(n, font=f) / 2, y + 248), n, font=f, fill=WHITE)
    s = pct(t['wr']); f2 = F(46)
    if prev:
        o = before.get(t['n'])
        tag, tc = delta_tag(t['wr'] - o['wr'] if o else None)
        tag = '  ' + tag
    else:
        tag, tc = '', MUTED
    x0 = x + 175 - dr.textlength(s + tag, font=f2) / 2
    dr.text((x0, y + 316), s, font=f2, fill=WHITE)
    dr.text((x0 + dr.textlength(s, font=f2), y + 316), tag, font=f2, fill=tc)
slides.append(im)

# 3 who climbed and who fell. Only brawlers people actually play: a 1%-use
# brawler swings two points on a quiet week and means nothing.
if prev:
    moves = [(b, b['wr'] - before[b['n']]['wr']) for b in cur['all']
             if b['n'] in before and (b.get('use') or 0) >= 0.01]
    moves.sort(key=lambda x: -x[1])
    up = [m for m in moves[:3] if m[1] > 0.002]
    down = [m for m in moves[::-1][:3] if m[1] < -0.002]
    if up or down:
        im = bg(); logo(im)
        ctext(im, 'BIGGEST MOVERS', 250, F(116), YEL)
        ctext(im, 'Ranked win rate, this week against last', 385, G(46), MUTED, shadow=False)
        y = 480
        for title, rows, col in (('CLIMBED', up, GREEN), ('FELL', down, RED)):
            if not rows:
                continue
            dr = ImageDraw.Draw(im); dr.text((80, y), title, font=F(70), fill=col); y += 95
            for b, d in rows:
                dr.rounded_rectangle((60, y, 1020, y + 170), 30, fill=CARD)
                ic = icon(b['id'], 140); im.paste(ic, (85, y + 15), ic)
                dr.text((260, y + 30), nm(b['n']), font=F(64), fill=WHITE)
                dr.text((260, y + 105), pct(b['wr']) + ' win rate', font=G(36), fill=MUTED)
                tag = f'{d * 100:+.1f}'
                f = F(72); dr.text((990 - dr.textlength(tag, font=f), y + 45), tag, font=f, fill=col)
                y += 190
            y += 30
        slides.append(im)

# 4 everywhere: who is top 3 on the most maps
if big3:
    im = bg(); logo(im)
    ctext(im, 'THE BIG THREE', 260, F(116), YEL)
    ctext(im, 'Top-3 pick on the most Ranked maps', 400, G(50), WHITE, shadow=False)
    y = 520
    for n, cnt in big3:
        dr = ImageDraw.Draw(im)
        dr.rounded_rectangle((70, y, 1010, y + 330), 40, fill=CARD, outline=EDGE, width=3)
        ic = icon(ids[n], 260); im.paste(ic, (105, y + 35), ic)
        dr.text((400, y + 50), nm(n), font=F(84), fill=WHITE)
        dr.text((400, y + 160), f'{cnt} of {nmaps} maps', font=F(64), fill=GREEN)
        dr.text((400, y + 250), 'in the top 3', font=G(42), fill=MUTED)
        y += 370
    slides.append(im)

# 5 the season's trial brawlers, with a verdict read off their tier
VERDICT = {'S': 'Strong. Worth the trial', 'A': 'Good pick right now', 'B': 'Right around average',
           'C': 'Below average', 'D': 'Skip for now', 'F': 'Skip for now'}
trial = cur.get('trial') or []
if trial:
    im = bg(); logo(im)
    ctext(im, 'TRIAL BRAWLERS', 260, F(110), YEL)
    ctext(im, f'Week {week}. Worth playing?', 400, G(50), WHITE, shadow=False)
    y = 520
    for t in trial[:3]:
        dr = ImageDraw.Draw(im)
        dr.rounded_rectangle((70, y, 1010, y + 300), 40, fill=CARD, outline=EDGE, width=3)
        ic = icon(t['id'], 230); im.paste(ic, (105, y + 35), ic)
        dr.text((370, y + 40), nm(t['n']), font=F(78), fill=WHITE)
        tier = t.get('tier') or '?'
        tc = TIERC.get(tier, MUTED)
        dr.rounded_rectangle((370, y + 140, 470, y + 220), 20, fill=tc)
        f = F(64); dr.text((420 - dr.textlength(tier, font=f) / 2, y + 146), tier, font=f, fill=NAVY)
        dr.text((500, y + 150), pct(t['wr']) + ' win rate', font=F(54), fill=GREEN if t['wr'] >= 0.5 else RED)
        dr.text((370, y + 232), VERDICT.get(tier, ''), font=G(36), fill=MUTED)
        y += 340
    slides.append(im)


# 6+ best picks per map: a mode with more than four maps gets a slide to
# itself, smaller ones go two to a slide.
def mapslide(entries, title=None):
    big = len(entries) == 1
    RH, IC, STEP, FN = (190, 150, 220, 62) if big else (128, 100, 142, 46)
    if big and len(entries[0]['maps']) > 4: RH, IC, STEP, FN = (170, 135, 196, 58)
    im = bg(); logo(im); y = 260 if big else 230
    if title: y = ctext(im, title, y, F(84), YEL) + 10
    for e in entries:
        dr = ImageDraw.Draw(im)
        dr.text((80, y), LABEL.get(e['mode'], e['mode']).upper(), font=F(76 if big else 64), fill=YEL)
        y += 110 if big else 90
        for m in e['maps']:
            dr.rounded_rectangle((60, y, 1020, y + RH), 26, fill=CARD)
            room = (1000 - 3 * (IC + 14)) - 95 - 24; fs = FN
            while fs > 30 and dr.textlength(m['m'], font=F(fs)) > room: fs -= 2
            dr.text((95, y + (RH - fs) // 2 - 4), m['m'], font=F(fs), fill=WHITE)
            for j, p in enumerate(m['picks'][:3]):
                ic = icon(p['id'], IC); x = (1000 - 3 * (IC + 14)) + j * (IC + 14)
                im.paste(ic, (x, y + (RH - IC) // 2), ic)
            y += STEP
        y += 30
    return im


groups, pending = [], []
for e in sorted(pool, key=lambda e: len(e['maps'])):
    if len(e['maps']) > 4:
        groups.append([e])
    else:
        pending.append(e)
        if len(pending) == 2:
            groups.append(pending); pending = []
if pending:
    groups.append(pending)
for i, g in enumerate(groups):
    slides.append(mapslide(g, 'BEST PICKS PER MAP' if i == 0 and len(g) > 1 else None))

# last: follow
im = bg(); logo(im)
ctext(im, 'FOLLOW', 330, F(190), YEL)
ctext(im, 'FOR NEXT WEEK', 540, F(110), WHITE)
ctext(im, 'A fresh Ranked report every week:', 730, G(52), WHITE, shadow=False)
ctext(im, 'who climbed, who fell, best picks per map.', 795, G(52), WHITE, shadow=False)
for i, (n, _) in enumerate(big3):
    ic = icon(ids[n], 250); im.paste(ic, (95 + i * 320, 920), ic)
pill(im, 'Save this for your next draft', 1270, size=56)
ctext(im, 'Every map, live: brawlzone.net', 1420, F(58), MUTED)
slides.append(im)

for i, s in enumerate(slides, 1):
    s.save(f'{OUT}/{i}.jpg', quality=92)

# ------------------------------------------------------------------ caption
lead = nm(top1['n'])
if prev_top is None:
    hook = f'{lead} is the #1 brawler in Ranked'
elif prev_top['n'] != top1['n']:
    hook = f'{lead} took #1 from {nm(prev_top["n"])}'
else:
    hook = f'{lead} is still #1'
spread = ''
if big3:
    rest = [nm(n) for n, _ in big3[1:]]
    who = 'Also' if big3[0][0] == top1['n'] else f'{nm(big3[0][0])} is'
    spread = (f" {who} a top-3 pick on {big3[0][1]} of {nmaps} maps"
              + (f", with {' and '.join(rest)} right behind." if rest else '.'))
title = f'Ranked Season {season} week {week}: {lead} is #1, best picks for every map'
description = (
    f'Ranked Season {season}, week {week}: {hook} 🔥{spread} '
    'Here are the best 3 brawlers on every map in the rotation, from real Ranked battles.\n\n'
    '🔔 Follow for a fresh Ranked report every week, and comment the map you keep losing on 👇\n\n'
    'Unofficial fan project, not affiliated with Supercell.\n'
    '#brawlstars #brawlstarsranked #brawlstarsmeta #brawlstarstips #brawlzone'
)
json.dump({'title': title, 'description': description, 'count': len(slides)},
          open(f'{OUT}/meta.json', 'w'))
print(len(slides))
