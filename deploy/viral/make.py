"""The daily viral Short (2026-10-22): one of four formats, drawn frame by frame.

    python make.py <kind> <data.json> <prev.json|-> <state.json> <out dir> [--only SECONDS ...]

kind     quiz    "Guess the brawler #N": five rounds, easy to hard, each a
                 shadow, a pixelated model or an extreme zoom, 3-2-1, reveal.
         broken  "Who got BROKEN this week?": the three biggest win-rate
                 climbers and the two biggest fallers, last 3 days against the
                 same 3 days a week before (prev.json; without one, against
                 the 7-day window).
         ranks   most-picked in Diamond and below against Masters+.
         modes   the brawler that is top 3 on the most live maps of each mode.
data     scripts/viral-data.ts output.
state    what earlier episodes used (episode numbers, recent quiz answers);
         read only here, deploy/bin/brawlzone-viral updates it after posting.

Writes <out>/frames/NNNN.jpg (PART/PARTS split the frames between processes)
and <out>/meta.json (title, description, duration). Exits 3 when the format
has nothing worth saying today (a flat week for `broken`), so the caller can
draw the quiz instead. --only draws preview stills at those seconds.

The selection is seeded with the data's date, so parallel PARTs agree on it.
"""
import json, math, os, random, sys
from PIL import Image, ImageDraw

from engine import (W, H, FPS, P, WHITE, GOLD_TOP, NAVY, TIER, F, G, Timeline, art, arrow, background, clamp,
                    confetti, finish, follow_cta, grey, hits, impact, load_face, load_model, nice, out_back,
                    out_cubic, pill, put, put_rays, rounded_mask, silhouette, slam, text_sprite, tier_pill, vgrad)

KIND, DATA, PREV, STATE, OUT = sys.argv[1:6]
ONLY = [float(x) for x in sys.argv[7:]] if len(sys.argv) > 6 and sys.argv[6] == '--only' else None
data = json.load(open(DATA))
prev = json.load(open(PREV)) if PREV != '-' else None
try:
    state = json.load(open(STATE))
except (OSError, ValueError):
    state = {}
rnd = random.Random(f"{data['date']}/{KIND}")
by_id = {b['id']: b for b in data['all']}
tl = Timeline()
FOOTER = '\nUnofficial fan project, not affiliated with Supercell.'


def episode(kind):
    return int(state.get('episodes', {}).get(kind, 0)) + 1


def pct(x, sign=False):
    return f"{'+' if sign and x >= 0 else ''}{x * 100:.1f}%"


# ================================================================ quiz
EASY, MEDIUM, HARD = (60, 210, 110), (255, 180, 40), (255, 60, 90)
CLUES = {'shadow': 'WHO IS THIS?', 'pixel': 'WHO IS THIS?', 'zoom': 'ZOOMED IN: WHO?'}

if KIND == 'quiz':
    N = episode('quiz')
    recent = set(state.get('quiz_recent', [])[-45:])
    pool = sorted((b for b in data['all'] if load_model(b) is not None and b['id'] not in recent),
                  key=lambda b: -(b['use'] or 0))
    if len(pool) < 15:  # the history ate the roster: start over
        pool = sorted((b for b in data['all'] if load_model(b) is not None), key=lambda b: -(b['use'] or 0))
    third = len(pool) // 3
    picks = (rnd.sample(pool[:third], 2) + rnd.sample(pool[third:2 * third], 1) + rnd.sample(pool[2 * third:], 2))
    levels = ['EASY', 'EASY', 'MEDIUM', 'HARD', 'HARD']
    clues = ['shadow', 'pixel', 'zoom'] + rnd.sample(['shadow', 'pixel', 'zoom'], 2)
    rnd.shuffle(clues)
    tl.add(4, 'q_intro', n=N, faces=picks)
    for i, (b, lvl, clue) in enumerate(zip(picks, levels, clues)):
        tl.add(6, 'q', b=b, i=i, lvl=lvl, clue=clue)
    tl.add(8, 'q_outro', n=N, picks=picks)
    names = ', '.join(nice(b['n']) for b in picks)
    META = {
        'title': f'Guess the brawler #{N} 👀 Only real fans get 5/5',
        'titles': {'pt-BR': f'Adivinhe o brawler #{N} 👀 Só fãs de verdade acertam 5/5', 'es-419': f'Adivina el brawler #{N} 👀 Solo los verdaderos fans aciertan 5/5'},
        'description': f'Guess the brawler #{N}: 5 rounds, easy to hard. Shadows, pixels and zoom-ins. '
                       f'How many did you get? Comment your score 👇 New quiz every day.\n\n'
                       f'Tier lists, counters and builds: https://brawlzone.net{FOOTER}\n'
                       '#brawlstars #brawlstarsquiz #guessthebrawler #brawlstarsgame #brawlzone',
        'used': [b['id'] for b in picks],
        'answers': names,
    }


def zoom_view(b, z):
    """The model cropped around its head at z times, inside a rounded window."""
    m = art(b, 900)
    a = m.getchannel('A').getbbox() or (0, 0, m.width, m.height)
    cx, cy = (a[0] + a[2]) / 2, a[1] + (a[3] - a[1]) * 0.22
    win = 760; side = win / z
    box = (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2)
    crop = m.crop(tuple(int(v) for v in box)).resize((win, win), Image.BILINEAR)
    frame = Image.new('RGBA', (win + 24, win + 24), (0, 0, 0, 0)); d = ImageDraw.Draw(frame)
    d.rounded_rectangle((0, 0, win + 23, win + 23), 70, fill=(12, 14, 34, 255), outline=WHITE, width=10)
    inner = Image.new('RGBA', (win, win), (30, 34, 80, 255)); inner.alpha_composite(crop)
    frame.paste(inner, (12, 12), rounded_mask(win, win, 60))
    return frame


def pixelated(img, blocks):
    w = max(2, blocks); h = max(2, int(blocks * img.height / img.width))
    return img.resize((w, h), Image.BILINEAR).resize(img.size, Image.NEAREST)


_shadows = {}
def shadow_face(b):
    if b['id'] not in _shadows:
        _shadows[b['id']] = silhouette(art(b, 300, 260), (200, 180, 255))
    return _shadows[b['id']]


def quiz_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'q_intro':
        canvas = background(t, (150, 90, 255)).convert('RGBA')
        for j, b in enumerate(s['faces']):  # the five answers, hidden as shadows, sliding past
            x = (j * 260 + t * 160) % (W + 260) - 130
            put(canvas, shadow_face(b), x, 1400 + 40 * math.sin(t * 3 + j), alpha=0.9)
        slam(canvas, 'GUESS THE', 180, WHITE, W / 2, 560, bt)
        slam(canvas, 'BRAWLER', 250, None, W / 2, 770, bt - 1, gold=True)
        if bt > 2: put(canvas, pill(f"#{s['n']}", (255, 60, 100), size=90), W / 2, 990, scale=out_back((bt - 2) / 0.4, 2.2), rot=-6)
        if bt > 3: put(canvas, text_sprite('ONLY REAL FANS GET 5/5', 66, WHITE, stroke=7), W / 2, 1160, scale=out_back((bt - 3) / 0.4))
        shake, flash = hits(bt, (0, 1, 2, 3), 1.2, 0.5)
    elif k == 'q':
        b = s['b']; reveal = bt >= 4
        col = TIER.get(b.get('tier') or 'B', (150, 90, 255)) if reveal else (90, 70, 170)
        canvas = background(t, col).convert('RGBA')
        # progress: one dot per round, done ones gold, this one pulsing
        for j in range(5):
            r = 22 if j != s['i'] else 22 + 6 * abs(math.sin(t * 6))
            d = ImageDraw.Draw(canvas); x = W / 2 + (j - 2) * 80
            d.ellipse((x - r, 330 - r, x + r, 330 + r), fill=GOLD_TOP if j < s['i'] or (j == s['i'] and reveal) else (60, 60, 110), outline=(10, 12, 28), width=5)
        put(canvas, text_sprite(f"#{s['i'] + 1}", 150, gold=True), 170, 470)
        put(canvas, pill(s['lvl'], {'EASY': EASY, 'MEDIUM': MEDIUM, 'HARD': HARD}[s['lvl']], size=56), W - 220, 470)
        a = art(b, 820)
        if not reveal:
            put_rays(canvas, (120, 100, 255), t, W / 2, 980, speed=10, alpha=0.5)
            pop = 1 + 0.4 * (1 - out_back(bt / 0.5, 1.4))
            if s['clue'] == 'shadow':
                put(canvas, silhouette(a, (200, 180, 255)), W / 2, 980, scale=pop)
            elif s['clue'] == 'pixel':
                step = min(3, int(bt))  # sharper on every beat: 9, 13, 19, 28 blocks across
                put(canvas, pixelated(a, (7, 10, 14, 22)[step]), W / 2, 980, scale=pop)
            else:
                z = 4.2 - 0.55 * min(bt, 3.6)  # slowly pulling back
                put(canvas, zoom_view(b, z), W / 2, 960, scale=pop)
            put(canvas, text_sprite(CLUES[s['clue']], 110, WHITE), W / 2, 1480, scale=out_back(bt / 0.4))
            if bt >= 1:
                n = 4 - int(bt); u = bt % 1
                put(canvas, text_sprite(str(n), 250, (255, 90, 110) if n == 1 else WHITE), W - 150, 760, scale=1 + 0.8 * (1 - out_back(u / 0.4, 1.3)))
                if u < 0.3: shake = max(shake, impact(u * P, 0.4))
            shake = max(shake, impact(lt, 0.8))
        else:
            u = bt - 4
            put_rays(canvas, col, t, W / 2, 980, speed=40, alpha=0.9)
            put(canvas, a, W / 2, 980, scale=1 + 0.25 * (1 - out_back(u / 0.4, 1.6)))
            put(canvas, text_sprite(nice(b['n']).upper(), 180, WHITE), W / 2, 1480, scale=out_back(u / 0.35, 1.6))
            shake = impact(u * P, 1.4); flash = impact(u * P) * 0.8
    else:  # q_outro
        canvas = background(t, (150, 90, 255)).convert('RGBA'); mark = False
        confetti(canvas, lt)
        slam(canvas, 'HOW MANY', 190, WHITE, W / 2, 400, bt)
        slam(canvas, 'DID YOU GET?', 160, None, W / 2, 590, bt - 0.6, gold=True)
        for j, b in enumerate(s['picks']):  # the answers, for anyone scrolling back
            u = (bt - 1.2 - j * 0.15) / 0.35
            if u > 0:
                f = load_face(b).resize((170, 170), Image.LANCZOS)
                x = W / 2 + (j - 2) * 195
                put(canvas, f, x, 810, scale=out_back(u))
                put(canvas, text_sprite(nice(b['n']).upper()[:9], 34, WHITE, stroke=5, shadow=False), x, 920, alpha=clamp(u))
        slam(canvas, 'COMMENT YOUR SCORE', 92, WHITE, W / 2, 1050, bt - 2.2)
        follow_cta(canvas, bt - 3.4, 1260, f"FOR QUIZ #{s['n'] + 1} TOMORROW")
        shake, flash = hits(bt, (0, 0.6, 2.2, 3.4), 0.8, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ broken
UP, DOWN = (60, 220, 120), (255, 70, 90)

if KIND == 'broken':
    base = {b['id']: b for b in (prev['recent'] if prev else data['all'])}
    rows = []
    for b in data['recent']:
        o = base.get(b['id'])
        if not o or not b.get('tier') or (b.get('battles') or 0) < 3000 or (o.get('battles') or 0) < 3000:
            continue
        rows.append({**b, 'was': o['tier'], 'd': b['wr'] - o['wr']})
    rows.sort(key=lambda r: -r['d'])
    # "Broken" is a strong pick getting stronger, not an F tier getting less
    # bad; "fell off" is a pick people trust getting worse.
    up = [r for r in rows if r['tier'] in 'SAB' and r['d'] > 0][:3]
    down = [r for r in reversed(rows) if r['was'] in 'SABC' and r['d'] < 0][:2]
    if len(up) < 3 or len(down) < 2 or up[0]['d'] < 0.015 or up[2]['d'] < 0.005:
        print('a flat week: nothing got broken'); sys.exit(3)
    battles = sum(b.get('battles') or 0 for b in data['recent']) // 6  # six brawlers a battle
    tl.add(4, 'b_intro')
    for i, r in enumerate(reversed(up)):  # #3, #2, then #1
        tl.add(6, 'b_up', r=r, rank=3 - i)
    tl.add(3, 'b_turn')
    for r in down:
        tl.add(5, 'b_down', r=r)
    tl.add(7, 'b_outro')
    N = episode('broken')
    line = lambda r: f"{nice(r['n'])} {pct(r['d'], True)}" + (f" ({r['was']} → {r['tier']})" if r['was'] != r['tier'] else '')
    META = {
        'title': 'Who got BROKEN this week? 📈 Brawl Stars Ranked',
        'titles': {'pt-BR': 'Quem ficou QUEBRADO esta semana? 📈 Brawl Stars Ranqueado', 'es-419': '¿Quién está ROTO esta semana? 📈 Brawl Stars Competitivo'},
        'description': 'Biggest win-rate climbers in Brawl Stars Ranked this week: '
                       + ', '.join(line(r) for r in up) + '. And who fell off: '
                       + ', '.join(line(r) for r in down)
                       + f'. From {battles:,} Ranked battles, last 3 days against the same days a week before. '
                       'Who is next? 👇\n\n'
                       f'Live tier list: https://brawlzone.net/tier-list/ranked{FOOTER}\n'
                       '#brawlstars #brawlstarsranked #brawlstarsmeta #brawlstarstierlist #brawlzone',
    }


ARROW_R = Image.new('RGBA', (120, 110), (0, 0, 0, 0))
ImageDraw.Draw(ARROW_R).polygon([(6, 30), (60, 30), (60, 4), (114, 55), (60, 106), (60, 80), (6, 80)], fill=WHITE, outline=(10, 12, 28), width=7)


def counter_text(d, u, col):
    v = d * out_cubic(u)
    return text_sprite(pct(v, True), 170, col)


def tier_change(canvas, was, now, u, y):
    if was == now:
        put(canvas, tier_pill(now), W / 2, y, scale=out_back(u / 0.4))
        return
    put(canvas, tier_pill(was), W / 2 - 250, y, scale=0.8 * out_back(u / 0.4))
    if u > 0.4: put(canvas, ARROW_R, W / 2, y - 6, scale=out_back((u - 0.4) / 0.3))
    if u > 0.7: put(canvas, tier_pill(now), W / 2 + 250, y, scale=0.8 * (1 + 0.6 * (1 - out_back((u - 0.7) / 0.4, 1.4))))


def broken_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'b_intro':
        canvas = background(t, DOWN).convert('RGBA')
        slam(canvas, 'WHO GOT', 190, WHITE, W / 2, 560, bt)
        if bt > 1:
            jit = math.sin(t * 60) * 8 * max(0, 1 - (bt - 1) / 2)
            put(canvas, text_sprite('BROKEN', 280, DOWN), W / 2 + jit, 800, scale=1 + 1.8 * (1 - out_back((bt - 1) / 0.55, 1.2)) if bt - 1 < 0.55 else 1, rot=-4)
        slam(canvas, 'THIS WEEK?', 170, None, W / 2, 1040, bt - 2, gold=True)
        if bt > 3: put(canvas, pill('REAL RANKED DATA', (30, 40, 90), size=58), W / 2, 1260, scale=out_back((bt - 3) / 0.4))
        shake, flash = hits(bt, (0, 1, 2), 1.3, 0.5)
    elif k == 'b_up':
        r = s['r']; col = TIER.get(r['tier'], UP)
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, UP, t, W / 2, 780, speed=30, alpha=0.7)
        put(canvas, text_sprite(f"#{s['rank']}", 170, gold=True), 170, 400, scale=out_back(bt / 0.4))
        u = (lt - 0.1) / 0.4
        put(canvas, art(r, 680, 760), W / 2, 760, scale=(1 + 0.5 * (1 - out_back(u, 1.6))) if u > 0 else 0)
        put(canvas, text_sprite(nice(r['n']).upper(), 160, WHITE), W / 2, 1150, scale=out_back((bt - 0.5) / 0.4, 1.5))
        if bt > 1.5:
            put(canvas, counter_text(r['d'], (bt - 1.5) / 1.2, UP), W / 2 - 60, 1320, scale=out_back((bt - 1.5) / 0.4))
            arrow(canvas, W / 2 + 330, 1310 - 30 * abs(math.sin(t * 5)), UP, flip=True)
            put(canvas, text_sprite('WIN RATE', 54, (200, 210, 235), stroke=5, font=G), W / 2, 1430, alpha=clamp(bt - 1.7))
        if bt > 3: tier_change(canvas, r['was'], r['tier'], bt - 3, 1570)
        if s['rank'] == 1 and bt > 4:
            st = text_sprite('BROKEN!' if r['tier'] == 'S' else 'RISING!', 190, DOWN if r['tier'] == 'S' else UP)
            put(canvas, st, W / 2, 640, scale=1 + 1.6 * (1 - out_back((bt - 4) / 0.4, 1.0)), rot=12)
            if bt - 4 < 0.5: shake = max(shake, impact((bt - 4) * P, 1.4)); flash = max(flash, impact((bt - 4) * P) * 0.5)
        sh, fl = hits(bt, (0, 1.5, 3), 0.9, 0.3); shake = max(shake, sh); flash = max(flash, fl)
    elif k == 'b_turn':
        canvas = background(t, (60, 60, 90)).convert('RGBA')
        slam(canvas, 'AND WHO', 170, WHITE, W / 2, 760, bt)
        slam(canvas, 'FELL OFF?', 210, DOWN, W / 2, 980, bt - 1)
        if bt > 1: arrow(canvas, W / 2, 1300 + 40 * out_cubic(bt - 1), DOWN)
        shake, flash = hits(bt, (0, 1), 1.0, 0.3)
    elif k == 'b_down':
        r = s['r']
        canvas = background(t, (70, 70, 100)).convert('RGBA')
        u = (lt - 0.1) / 0.4
        drop = 60 * out_cubic(bt / 4)
        put(canvas, grey(art(r, 680, 760)), W / 2, 740 + drop, scale=(1 + 0.4 * (1 - out_back(u, 1.4))) if u > 0 else 0)
        put(canvas, text_sprite(nice(r['n']).upper(), 160, WHITE), W / 2, 1150, scale=out_back((bt - 0.5) / 0.4, 1.5))
        if bt > 1.5:
            put(canvas, counter_text(r['d'], (bt - 1.5) / 1.2, DOWN), W / 2 - 60, 1320, scale=out_back((bt - 1.5) / 0.4))
            arrow(canvas, W / 2 + 330, 1310 + 30 * abs(math.sin(t * 5)), DOWN)
            put(canvas, text_sprite('WIN RATE', 54, (200, 210, 235), stroke=5, font=G), W / 2, 1430, alpha=clamp(bt - 1.7))
        if bt > 3: tier_change(canvas, r['was'], r['tier'], bt - 3, 1570)
        shake, flash = hits(bt, (0, 1.5), 0.8, 0.2)
    else:  # b_outro
        canvas = background(t, (255, 170, 40)).convert('RGBA'); mark = False
        confetti(canvas, lt)
        bounce = abs(math.sin(bt * math.pi)) * 26
        put(canvas, text_sprite('AGREE?', 260, gold=True), W / 2, 520 - bounce, scale=out_back(bt / 0.6))
        slam(canvas, "WHO'S BROKEN NEXT?", 100, WHITE, W / 2, 770, bt - 0.8)
        slam(canvas, 'TELL US IN THE COMMENTS', 70, WHITE, W / 2, 880, bt - 1.4)
        follow_cta(canvas, bt - 2.6, 1200, 'FOR THE NEXT ONE')
        shake, flash = hits(bt, (0, 0.8, 2.6), 0.8, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ ranks
LOWC, LEGC = (70, 150, 255), (255, 175, 40)

if KIND == 'ranks':
    BR = data['brackets']
    low = BR['low']['top'][:5]; leg = BR['pro']['top'][:5]
    leg_ids = {b['id'] for b in BR['pro']['top']}
    tl.add(4, 'p_intro')
    tl.add(6, 'p_list', side='low', items=low)
    tl.add(6, 'p_list', side='leg', items=leg)
    tl.add(5, 'p_reveal', low1=low[0], leg1=leg[0], missing=low[0]['id'] not in leg_ids)
    tl.add(7, 'p_outro')
    META = {
        'title': 'What you pick vs what MASTERS pick 😳',
        'titles': {'pt-BR': 'O que você escolhe vs o que os MESTRES escolhem 😳', 'es-419': 'Lo que tú eliges vs lo que eligen los MAESTROS 😳'},
        'description': f"What you pick vs what MASTERS pick in Brawl Stars Ranked this week. "
                       f"Diamond & below: {', '.join(nice(b['n']) for b in low[:3])}. "
                       f"Masters+: {', '.join(nice(b['n']) for b in leg[:3])}. What rank are you? 👇\n\n"
                       f'Tier list for YOUR rank: https://brawlzone.net/tier-list/ranked{FOOTER}\n'
                       '#brawlstars #brawlstarsranked #brawlstarsmeta #brawlstarstips #brawlzone',
    }


def ranks_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'p_intro':
        canvas = background(t, (40, 40, 90)).convert('RGBA')
        left = Image.new('RGBA', (W // 2, H), LOWC + (60,)); right = Image.new('RGBA', (W // 2, H), LEGC + (60,))
        canvas.alpha_composite(left, (int(-W // 2 * (1 - out_cubic(bt / 0.6))), 0)); canvas.alpha_composite(right, (int(W // 2 + W // 2 * (1 - out_cubic(bt / 0.6))), 0))
        slam(canvas, 'WHAT YOU', 120, LOWC, W / 2, 460, bt)
        slam(canvas, 'PICK', 200, LOWC, W / 2, 620, bt)
        slam(canvas, 'VS', 220, WHITE, W / 2, 900, bt - 1, k=2.5)
        slam(canvas, 'WHAT MASTERS', 120, LEGC, W / 2, 1160, bt - 2)
        slam(canvas, 'PICK', 200, None, W / 2, 1320, bt - 2, gold=True)
        shake, flash = hits(bt, (0, 1, 2), 1.0, 0.3)
    elif k == 'p_list':
        low = s['side'] == 'low'; col = LOWC if low else LEGC
        canvas = background(t, col).convert('RGBA')
        slam(canvas, 'DIAMOND & BELOW' if low else 'MASTERS+', 110, col, W / 2, 360, bt)
        put(canvas, text_sprite('most picked this week', 50, (200, 210, 235), stroke=5, font=G), W / 2, 460, alpha=clamp(bt * 2))
        for j, b in enumerate(s['items']):
            u = (bt - 0.5 - j * 0.6) / 0.4
            if u <= 0: continue
            y = 600 + j * 205
            row = Image.new('RGBA', (940, 200), (0, 0, 0, 0)); d = ImageDraw.Draw(row)
            row.paste(vgrad(940, 200, tuple(min(255, int(c * 0.5 + 60)) for c in col), tuple(int(c * 0.3) for c in col)).convert('RGBA'), (0, 0), rounded_mask(940, 200, 40))
            d.rounded_rectangle((0, 0, 939, 199), 40, outline=WHITE, width=5)
            row.alpha_composite(load_face(b).resize((170, 170), Image.LANCZOS), (16, 15))
            d.text((210, 22), f'#{j + 1}', font=F(60), fill=GOLD_TOP, stroke_width=5, stroke_fill=(10, 12, 28))
            d.text((210, 90), nice(b['n']), font=F(84), fill=WHITE, stroke_width=6, stroke_fill=(10, 12, 28))
            p = pct(b['use']); d.text((910 - F(90).getlength(p), 50), p, font=F(90), fill=WHITE, stroke_width=6, stroke_fill=(10, 12, 28))
            put(canvas, row, W / 2 + (900 if low else -900) * (1 - out_back(u, 1.3)), y)
            if u < 0.5: shake = max(shake, impact(u * 0.4, 0.4))
    elif k == 'p_reveal':
        canvas = background(t, (40, 40, 90)).convert('RGBA')
        a1, a2 = s['low1'], s['leg1']
        put(canvas, art(a1, 640, 480), W * 0.27, 760, scale=out_back(bt / 0.5))
        put(canvas, art(a2, 640, 480), W * 0.73, 760, scale=out_back((bt - 0.5) / 0.5))
        put(canvas, text_sprite(nice(a1['n']).upper(), 100, LOWC), W * 0.27, 1130, scale=out_back(bt / 0.5))
        put(canvas, text_sprite(nice(a2['n']).upper(), 100, LEGC), W * 0.73, 1130, scale=out_back((bt - 0.5) / 0.5))
        put(canvas, text_sprite('#1 LOW RANKS', 54, WHITE, stroke=5), W * 0.27, 1230, alpha=clamp(bt * 2))
        put(canvas, text_sprite('#1 MASTERS+', 54, WHITE, stroke=5), W * 0.73, 1230, alpha=clamp(bt * 2 - 1))
        slam(canvas, 'VS', 120, WHITE, W / 2, 1135, bt - 1, k=2)
        if s['missing'] and bt > 2.2:
            put(canvas, text_sprite(f"{nice(a1['n']).upper()} ISN'T EVEN", 92, (255, 90, 110)), W / 2, 1400, scale=out_back((bt - 2.2) / 0.4))
            put(canvas, text_sprite('TOP 8 IN MASTERS+', 92, (255, 90, 110)), W / 2, 1510, scale=out_back((bt - 2.4) / 0.4))
            if bt - 2.2 < 0.5: shake = max(shake, impact((bt - 2.2) * P, 1.1)); flash = max(flash, impact((bt - 2.2) * P) * 0.3)
        if bt < 0.5: shake = max(shake, impact(lt, 0.8))
    else:  # p_outro
        canvas = background(t, (255, 170, 40)).convert('RGBA'); mark = False
        slam(canvas, 'WHAT RANK', 190, WHITE, W / 2, 470, bt)
        slam(canvas, 'ARE YOU?', 230, None, W / 2, 690, bt - 0.6, gold=True)
        slam(canvas, 'TELL US + YOUR MAIN', 96, WHITE, W / 2, 910, bt - 1.2)
        follow_cta(canvas, bt - 2.4, 1200, 'A NEW ONE EVERY DAY')
        shake, flash = hits(bt, (0, 0.6, 1.2, 2.4), 0.8, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ modes
MODE_COL = {'hotZone': (255, 70, 70), 'heist': (255, 90, 190), 'knockout': (255, 160, 40), 'brawlBall': (60, 150, 255),
            'gemGrab': (170, 90, 255), 'bounty': (40, 210, 230), 'wipeout': (120, 220, 90)}
MODE_NAME = {'hotZone': 'HOT ZONE', 'heist': 'HEIST', 'knockout': 'KNOCKOUT', 'brawlBall': 'BRAWL BALL',
             'gemGrab': 'GEM GRAB', 'bounty': 'BOUNTY', 'wipeout': 'WIPEOUT'}


def mode_key(m):
    return {k.lower(): k for k in MODE_COL}.get(m.replace('-', '').replace('_', '').lower())


if KIND == 'modes':
    import collections
    best = []
    for e in data['pool']:
        mk = mode_key(e['mode'])
        if not mk: continue
        c = collections.Counter(); pos = collections.defaultdict(int); maps = 0
        for m in e['maps']:
            if not m['picks']: continue
            maps += 1
            for i, p in enumerate(m['picks'][:3]): c[p['id']] += 1; pos[p['id']] += 3 - i
        if not c: continue
        top = sorted(c, key=lambda i: (-c[i], -pos[i]))[0]
        best.append((mk, by_id.get(top) or {'id': top, 'n': '?', 'tier': 'B'}, c[top], maps))
    if len(best) < 4:
        print('not enough live modes'); sys.exit(3)
    tl.add(5, 'm_intro', modes=[b[0] for b in best])
    seen = set()
    for mk, b, n_hits, maps in best:
        tl.add(4, 'm_mode', mode=mk, b=b, hits=n_hits, maps=maps, again=b['id'] in seen); seen.add(b['id'])
    tl.add(7, 'm_outro')
    META = {
        'title': 'The BEST brawler for EVERY mode 🏆',
        'titles': {'pt-BR': 'O MELHOR brawler para CADA modo 🏆', 'es-419': 'El MEJOR brawler para CADA modo 🏆'},
        'description': 'The best brawler for every Ranked mode right now: '
                       + ', '.join(f"{MODE_NAME[mk].title()}: {nice(b['n'])}" for mk, b, _, _ in best)
                       + ". The pick that is top 3 on the most live maps of each mode. Save this for your next game 👇\n\n"
                       f'Best picks for every map: https://brawlzone.net/maps{FOOTER}\n'
                       '#brawlstars #brawlstarsranked #brawlstarsmeta #brawlstarstips #brawlzone',
    }


def modes_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'm_intro':
        canvas = background(t, (255, 170, 40)).convert('RGBA')
        slam(canvas, 'THE BEST', 210, WHITE, W / 2, 470, bt)
        slam(canvas, 'BRAWLER', 210, WHITE, W / 2, 680, bt - 1)
        slam(canvas, 'FOR EVERY MODE', 130, None, W / 2, 880, bt - 2, gold=True)
        for i, m in enumerate(s['modes']):
            u = bt - 3 - i * 0.25
            if u > 0: put(canvas, pill(MODE_NAME[m], MODE_COL[m], size=46), W / 2 + (i % 2 - 0.5) * 440, 1110 + (i // 2) * 130, scale=out_back(u / 0.35))
        shake, flash = hits(bt, (0, 1, 2), 0.8, 0.3)
    elif k == 'm_mode':
        col = MODE_COL[s['mode']]; b = s['b']
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 900, speed=20, alpha=0.8)
        slam(canvas, MODE_NAME[s['mode']], 150, col, W / 2, 400, bt)
        u = (lt - 0.12) / 0.4
        put(canvas, art(b, 760), W / 2, 880, scale=(1 + 0.5 * (1 - out_back(u, 1.6))) if u > 0 else 0)
        put(canvas, text_sprite(nice(b['n']).upper(), 170, WHITE), W / 2, 1340, scale=out_back((bt - 0.5) / 0.4, 1.5))
        if bt > 1.2:
            put(canvas, pill(f"TOP 3 ON {s['hits']} OF {s['maps']} MAPS", (30, 40, 90), size=54), W / 2, 1490, scale=out_back((bt - 1.2) / 0.35))
        if s.get('again') and bt > 2:
            st = text_sprite(f"{nice(b['n']).upper()} AGAIN?!", 110, GOLD_TOP).rotate(-10, expand=True)
            put(canvas, st, W / 2, 620, scale=1 + 1.4 * (1 - out_back((bt - 2) / 0.4, 1.0)))
            if bt - 2 < 0.5: shake = max(shake, impact((bt - 2) * P, 1.2))
        shake = max(shake, impact(lt, 1.0)); flash = max(flash, impact(lt) * 0.35)
    else:  # m_outro
        canvas = background(t, (255, 170, 40)).convert('RGBA'); mark = False
        slam(canvas, 'SAVE THIS', 230, None, W / 2, 480, bt, gold=True)
        slam(canvas, 'FOR YOUR NEXT GAME', 104, WHITE, W / 2, 700, bt - 0.7)
        slam(canvas, 'WHO DO YOU MAIN?', 90, WHITE, W / 2, 860, bt - 1.4)
        follow_cta(canvas, bt - 2.6, 1200, 'A NEW ONE EVERY DAY')
        shake, flash = hits(bt, (0, 0.7, 1.4, 2.6), 0.8, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ render
SCENE = {'quiz': quiz_scene, 'broken': broken_scene, 'ranks': ranks_scene, 'modes': modes_scene}[KIND]


def frame(t):
    s, bt, lt = tl.at(t)
    return SCENE(s, t, bt, lt)


if __name__ == '__main__':
    os.makedirs(f'{OUT}/frames', exist_ok=True)
    META['duration'] = round(tl.dur, 3)
    META['kind'] = KIND
    META['episode'] = episode(KIND)
    json.dump(META, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False)
    if ONLY is not None:
        for sec in ONLY:
            frame(sec).save(f'{OUT}/{KIND}-{sec}.jpg', quality=85)
        print(KIND, 'duration', round(tl.dur, 2)); sys.exit()
    n = int(tl.dur * FPS); part, parts = int(os.environ.get('PART', 0)), int(os.environ.get('PARTS', 1))
    for i in range(n):
        if i % parts != part or os.path.exists(f'{OUT}/frames/{i:04d}.jpg'): continue
        frame(i / FPS).save(f'{OUT}/frames/{i:04d}.jpg', quality=92)
    print(KIND, 'frames', n, 'duration', round(tl.dur, 2))
