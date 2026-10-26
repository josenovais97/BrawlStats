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
         newbrawler  "Is <new brawler> broken?": tier after their first
                 battles, best maps, the build; data is then
                 scripts/new-brawler-report.ts output, art beside it in OUT.
         everyrank  "Every brawler ranked from worst to best" (2026-10-26):
                 the whole roster by this week's meta score, the best Short
                 of the channel's first month made a weekly format.
         classrank  the same countdown inside one class or rarity ("every
                 assassin ranked"), the next group each episode.
         stop    "STOP picking these brawlers": the most-picked that lose,
                 then the least-picked that win.
         daily   "Can you guess today's brawler?" (2026-10-23): the first four
                 steps of the site's Zoom puzzle and its Shadow, never the
                 answer, which is at brawlzone.net/daily-challenge. data is
                 {"date", "number"}; zoom-0..3 and shadow images beside it in
                 OUT, fetched from the site by the caller.
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
from PIL import Image, ImageDraw, ImageFilter

from engine import (W, H, FPS, P, WHITE, GOLD_TOP, NAVY, TIER, F, G, Timeline, art, arrow, background, card, clamp,
                    confetti, crown, finish, follow_cta, grey, hits, impact, load_face, load_model, nice, out_back,
                    out_cubic, pill, put, put_rays, rounded_mask, silhouette, slam, text_sprite, tier_pill, vgrad)

KIND, DATA, PREV, STATE, OUT = sys.argv[1:6]
ONLY = [float(x) for x in sys.argv[7:]] if len(sys.argv) > 6 and sys.argv[6] == '--only' else None
data = json.load(open(DATA))
prev = json.load(open(PREV)) if PREV != '-' else None
try:
    state = json.load(open(STATE))
except (OSError, ValueError):
    state = {}
rnd = random.Random(f"{data.get('date', '')}/{KIND}")
by_id = {b['id']: b for b in data.get('all', [])}
# Slower since 2026-10-23 (see Timeline): half-time where you guess, longer
# holds where you read.
PACING = {'quiz': {'pace': 2}, 'daily': {'pace': 2}, 'everyrank': {'hold': 1.2}}
tl = Timeline(**PACING.get(KIND, {'hold': 1.5}))
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
                       f'3 more to guess today (shadow, zoom, clues): https://brawlzone.net/daily-challenge{FOOTER}\n'
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
    # Without last week's snapshot the only baseline is the 7-day window,
    # which contains the 3 days being measured: every change comes out half
    # its size, too small to call anything broken.
    if not prev:
        print('no snapshot from a week ago yet'); sys.exit(3)
    base = {b['id']: b for b in prev['recent']}
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


# ================================================================ newbrawler
# data is scripts/new-brawler-report.ts output; deploy/bin/brawlzone-viral
# leaves the art next to it in OUT: hero.png (model, else portrait, else the
# profile icon) and, when Brawlify has them yet, gadget.png and starpower.png.
VERDICT = {'S': ('BROKEN!', (255, 60, 100)), 'A': ('STRONG', (255, 140, 40)), 'B': ('SOLID', (255, 205, 40)),
           'C': ('MID', (70, 215, 120)), 'D': ('MID', (60, 170, 255)), 'E': ('WEAK...', (150, 105, 255)),
           'F': ('WEAK...', (125, 135, 170))}


def mode_label(m):
    return ''.join(' ' + c if c.isupper() else c for c in m).strip().upper()


def optional(path):
    return Image.open(path).convert('RGBA') if os.path.exists(path) else None


if KIND == 'newbrawler':
    R = data
    if not R.get('tier') or not R.get('name'):
        print('no tier yet'); sys.exit(3)
    HERO = optional(f'{OUT}/hero.png')
    if HERO is None:
        print('no art'); sys.exit(1)
    sc = min(820 / HERO.height, 860 / HERO.width)
    HERO = HERO.resize((int(HERO.width * sc), int(HERO.height * sc)), Image.LANCZOS)
    if HERO.getpixel((2, 2))[3] == 255:
        # The profile icon, a square: framed as a card, and hidden behind a
        # blurred "?" for the intro since its shadow would be a black box.
        w, h = HERO.size
        framed = Image.new('RGBA', (w + 28, h + 28), (0, 0, 0, 0))
        ImageDraw.Draw(framed).rounded_rectangle((0, 0, w + 27, h + 27), 70, fill=WHITE, outline=(10, 12, 28), width=8)
        framed.paste(HERO, (14, 14), rounded_mask(w, h, 58))
        HERO = framed
        MYSTERY = Image.blend(HERO.filter(ImageFilter.GaussianBlur(36)), Image.new('RGBA', HERO.size, (20, 20, 50, 255)), 0.45)
        MYSTERY.putalpha(HERO.getchannel('A'))
        q = text_sprite('?', 520, WHITE)
        MYSTERY.alpha_composite(q, ((MYSTERY.width - q.width) // 2, (MYSTERY.height - q.height) // 2))
    else:
        MYSTERY = silhouette(HERO, (255, 255, 255))
    ICONS = {'gadget': optional(f'{OUT}/gadget.png'), 'starPower': optional(f'{OUT}/starpower.png')}
    # Its best maps against each map's average, one per mode, on enough battles.
    maps, modes_seen = [], set()
    for m in sorted(R.get('maps') or [], key=lambda m: -(m['wr'] - m['base'])):
        if m['n'] >= 2000 and m['mode'] not in modes_seen and len(maps) < 3:
            maps.append(m); modes_seen.add(m['mode'])
    build = [(k, (R.get('build') or {}).get(k) or []) for k in ('gadget', 'starPower')]
    build = [(k, v[0]) for k, v in build if v and v[0].get('name')]
    NAME = R['name'].upper()
    tl.add(5, 'n_intro')
    tl.add(5, 'n_reveal')
    tl.add(6, 'n_tier')
    if maps: tl.add(6, 'n_maps', maps=maps)
    if build: tl.add(6, 'n_build', build=build)
    tl.add(7, 'n_outro')
    META = {
        'title': f"Is {R['name']} broken? {R['tier']} tier after {R['battles']:,} battles 😳",
        'titles': {'pt-BR': f"{R['name']} está quebrado? Tier {R['tier']} depois de {R['battles']:,} partidas 😳".replace(',', '.'),
                   'es-419': f"¿{R['name']} está roto? Tier {R['tier']} tras {R['battles']:,} partidas 😳"},
        'description': f"{R['name']}, the new {R.get('rarity') or ''} {R.get('class') or 'brawler'}: "
                       f"{R['tier']} tier, #{R['rank']} of {R['of']} brawlers after {R['battles']:,} real battles since release. "
                       + (f"Best maps so far: {', '.join(m['map'] for m in maps)}. " if maps else '')
                       + (f"Most players run {' + '.join(b['name'] for _, b in build)}. " if build else '')
                       + f"Are you buying {R['name']}? 👇\n\n"
                       f"Full stats: https://brawlzone.net/brawlers/{'-'.join(''.join(c if c.isalnum() else ' ' for c in R['name'].lower()).split())}{FOOTER}\n"
                       f"#brawlstars #{''.join(ch for ch in R['name'].lower() if ch.isalnum())} #brawlstarsnewbrawler #brawlstarsmeta #brawlzone",
    }


def nb_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    tier = R['tier']; tcol = TIER.get(tier, (255, 60, 100))
    if k == 'n_intro':
        siren = (255, 50, 70) if int(t * 4) % 2 == 0 else (60, 120, 255)
        canvas = background(t, siren).convert('RGBA')
        put_rays(canvas, siren, t, W / 2, 960, speed=60, alpha=0.6)
        put(canvas, MYSTERY, W / 2, 980, scale=0.9 + 0.05 * math.sin(t * 8), alpha=0.95)
        slam(canvas, 'NEW', 230, None, W / 2, 380, bt, gold=True)
        slam(canvas, 'BRAWLER', 200, WHITE, W / 2, 590, bt - 1)
        slam(canvas, 'IS IT BROKEN?', 120, WHITE, W / 2, 1520, bt - 3)
        shake, flash = hits(bt, (0, 1, 3), 1.3, 0.5)
    elif k == 'n_reveal':
        canvas = background(t, tcol).convert('RGBA')
        put_rays(canvas, tcol, t, W / 2, 900, speed=40, alpha=0.9)
        put(canvas, HERO, W / 2, 880, scale=1 + 0.35 * (1 - out_back(bt / 0.45, 1.6)))
        nm = 220 if len(NAME) <= 7 else 160
        put(canvas, text_sprite(NAME, nm, gold=True), W / 2, 1360, scale=1 + 1.2 * (1 - out_back((bt - 0.3) / 0.5, 1.2)) if bt > 0.3 else 0)
        tags = [x for x in (R.get('rarity'), R.get('class')) if x]
        for j, tag in enumerate(tags):
            u = (bt - 1.5 - j * 0.4) / 0.35
            if u > 0: put(canvas, pill(tag.upper(), (30, 40, 90), size=52), W / 2 + (j - (len(tags) - 1) / 2) * 420, 1540, scale=out_back(u))
        shake = impact(lt, 1.5); flash = impact(lt) * 0.9
    elif k == 'n_tier':
        canvas = background(t, tcol).convert('RGBA')
        put(canvas, text_sprite('AFTER', 90, WHITE), W / 2, 380, alpha=clamp(bt * 3))
        n = int(R['battles'] * out_cubic(bt / 1.2))
        put(canvas, text_sprite(f'{n:,}', 200, gold=True), W / 2, 540)
        put(canvas, text_sprite('REAL BATTLES', 90, WHITE), W / 2, 700, alpha=clamp(bt * 3))
        if bt > 1.5:
            u = bt - 1.5
            put(canvas, tier_pill(tier), W / 2, 960, scale=1.9 * (1 + 1.2 * (1 - out_back(u / 0.5, 1.2))) if u < 0.5 else 1.9)
        if bt > 2.6:
            put(canvas, text_sprite(f"#{R['rank']} OF {R['of']} BRAWLERS", 96, WHITE), W / 2, 1180, scale=out_back((bt - 2.6) / 0.4))
        if bt > 3.8:
            word, col = VERDICT[tier]
            put(canvas, text_sprite(word, 210, col), W / 2, 1420, scale=1 + 1.6 * (1 - out_back((bt - 3.8) / 0.4, 1.0)), rot=-8)
            if tier in 'SA': confetti(canvas, (bt - 3.8) * P)
        shake, flash = hits(bt, (1.5, 2.6, 3.8), 1.3, 0.5)
    elif k == 'n_maps':
        canvas = background(t, (40, 150, 255)).convert('RGBA')
        slam(canvas, 'BEST MAPS', 170, None, W / 2, 380, bt, gold=True)
        put(canvas, text_sprite(f"where {R['name']} wins most", 54, (200, 210, 235), stroke=5, font=G), W / 2, 500, alpha=clamp(bt * 2))
        for j, m in enumerate(s['maps']):
            u = (bt - 0.8 - j * 0.7) / 0.4
            if u <= 0: continue
            row = Image.new('RGBA', (940, 230), (0, 0, 0, 0)); d = ImageDraw.Draw(row)
            row.paste(vgrad(940, 230, (60, 110, 200), (20, 40, 100)).convert('RGBA'), (0, 0), rounded_mask(940, 230, 44))
            d.rounded_rectangle((0, 0, 939, 229), 44, outline=WHITE, width=5)
            d.text((40, 30), f'#{j + 1}', font=F(80), fill=GOLD_TOP, stroke_width=6, stroke_fill=(10, 12, 28))
            name = m['map']; fs = 84
            while F(fs).getlength(name) > 720 and fs > 44: fs -= 4
            d.text((180, 30), name, font=F(fs), fill=WHITE, stroke_width=6, stroke_fill=(10, 12, 28))
            d.text((182, 140), mode_label(m['mode']), font=F(50), fill=(170, 200, 255), stroke_width=4, stroke_fill=(10, 12, 28))
            put(canvas, row, W / 2 + 900 * (1 - out_back(u, 1.3)), 720 + j * 270)
            if u < 0.5: shake = max(shake, impact(u * 0.4, 0.5))
    elif k == 'n_build':
        canvas = background(t, (150, 90, 255)).convert('RGBA')
        slam(canvas, 'THE BUILD', 170, None, W / 2, 380, bt, gold=True)
        put(canvas, text_sprite('what most players run', 54, (200, 210, 235), stroke=5, font=G), W / 2, 500, alpha=clamp(bt * 2))
        for j, (kind, b) in enumerate(s['build']):
            u = (bt - 0.8 - j * 1.2) / 0.45
            if u <= 0: continue
            y = 800 + j * 420
            col = (60, 200, 110) if kind == 'gadget' else (255, 190, 40)
            icon = ICONS.get(kind)
            if icon is not None:
                put(canvas, icon.resize((220, 220), Image.LANCZOS), W / 2, y - 40, scale=out_back(u, 1.8))
            else:
                put(canvas, pill('GADGET' if kind == 'gadget' else 'STAR POWER', col, size=70), W / 2, y - 40, scale=out_back(u, 1.8))
            put(canvas, text_sprite(b['name'].upper(), 96 if len(b['name']) <= 14 else 74, WHITE), W / 2, y + 130, scale=out_back((u - 0.3) / 0.8))
            put(canvas, text_sprite(f"{('GADGET' if kind == 'gadget' else 'STAR POWER')} · {b['share'] * 100:.0f}% PICK IT", 50, col, stroke=5),
                W / 2, y + 230, alpha=clamp(u - 0.6))
            if u < 0.5: shake = max(shake, impact(u * 0.45 * P, 0.9))
    else:  # n_outro
        canvas = background(t, (255, 170, 40)).convert('RGBA'); mark = False
        put(canvas, HERO.resize((HERO.width // 2, HERO.height // 2)), W / 2, 470, scale=out_back(bt / 0.5))
        slam(canvas, 'BUYING', 170, WHITE, W / 2, 780, bt - 0.5)
        slam(canvas, f'{NAME}?', 170 if len(NAME) <= 8 else 130, None, W / 2, 950, bt - 1, gold=True)
        slam(canvas, 'YES OR NO IN THE COMMENTS', 64, WHITE, W / 2, 1080, bt - 1.6)
        follow_cta(canvas, bt - 2.6, 1320, 'FOR EVERY NEW BRAWLER')
        shake, flash = hits(bt, (0.5, 1, 2.6), 0.9, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ daily
# The site's own puzzle as a dare. Every other format gives its answers away,
# so nobody needs the site; this one stops before the answer and says where
# it is. Four of the six zoom steps, so the site still has two to give.
ZOOM_STEPS = 4

if KIND == 'daily':
    N = data['number']
    ZOOMS = [Image.open(f'{OUT}/zoom-{i}.webp').convert('RGBA') for i in range(ZOOM_STEPS)]
    SHADOW = Image.open(f'{OUT}/shadow.webp').convert('RGBA')
    sc = 760 / max(SHADOW.size)
    SHADOW = silhouette(SHADOW.resize((int(SHADOW.width * sc), int(SHADOW.height * sc)), Image.LANCZOS), (200, 180, 255))
    tl.add(4, 'd_intro')
    for i in range(ZOOM_STEPS):
        tl.add(3, 'd_zoom', i=i)
    tl.add(4, 'd_stuck')
    tl.add(4, 'd_shadow')
    tl.add(7, 'd_outro')
    META = {
        'title': f"Can you guess today's brawler? 🔍 BrawlZone Daily #{N}",
        'titles': {'pt-BR': f'Você consegue adivinhar o brawler de hoje? 🔍 BrawlZone Daily #{N}',
                   'es-419': f'¿Adivinas el brawler de hoy? 🔍 BrawlZone Daily #{N}'},
        'description': f"Today's Zoom puzzle: an extreme close-up that pulls back with every wrong guess. "
                       f"Who is it? Comment your guess 👇 No spoilers in the comments for 24 hours 😉\n\n"
                       f"The answer, two more zoom steps and today's Shadow and Classic puzzles: "
                       f"https://brawlzone.net/daily-challenge (new every day at midnight UTC){FOOTER}\n"
                       '#brawlstars #brawlstarsquiz #guessthebrawler #brawldle #brawlzone',
    }


def zoom_frame(img):
    """One zoom step from the site, in the same rounded white frame the site uses."""
    win = 760
    frame = Image.new('RGBA', (win + 24, win + 24), (0, 0, 0, 0)); d = ImageDraw.Draw(frame)
    d.rounded_rectangle((0, 0, win + 23, win + 23), 70, fill=(12, 14, 34, 255), outline=WHITE, width=10)
    frame.paste(img.resize((win, win), Image.LANCZOS), (12, 12), rounded_mask(win, win, 60))
    return frame


_heart = {}
def heart(full):
    if full not in _heart:
        im = Image.new('RGBA', (96, 90), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        col = (255, 60, 100) if full else (70, 70, 110)
        for c in ((6, 6, 50, 50), (46, 6, 90, 50)):
            d.ellipse(c, fill=col, outline=(10, 12, 28), width=6)
        d.polygon([(10, 36), (86, 36), (48, 84)], fill=col, outline=(10, 12, 28))
        d.line([(10, 38), (48, 84), (86, 38)], fill=(10, 12, 28), width=6)
        d.ellipse((12, 12, 46, 46), fill=col); d.ellipse((50, 12, 84, 46), fill=col)
        d.polygon([(16, 34), (80, 34), (48, 76)], fill=col)
        _heart[full] = im
    return _heart[full]


def daily_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'd_intro':
        canvas = background(t, (60, 170, 255)).convert('RGBA')
        put_rays(canvas, (60, 170, 255), t, W / 2, 1300, speed=10, alpha=0.5)
        put(canvas, zoom_frame(ZOOMS[0]), W / 2, 1330, scale=0.55 * out_back((bt - 0.5) / 0.5), rot=-6)
        slam(canvas, "TODAY'S", 170, WHITE, W / 2, 420, bt)
        slam(canvas, 'BRAWLER', 240, None, W / 2, 620, bt - 1, gold=True)
        if bt > 2: put(canvas, pill(f'DAILY #{N}', (255, 60, 100), size=80), W / 2, 820, scale=out_back((bt - 2) / 0.4, 2.2), rot=-5)
        if bt > 3: put(canvas, text_sprite('CAN YOU GUESS IT?', 80, WHITE, stroke=8), W / 2, 960, scale=out_back((bt - 3) / 0.4))
        shake, flash = hits(bt, (0, 1, 2, 3), 1.2, 0.5)
    elif k == 'd_zoom':
        i = s['i']
        canvas = background(t, (60, 170, 255)).convert('RGBA')
        put_rays(canvas, (80, 150, 255), t, W / 2, 960, speed=12, alpha=0.5)
        for j in range(6):  # the site's six hearts, one lost per zoom step
            put(canvas, heart(j >= i), W / 2 + (j - 2.5) * 110, 330, scale=1.25 if j == i - 1 and bt < 0.5 else 1)
        put(canvas, pill(f'ZOOM {i + 1}/6', (60, 170, 255), size=60), W / 2, 470)
        put(canvas, zoom_frame(ZOOMS[i]), W / 2, 960, scale=1 + 0.35 * (1 - out_back(bt / 0.5, 1.4)))
        put(canvas, text_sprite('WHO IS THIS?', 120, WHITE), W / 2, 1480, scale=out_back(bt / 0.4) if i == 0 else 1)
        n = 3 - int(bt); u = bt % 1
        put(canvas, text_sprite(str(n), 220, (255, 90, 110) if n == 1 else WHITE), W - 140, 700, scale=1 + 0.8 * (1 - out_back(u / 0.4, 1.3)))
        shake = impact(lt, 1.0); flash = impact(lt) * 0.5
        if u < 0.3: shake = max(shake, impact(u * P, 0.4))
    elif k == 'd_stuck':
        canvas = background(t, (255, 90, 120)).convert('RGBA')
        z = zoom_frame(ZOOMS[-1]).filter(ImageFilter.GaussianBlur(4 + 10 * clamp(bt / 2)))
        put(canvas, z, W / 2, 1000, scale=0.85)
        put(canvas, text_sprite('?', 520, WHITE), W / 2, 1000, scale=out_back((bt - 0.5) / 0.4, 2.0), rot=8)
        slam(canvas, 'STILL NO', 170, WHITE, W / 2, 330, bt)
        slam(canvas, 'IDEA?', 230, None, W / 2, 520, bt - 1, gold=True)
        slam(canvas, '2 MORE CLUES ON THE SITE', 70, WHITE, W / 2, 1520, bt - 2)
        shake, flash = hits(bt, (0, 1, 2), 1.1, 0.4)
    elif k == 'd_shadow':
        canvas = background(t, (150, 90, 255)).convert('RGBA')
        put_rays(canvas, (150, 90, 255), t, W / 2, 1020, speed=20, alpha=0.7)
        slam(canvas, '+ A SHADOW', 170, WHITE, W / 2, 380, bt)
        slam(canvas, 'TO GUESS', 150, None, W / 2, 560, bt - 0.7, gold=True)
        put(canvas, SHADOW, W / 2, 1050, scale=out_back((bt - 1) / 0.5, 1.6))
        slam(canvas, '+ THE CLASSIC PUZZLE', 76, WHITE, W / 2, 1560, bt - 2.2)
        shake, flash = hits(bt, (0, 0.7, 1, 2.2), 1.0, 0.4)
    else:  # d_outro
        canvas = background(t, (60, 170, 255)).convert('RGBA'); mark = False
        slam(canvas, 'ANSWER ON', 150, WHITE, W / 2, 360, bt)
        slam(canvas, 'BRAWLZONE.NET', 122, None, W / 2, 540, bt - 0.6, gold=True)
        if bt > 1.2: put(canvas, pill('DAILY CHALLENGE', (255, 60, 100), size=76), W / 2, 720, scale=out_back((bt - 1.2) / 0.4, 2.2), rot=-4)
        slam(canvas, 'COMMENT YOUR GUESS', 92, WHITE, W / 2, 920, bt - 2)
        follow_cta(canvas, bt - 3.2, 1220, 'NEW PUZZLE EVERY DAY')
        shake, flash = hits(bt, (0, 0.6, 1.2, 2, 3.2), 0.9, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ countdowns
# "Every brawler ranked from worst to best" was the best Short the channel
# had (2026-10-22: 2.2k views, 63 likes, made by hand in ~/shots/viral2), so
# it is a format now: `everyrank` weekly on fresh data, and `classrank`, the
# same countdown inside one class or rarity -- a different group each
# episode, so it is a series rather than a repeat. Both end on the question
# the original ended on, because its comments were the point.
GROUPS = [  # field, value, headline, plural in English / Brazilian Portuguese / Spanish
    ('cls', 'Assassin', 'ASSASSIN', 'assassins', 'assassinos', 'asesinos'),
    ('cls', 'Tank', 'TANK', 'tanks', 'tanques', 'tanques'),
    ('cls', 'Marksman', 'SNIPER', 'snipers', 'atiradores', 'francotiradores'),
    ('rar', 'Legendary', 'LEGENDARY', 'Legendary brawlers', 'brawlers lendários', 'brawlers legendarios'),
    ('cls', 'Support', 'SUPPORT', 'supports', 'suportes', 'soportes'),
    ('cls', 'Controller', 'CONTROLLER', 'controllers', 'controladores', 'controladores'),
    ('cls', 'Artillery', 'THROWER', 'throwers', 'arremessadores', 'lanzadores'),
    ('cls', 'Damage Dealer', 'DAMAGE DEALER', 'damage dealers', 'brawlers de dano', 'brawlers de daño'),
]
COUNT_HASHTAGS = '#brawlstars #brawlstarstierlist #brawlstarsranked #tierlist #brawlzone'

if KIND in ('everyrank', 'classrank'):
    N_EP = episode(KIND)
    if KIND == 'everyrank':
        ranked = sorted(data['all'], key=lambda b: -(b['score'] or 0))
        WORD, BEST_LINE = 'BRAWLER', 'THE BEST IN RANKED'
    else:
        # Episode N takes group N, skipping a group the data cannot fill (a
        # class the catalogue did not label, or fewer than five brawlers).
        ranked = None
        for k in range(len(GROUPS)):
            field, value, WORD, en_pl, pt_pl, es_pl = GROUPS[(N_EP - 1 + k) % len(GROUPS)]
            members = [b for b in data['all'] if b.get(field) == value]
            if len(members) >= 5:
                ranked = sorted(members, key=lambda b: -(b['score'] or 0))
                break
        if ranked is None:
            print('no class or rarity group has five brawlers today'); sys.exit(3)
        BEST_LINE = f'THE BEST {WORD}'
    NB = len(ranked)
    tl.add(6, 'c_intro')
    if NB > 20:  # the original's shape: tier pages, then the top 20 in rows, then one at a time
        bottom = [(i + 1, b) for i, b in enumerate(ranked) if i + 1 > 20][::-1]
        groups = []
        for r, b in bottom:
            if not groups or groups[-1][0] != b['tier']: groups.append((b['tier'], []))
            groups[-1][1].append((r, b))
        for tier, items in groups:
            tl.add(1, 'c_slam', tier=tier)
            for i in range(0, len(items), 9):
                tl.add(2, 'c_page', tier=tier, items=items[i:i + 9])
        mid = [(i + 1, ranked[i]) for i in range(10, 20)][::-1]
        tl.add(1, 'c_slam', tier=mid[0][1]['tier'], label='TOP 20')
        for i in range(0, 10, 5):
            tl.add(3, 'c_rows', label='TOP 20', items=mid[i:i + 5])
        tl.add(1, 'c_slam', tier=ranked[3]['tier'], label='TOP 10')
        singles = range(10, 1, -1)
    else:  # a class: everything below the top five in rows, then one at a time
        rest = [(i + 1, ranked[i]) for i in range(5, NB)][::-1]
        for i in range(0, len(rest), 5):
            tl.add(3, 'c_rows', label=f'#{rest[i][0]} TO #{rest[min(i + 4, len(rest) - 1)][0]}', items=rest[i:i + 5])
        tl.add(1, 'c_slam', tier=ranked[1]['tier'], label='TOP 5')
        singles = range(5, 1, -1)
    for r in singles:
        tl.add(3 if r <= 3 else 2, 'c_big', rank=r, b=ranked[r - 1], heavy=r <= 3)
    tl.add(4, 'c_tease', b=ranked[0])
    tl.add(7, 'c_one', b=ranked[0])
    tl.add(7, 'c_outro')
    top3 = ', '.join(nice(b['n']) for b in ranked[:3])
    if KIND == 'everyrank':
        META = {
            'title': 'Every brawler ranked from WORST to BEST 😳 #Shorts',
            'titles': {'pt-BR': 'Todos os brawlers do PIOR ao MELHOR 😳 #Shorts',
                       'es-419': 'Todos los brawlers del PEOR al MEJOR 😳 #Shorts'},
            'description': f"All {NB} brawlers ranked by this week's Ranked games (Season {data.get('season')}). "
                           f'Top 3: {top3}. Where is your main? Comment below 👇 New ranking every week.\n\n'
                           f'Full tier list for your rank: https://brawlzone.net/tier-list/ranked{FOOTER}\n{COUNT_HASHTAGS}',
        }
    else:
        META = {
            'title': f'Every {en_pl.split()[0] if en_pl[0].isupper() else en_pl[:-1]} ranked from WORST to BEST 😳 #Shorts',
            'titles': {'pt-BR': f'Todos os {pt_pl} do PIOR ao MELHOR 😳 #Shorts',
                       'es-419': f'Todos los {es_pl} del PEOR al MEJOR 😳 #Shorts'},
            'description': f"All {NB} {en_pl} ranked by this week's Ranked games (Season {data.get('season')}). "
                           f'Top 3: {top3}. Which one do you main? Comment below 👇 Another class next time.\n\n'
                           f'Full tier list for your rank: https://brawlzone.net/tier-list/ranked{FOOTER}\n{COUNT_HASHTAGS}',
        }


def count_row(rank, b):
    """One brawler as a wide row: portrait, rank, name, tier."""
    row = Image.new('RGBA', (940, 210), (0, 0, 0, 0)); d = ImageDraw.Draw(row)
    tc = TIER[b['tier']]
    row.paste(vgrad(940, 210, tuple(min(255, int(c * 0.5 + 60)) for c in tc), tuple(int(c * 0.35) for c in tc)).convert('RGBA'),
              (0, 0), rounded_mask(940, 210, 40))
    d.rounded_rectangle((0, 0, 939, 209), 40, outline=WHITE, width=5)
    row.alpha_composite(load_face(b).resize((176, 176), Image.LANCZOS), (18, 17))
    d.text((220, 22), f'#{rank}', font=F(64), fill=GOLD_TOP, stroke_width=5, stroke_fill=(10, 12, 28))
    name = nice(b['n']); fs = 88
    while F(fs).getlength(name) > 520 and fs > 48: fs -= 4
    d.text((220, 96), name, font=F(fs), fill=WHITE, stroke_width=6, stroke_fill=(10, 12, 28))
    d.text((900 - F(150).getlength(b['tier']), 18), b['tier'], font=F(150), fill=WHITE, stroke_width=8, stroke_fill=(10, 12, 28))
    return row


_wall = None
def count_wall():
    """The intro's tilted wall of every portrait in the countdown, faded."""
    global _wall
    if _wall is None:
        cols, size = 9, 170
        rows = math.ceil(max(NB, 27) / cols) + 2
        wall = Image.new('RGBA', (cols * size, rows * size), (0, 0, 0, 0))
        for i in range(cols * rows):
            f = load_face(ranked[i % NB]).resize((size - 12, size - 12), Image.LANCZOS)
            wall.alpha_composite(f, ((i % cols) * size + 6, (i // cols) * size + 6))
        wall = wall.rotate(-14, expand=True, resample=Image.BILINEAR)
        wall.putalpha(wall.getchannel('A').point(lambda v: int(v * 0.32)))
        _wall = wall
    return _wall


def count_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    col = TIER.get(s.get('tier') or (s.get('b') or {}).get('tier', 'S'), TIER['S'])
    if k in ('c_intro', 'c_outro'): col = (255, 170, 40)
    if k == 'c_tease': col = (40, 40, 80)
    canvas = background(t, col).convert('RGBA')
    if k == 'c_intro':
        canvas.alpha_composite(count_wall(), (int(-300 - (t * 60) % 170), int(-200 - (t * 90) % 170)))
        word_size = min(200, int(200 * 7 / max(7, len(WORD))))  # BRAWLER fits at 200, the original's size
        for w_, at, gold, y, size in (('EVERY', 0, False, 360, 200), (WORD, 1, False, 560, word_size), ('RANKED', 2, True, 790, 250)):
            slam(canvas, w_, size, WHITE, W / 2, y, bt - at, gold=gold, k=1.4)
        shake, flash = hits(bt, (0, 1, 2), 0.8, 0.4)
        if bt >= 3:
            u = bt - 3
            put(canvas, text_sprite('WORST', 110, (255, 90, 100)), W / 2 - 230 - 300 * (1 - out_back(u / 0.5)), 1040)
            put(canvas, text_sprite('BEST', 110, (90, 230, 140)), W / 2 + 250 + 300 * (1 - out_back(u / 0.5)), 1040)
            put(canvas, text_sprite('>', 120, WHITE), W / 2 + 10, 1040, scale=out_back(u / 0.5))
        if bt >= 4:
            put(canvas, text_sprite(f"THIS WEEK IN RANKED · SEASON {data.get('season')}", 56, GOLD_TOP, stroke=7), W / 2, 1210,
                scale=out_back((bt - 4) / 0.4))
        if bt >= 4.5:
            put(canvas, text_sprite('wait for #1...', 92, WHITE), W / 2, 1380, alpha=0.65 + 0.35 * math.sin(t * 14),
                scale=out_back((bt - 4.5) / 0.4))
        mark = False
    elif k == 'c_slam':
        label = s.get('label') or f"{s['tier']} TIER"
        put_rays(canvas, col, t, W / 2, 860, speed=30, alpha=0.7)
        big = s['tier'] if not s.get('label') else label.split()[-1]
        put(canvas, text_sprite(big, 520 if not s.get('label') else 380, col), W / 2, 820, scale=1 + 2.2 * (1 - out_back(bt / 0.6, 1.0)))
        put(canvas, text_sprite(label, 110, WHITE), W / 2, 1180, scale=out_back((bt - 0.15) / 0.5))
        shake = impact(lt, 1.3); flash = impact(lt) * 0.7
    elif k == 'c_page':
        items = s['items']; n = len(items)
        put(canvas, text_sprite(f"{s['tier']} TIER", 86, col), W / 2, 330)
        for j, (rank, b) in enumerate(items):
            r_, c_ = divmod(j, 3)
            in_row = min(3, n - r_ * 3)
            x = W / 2 + (c_ - (in_row - 1) / 2) * 320; y = 700 + r_ * 400
            u = (lt - j * 0.075) / 0.32
            if u <= 0: continue
            dy = 260 * (1 - out_cubic(u))
            put(canvas, card(rank, b), x, y + dy, scale=out_back(u, 2.2), rot=(1 - out_cubic(u)) * (12 if c_ == 0 else -12 if c_ == 2 else 0))
        shake = impact(lt, 0.25)
    elif k == 'c_rows':
        put(canvas, text_sprite(s['label'], 86, GOLD_TOP), W / 2, 330)
        for j, (rank, b) in enumerate(s['items']):
            u = (lt - j * 0.11) / 0.35
            if u <= 0: continue
            put(canvas, count_row(rank, b), W / 2 + 900 * (1 - out_back(u, 1.4)), 500 + j * 238)
    elif k == 'c_tease':
        b = s['b']; pulse = 1 + 0.06 * max(0.0, 1 - (bt % 1) / 0.35)
        put(canvas, text_sprite('AND THE BEST', 130, WHITE), W / 2, 420, scale=pulse)
        put(canvas, text_sprite(f'{WORD} IS...', min(130, int(130 * 12 / max(12, len(WORD) + 6))), GOLD_TOP), W / 2, 580, scale=pulse)
        sil = silhouette(art(b, 900, 1000), (255, 200, 60))
        put(canvas, sil, W / 2, 1300, scale=pulse)
        shake = impact((bt % 1) * P, 0.35)
    elif k in ('c_big', 'c_one'):
        b = s['b']; one = k == 'c_one'; heavy = s.get('heavy') or one
        tcol = TIER[b['tier']]
        put_rays(canvas, tcol, t, W / 2, 1050, speed=40 if one else 18, alpha=0.9 if heavy else 0.6)
        u = lt / 0.4
        put(canvas, art(b, 980 if one else 900, 1000), W / 2, 1060 if one else 1000,
            scale=1 + 0.5 * (1 - out_back(u, 1.6)) + 0.03 * (lt / (s['len'] * tl.step)))
        if one:
            put(canvas, crown(260), W / 2, 470 + 18 * math.sin(t * 5), scale=out_back((lt - 0.2) / 0.4))
            put(canvas, text_sprite('#1', 230, gold=True), 230, 540, scale=out_back(u))
            put(canvas, text_sprite(BEST_LINE, 84 if len(BEST_LINE) <= 20 else 70, GOLD_TOP), W / 2, 330, scale=out_back((lt - 0.1) / 0.4))
            confetti(canvas, lt)
        else:
            put(canvas, text_sprite(f"#{s['rank']}", 240, gold=True), 250 - 500 * (1 - out_back(u, 1.2)), 420)
            put(canvas, tier_pill(b['tier']), W - 250 + 500 * (1 - out_back((lt - 0.08) / 0.4, 1.2)), 420)
        put(canvas, text_sprite(nice(b['n']).upper(), 170 if len(b['n']) <= 7 else 140 if len(b['n']) <= 10 else 110, WHITE),
            W / 2, 1520, scale=out_back((lt - 0.1) / 0.4, 1.5))
        shake = impact(lt, 1.6 if heavy else 0.9); flash = impact(lt) * (0.9 if one else 0.6 if heavy else 0.35)
    else:  # c_outro: the question that made the original's comments
        mark = False
        bounce = abs(math.sin(bt * math.pi)) * 26
        put(canvas, text_sprite("WHERE'S YOUR", 120, WHITE), W / 2, 460 - bounce * 0.4, scale=out_back(bt / 0.6))
        put(canvas, text_sprite('MAIN?', 300, gold=True), W / 2, 700 - bounce, scale=out_back((bt - 0.3) / 0.6))
        put(canvas, text_sprite('COMMENT BELOW', 96, WHITE), W / 2, 990, scale=out_back((bt - 1) / 0.5))
        if bt > 1.3: arrow(canvas, W / 2, 1210 + abs(math.sin(t * 6)) * 40)
        follow_cta(canvas, bt - 2.2, 1500, 'NEW RANKING EVERY WEEK')
        shake, flash = hits(bt, (0, 0.3, 1), 0.7, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ stop
# "STOP picking these brawlers" (2026-10-24, by hand in ~/shots/viral2/stop.py):
# the five most-picked brawlers that win least, then the five least-picked
# that win most, from the week's Ranked games. Made to be argued with.
RED, GREEN = (255, 55, 75), (50, 225, 120)

if KIND == 'stop':
    a = [b for b in data['all'] if b['wr'] and b['use']]
    by_use = sorted(a, key=lambda b: -b['use'])
    use_rank = {b['id']: i + 1 for i, b in enumerate(by_use)}
    uses = sorted(b['use'] for b in a)
    q75 = uses[int(len(uses) * 0.75)]; med = uses[len(uses) // 2]
    # Overrated has to mean it: below 50% even though everyone picks them.
    over = [b for b in sorted((b for b in a if b['use'] >= q75), key=lambda b: b['wr']) if b['wr'] < 0.5][:5][::-1]
    gems = [b for b in sorted((b for b in a if b['use'] <= med), key=lambda b: -b['wr']) if b['wr'] > 0.5][:5][::-1]
    if len(over) < 3 or len(gems) < 3:
        print('not enough overrated or hidden brawlers this week'); sys.exit(3)
    TOTAL = len(a)
    tl.add(6, 's_intro')
    for i, b in enumerate(over): tl.add(3, 's_over', b=b, n=len(over) - i)
    tl.add(3, 's_switch')
    for i, b in enumerate(gems): tl.add(3, 's_gem', b=b, n=len(gems) - i)
    tl.add(7, 's_outro')
    worst, best = nice(over[-1]['n']), nice(gems[-1]['n'])
    META = {
        'title': 'STOP picking these brawlers 🛑 #Shorts',
        'titles': {'pt-BR': 'PARE de escolher esses brawlers 🛑 #Shorts', 'es-419': 'DEJA de elegir estos brawlers 🛑 #Shorts'},
        'description': f"Everyone picks them, and they lose: this week's most overrated brawlers in Ranked (worst: {worst}, "
                       f"{over[-1]['wr'] * 100:.1f}% wins), and the hidden gems almost nobody picks (best: {best}, "
                       f"{gems[-1]['wr'] * 100:.1f}%). Agree? Defend your main in the comments 👇\n\n"
                       f'The full hidden meta: https://brawlzone.net/hidden-meta{FOOTER}\n'
                       '#brawlstars #brawlstarsranked #brawlstarstips #overrated #brawlzone',
    }


_stamps = {}
def stamp(label, col):
    if label not in _stamps:
        txt = text_sprite(label, 120, col, stroke=8)
        w, h = txt.width + 70, txt.height + 50
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((4, 4, w - 5, h - 5), 30, outline=col, width=14)
        im.alpha_composite(txt, ((w - txt.width) // 2, (h - txt.height) // 2 + 4))
        _stamps[label] = im.rotate(-12, expand=True, resample=Image.BICUBIC)
    return _stamps[label]


def stop_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    col = {'s_intro': RED, 's_over': RED, 's_switch': GREEN, 's_gem': GREEN, 's_outro': (255, 170, 40)}[k]
    canvas = background(t, col).convert('RGBA')
    if k == 's_intro':
        slam(canvas, 'STOP', 300, RED, W / 2, 430, bt)
        slam(canvas, 'PICKING', 190, WHITE, W / 2, 680, bt - 1)
        slam(canvas, 'THESE BRAWLERS', 120, WHITE, W / 2, 880, bt - 2)
        shake, flash = hits(bt, (0, 1, 2), 1.0, 0.4)
        for i, b in enumerate(over[::-1]):
            u = bt - 3 - i * 0.5
            if u < 0: continue
            x = W / 2 + (i - (len(over) - 1) / 2) * 190
            put(canvas, card(use_rank[b['id']], b, 160, 190), x, 1230, scale=out_back(u / 0.3))
            if u > 0.25: put(canvas, text_sprite('X', 170, RED, stroke=10), x, 1220, scale=1 + 1.2 * (1 - out_back((u - 0.25) / 0.3, 1.0)))
        if bt > 4.6:
            put(canvas, text_sprite('everyone plays them. they LOSE.', 58, (255, 200, 205), stroke=6), W / 2, 1480, scale=out_back((bt - 4.6) / 0.4))
    elif k in ('s_over', 's_gem'):
        b = s['b']; good = k == 's_gem'; c = GREEN if good else RED
        put_rays(canvas, c, t, W / 2, 1000, speed=16 if good else -16, alpha=0.75)
        u = lt / 0.4
        put(canvas, art(b, 860, 900), W / 2, 1000, scale=1 + 0.45 * (1 - out_back(u, 1.6)) + 0.03 * bt)
        put(canvas, text_sprite(f"#{s['n']}", 200, gold=True), 190 - 400 * (1 - out_back(u, 1.2)), 400)
        r = use_rank[b['id']]
        put(canvas, pill(f'#{r} MOST PICKED' if not good else f'#{r} OF {TOTAL} IN PICKS', (40, 50, 110), size=54),
            W - 300 + 600 * (1 - out_back((lt - 0.1) / 0.4, 1.2)), 400)
        put(canvas, text_sprite(nice(b['n']).upper(), 160 if len(b['n']) <= 8 else 120, WHITE), W / 2, 1490, scale=out_back((lt - 0.1) / 0.4, 1.5))
        if bt >= 0.9:
            v = 50 + (b['wr'] * 100 - 50) * out_cubic((bt - 0.9) / 0.8)
            put(canvas, text_sprite(('WINS ' if good else 'WINS ONLY ') + f'{v:.1f}%', 100, c, stroke=9), W / 2, 1650, scale=out_back((bt - 0.9) / 0.3))
        if bt >= 1.9:
            uu = (bt - 1.9) / 0.35
            put(canvas, stamp('HIDDEN GEM' if good else 'OVERRATED', c), W / 2 + 40, 1190, scale=1 + 1.6 * (1 - out_back(uu, 1.0)))
            if uu < 1.2: shake = max(shake, impact((bt - 1.9) * tl.step, 1.3)); flash = max(flash, impact((bt - 1.9) * tl.step) * 0.35)
        shake = max(shake, impact(lt, 0.8)); flash = max(flash, impact(lt) * 0.25)
    elif k == 's_switch':
        put_rays(canvas, GREEN, t, W / 2, 900, speed=40, alpha=0.8)
        slam(canvas, 'PICK THESE', 190, WHITE, W / 2, 760, bt)
        slam(canvas, 'INSTEAD', 260, GREEN, W / 2, 1010, bt - 1)
        if bt > 1.8:
            put(canvas, text_sprite('nobody picks them. they WIN.', 58, (200, 255, 215), stroke=6), W / 2, 1250, scale=out_back((bt - 1.8) / 0.4))
        shake, flash = hits(bt, (0, 1), 1.2, 0.5)
    else:  # s_outro
        mark = False
        bounce = abs(math.sin(bt * math.pi)) * 26
        put(canvas, text_sprite('AGREE?', 280, gold=True), W / 2, 520 - bounce, scale=out_back(bt / 0.6))
        put(canvas, text_sprite('DEFEND YOUR MAIN', 104, WHITE), W / 2, 780, scale=out_back((bt - 0.6) / 0.5))
        put(canvas, text_sprite('IN THE COMMENTS', 104, WHITE), W / 2, 910, scale=out_back((bt - 0.9) / 0.5))
        if bt > 1.4: arrow(canvas, W / 2, 1130 + abs(math.sin(t * 6)) * 40)
        follow_cta(canvas, bt - 2.2, 1460, 'THE HIDDEN META: BRAWLZONE.NET')
        shake, flash = hits(bt, (0, 0.6, 0.9), 0.7, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ render
SCENE = {'quiz': quiz_scene, 'broken': broken_scene, 'ranks': ranks_scene, 'modes': modes_scene,
         'newbrawler': nb_scene, 'daily': daily_scene, 'everyrank': count_scene, 'classrank': count_scene,
         'stop': stop_scene}[KIND]


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
