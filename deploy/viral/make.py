"""The daily viral Short (2026-10-22): one of four formats, drawn frame by frame.

    python make.py <kind> <data.json> <prev.json|-> <state.json> <out dir> [--only SECONDS ...]

kind     quiz    "Guess the brawler #N": five rounds, medium to expert, each a
                 shadow, a pixelated model or an extreme zoom, 3-2-1, reveal.
         shadowquiz / zoomquiz  the quiz with one kind of clue throughout
                 (2026-10-28): "Guess the brawler by its SHADOW #N" and "from
                 this ZOOM #N", their own episode numbers, the same answer
                 history as the quiz so no brawler repeats across the three.
         giveaway  the weekly giveaway reminder (2026-10-28, Fridays at 14:00
                 until it closes): the prize, the days left, how to enter.
                 Never asks for a subscription: YouTube counts rewarded
                 subscriptions as fake engagement. Exits 3 once it has closed.
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
         seasonclimb  the countdown's top 10 on the day a Ranked season
                 starts ("the 10 best brawlers to climb", 2026-11-03).
         stop    "STOP picking these brawlers": the most-picked that lose,
                 then the least-picked that win.
         drops   "1,000 Chaos Drops with the real drop rates" (2026-10-29): what
                 a thousand give, rolled from the wiki's tables in data['drops'],
                 seeded by date. Exits 3 without the table or the drop's art.
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
                    confetti, crown, finish, follow_cta, grey, hits, impact, has_art, has_model, load_face, load_model, nice, out_back,
                    out_cubic, pill, put, put_rays, rounded_mask, silhouette, slam, text_sprite, tier_pill, vgrad,
                    put_panel, ribbon, burst, timer_bar, count_badge, search_cta, panel, shade, mixc, INK)

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
PACING = {'quiz': {'pace': 2}, 'shadowquiz': {'pace': 2}, 'zoomquiz': {'pace': 2}, 'skinquiz': {'pace': 2}, 'iconquiz': {'pace': 2},
          'daily': {'pace': 2}, 'everyrank': {'hold': 1.2}, 'seasonclimb': {'hold': 1.2}}
tl = Timeline(**PACING.get(KIND, {'hold': 1.5}))
FOOTER = '\nUnofficial fan project, not affiliated with Supercell.'


def more_titles(**titles):
    """YouTube titles in Indonesian, German, Turkish and Polish (2026-11-04):
    after English, the people who look the site up come most from Indonesia,
    the Philippines, Germany, Turkey and Poland (Search Console, 4 weeks), and
    YouTube shows each viewer the title in their own language. Keyed by
    YouTube's language codes, beside the pt-BR and es-419 every format has."""
    return {k: v for k, v in titles.items() if v}

# Under the follow button of every ranking video (2026-11-03, owner): the
# videos are what send people to the site, and the site is where the ads are.
# The quizzes (2026-11-04) point at the site's own daily puzzle instead.
def site_cta(canvas, u, y, lead='FULL TIER LIST'):
    follow_cta(canvas, u, y, lead, sub='BRAWLZONE.NET')


def episode(kind):
    return int(state.get('episodes', {}).get(kind, 0)) + 1


SHOWN = []
def fresh_or_exit(keys, repeat=0.6):
    """Exit 3 when a weekly format would mostly repeat its last episode.

    YouTube stops showing a Short that looks like one the channel already
    posted: the daily counter, map-pick and teaser templates fell from ~1,000
    views to ~20, and the 3 Nov "STOP picking these brawlers", 8 of whose 10
    brawlers were the 27 Oct one's, got 3 views to its predecessor's 1,182.
    So these formats remember what they showed (meta.json `shown`, kept in
    state.json by brawlzone-viral after posting) and step aside when 60% of it
    would come back; the job then draws something else (2026-11-04)."""
    global SHOWN
    SHOWN = [str(k) for k in keys]
    last = set(state.get('last_shown', {}).get(KIND, []))
    same = sum(1 for k in SHOWN if k in last)
    if SHOWN and same >= repeat * len(SHOWN):
        print(f'too close to the last {KIND}: {same} of {len(SHOWN)} repeat'); sys.exit(3)


def pct(x, sign=False):
    return f"{'+' if sign and x >= 0 else ''}{x * 100:.1f}%"


# ================================================================ quiz
EASY, MEDIUM, HARD, EXPERT = (60, 210, 110), (255, 180, 40), (255, 60, 90), (190, 70, 255)
CLUES = {'shadow': 'WHO IS THIS?', 'pixel': 'WHO IS THIS?', 'zoom': 'ZOOMED IN: WHO?', 'skin': 'WHOSE SKIN IS THIS?'}
# The quiz is the channel's best format (2026-10-28: 1,676 views in a day
# against ~900 for the rest), so it runs daily; the themed episodes give it
# a new title hook on the days between the mixed ones.
QUIZ_STYLE = {'quiz': None, 'shadowquiz': 'shadow', 'zoomquiz': 'zoom', 'skinquiz': 'skin', 'iconquiz': 'icon'}
# The skin quiz (2026-11-02): each brawler in one of its skins, from the Fan
# Kit renders -- in plain sight at MEDIUM, pixelated at HARD, zoomed in at
# EXPERT. Not the true gold and silver ones, which are the default in a colour.
SKIN_CLUE = {'MEDIUM': 'skin', 'HARD': 'pixel', 'EXPERT': 'zoom'}
SKIN_SKIP = {'truegold', 'truesilver', 'classic'}
# The ability quiz (2026-11-02): one of the brawler's ability icons from the
# Fan Kit -- a gadget or star power at MEDIUM, the hypercharge at HARD, and at
# EXPERT a gadget or star power pixelated, sharper each beat.
ICON_LABEL = {'gadget': 'GADGET', 'starPower': 'STAR POWER', 'hyperCharge': 'HYPERCHARGE'}
ICON_COL = {'gadget': (60, 200, 110), 'starPower': (255, 190, 40), 'hyperCharge': (255, 80, 200)}
ICON_PIXELS = (5, 8, 12, 18)
ASSET_DIR = os.environ.get('ASSETS', '.')


def skin_model(bid, key, src):
    """The skin's Fan Kit render, trimmed, cached as models/<id>.png; fetched
    here, on the day, because only five of a thousand are needed.

    Both PARTs get here at the same moment and draw alternate frames, so they
    must end up with the same picture. Until 2026-11-13 each wrote to
    <path>.<pid>.png, and the pid is the same in both containers: one part's
    rename failed, it drew the brawler's default look with a pixel clue, and
    the skin quizzes flickered frame by frame between the two versions (the
    skin in plain sight mid-round, clues that did not match the reveal). Now
    one part downloads under a lock while the other waits for it, and a
    download that fails leaves a marker the other part obeys."""
    import fcntl, time, uuid
    sid = f'skin_{bid}_{key}'
    path = f'{ASSET_DIR}/models/{sid}.png'
    failed = f'{path}.failed'
    with open(f'{ASSET_DIR}/models/.skin.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if os.path.exists(path):
            return sid
        if os.path.exists(failed) and time.time() - os.path.getmtime(failed) < 3600:
            raise RuntimeError('the other part could not download it')
        try:
            import io, urllib.request
            url = f"{src['url']}?width={min(src['w'], 2400)}"
            body = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'BrawlZone (https://brawlzone.net)'}), timeout=60).read()
            img = Image.open(io.BytesIO(body)).convert('RGBA')
            img = img.crop(img.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox())
            img.thumbnail((2000, 2000), Image.LANCZOS)
            tmp = f'{path}.{uuid.uuid4().hex}.png'
            img.save(tmp); os.replace(tmp, path)
        except Exception:
            open(failed, 'w').close()
            raise
    return sid


_icons = {}
def ability_icon(a, size=620):
    """An ability's Fan Kit icon, cached by brawlzone-viral in abilities/."""
    if a['file'] not in _icons:
        im = Image.open(f"{ASSET_DIR}/{a['file']}").convert('RGBA')
        sc = size / max(im.size)
        _icons[a['file']] = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
    return _icons[a['file']]
# Harder from 2026-10-30, when the owner called the quizzes "really easy":
# no EASY round, an EXPERT one last, rarer brawlers, and every clue tighter
# per level. Harder again from 2026-11-02 ("people are getting everything"):
# two EXPERT rounds, no popular pick, and every clue tighter still -- the
# Fan Kit's large renders keep a deep zoom sharp. Where the zoom starts and
# how far it pulls back per beat:
ZOOM_FROM = {'MEDIUM': 5.6, 'HARD': 6.8, 'EXPERT': 8.2}
ZOOM_PULL = 0.4
# Pixel blocks across on each beat (was 7, 10, 14, 22 for every round).
PIXEL_STEPS = {'MEDIUM': (4, 6, 9, 12), 'HARD': (3, 5, 7, 10), 'EXPERT': (3, 4, 6, 8)}
# How much of the shadow shows, from the top: MEDIUM loses the feet, HARD
# the legs, EXPERT is head and shoulders, mirrored.
SHADOW_KEEP = {'MEDIUM': 0.8, 'HARD': 0.62, 'EXPERT': 0.52}

if KIND in QUIZ_STYLE:
    STYLE = QUIZ_STYLE[KIND]
    N = episode(KIND)
    recent = set(state.get('quiz_recent', [])[-45:])
    if KIND == 'skinquiz':
        try:
            SKINS = json.load(open(f'{ASSET_DIR}/skins/sources.json'))
        except (OSError, ValueError):
            print('no skin list'); sys.exit(3)
        by_brawler = {}
        for key, src in SKINS.items():
            bid, variant = key.split('|')
            if variant not in SKIN_SKIP:
                by_brawler.setdefault(int(bid), []).append((variant, src))
        eligible = lambda b: b['id'] in by_brawler
    elif KIND == 'iconquiz':
        try:
            ABILITIES = json.load(open(f'{ASSET_DIR}/abilities/index.json'))
        except (OSError, ValueError):
            print('no ability list'); sys.exit(3)
        by_brawler = {}
        for a in ABILITIES:
            if os.path.exists(f"{ASSET_DIR}/{a['file']}"):
                by_brawler.setdefault(a['bid'], []).append(a)
        eligible = lambda b: any(a['kind'] != 'hyperCharge' for a in by_brawler.get(b['id'], []))
    else:
        eligible = lambda b: True
    pool = sorted((b for b in data['all'] if has_model(b) and eligible(b) and b['id'] not in recent),
                  key=lambda b: -(b['use'] or 0))
    if len(pool) < 15:  # the history ate the roster: start over
        pool = sorted((b for b in data['all'] if has_model(b) and eligible(b)), key=lambda b: -(b['use'] or 0))
    third = len(pool) // 3
    # Two from the middle, three rarely played (a popular one was a free point).
    picks = rnd.sample(pool[third:2 * third], 2) + rnd.sample(pool[2 * third:], 3)
    levels = ['MEDIUM', 'HARD', 'HARD', 'EXPERT', 'EXPERT']
    # The intro's sliding shadows were the five answers -- a free look at
    # every one before round 1. Five others now.
    chosen = {b['id'] for b in picks}
    decoys = rnd.sample([b for b in data['all'] if b['id'] not in chosen and has_model(b)], 5)
    rounds = list(picks)  # what each round shows; the answers stay `picks`
    if KIND == 'skinquiz':
        clues = [SKIN_CLUE[l] for l in levels]
        for j, b in enumerate(picks):
            variant, src = rnd.choice(sorted(by_brawler[b['id']]))
            try:
                rounds[j] = {**b, 'id': skin_model(b['id'], variant, src), 'skin': src['name'].upper()}
            except Exception as e:  # a skin that will not download: the brawler as it is
                print(f"no skin {variant} for {b['n']}: {e}")
                clues[j] = 'pixel'
    elif KIND == 'iconquiz':
        clues = ['icon'] * 5
        for j, (b, lvl) in enumerate(zip(picks, levels)):
            mine = by_brawler[b['id']]
            hc = [a for a in mine if a['kind'] == 'hyperCharge']
            other = [a for a in mine if a['kind'] != 'hyperCharge']
            a = rnd.choice(hc) if lvl == 'HARD' and hc else rnd.choice(other)
            rounds[j] = {**b, 'ability': a, 'pixelate': lvl == 'EXPERT' and a['kind'] != 'hyperCharge'}
    elif STYLE:
        clues = [STYLE] * 5
    else:
        clues = ['shadow', 'pixel', 'zoom'] + rnd.sample(['shadow', 'pixel', 'zoom'], 2)
        rnd.shuffle(clues)
    tl.add(4, 'q_intro', n=N, faces=decoys, style=STYLE)
    for i, (b, lvl, clue) in enumerate(zip(rounds, levels, clues)):
        tl.add(6, 'q', b=b, i=i, lvl=lvl, clue=clue, style=STYLE)
    tl.add(8, 'q_outro', n=N, picks=picks)
    names = ', '.join(nice(b['n']) for b in picks)
if KIND == 'quiz':
    META = {
        'title': f'Guess the brawler #{N} 👀 Only real fans get 5/5',
        'titles': {'pt-BR': f'Adivinhe o brawler #{N} 👀 Só fãs de verdade acertam 5/5', 'es-419': f'Adivina el brawler #{N} 👀 Solo los verdaderos fans aciertan 5/5',
                   **more_titles(id=f'Tebak brawler-nya #{N} 👀 Cuma fans sejati yang dapat 5/5',
                                 de=f'Errate den Brawler #{N} 👀 Nur echte Fans schaffen 5/5',
                                 tr=f"Brawler'ı tahmin et #{N} 👀 Sadece gerçek hayranlar 5/5 yapar",
                                 pl=f'Zgadnij brawlera #{N} 👀 Tylko prawdziwi fani mają 5/5')},
        'description': f'Guess the brawler #{N}: 5 rounds, medium to expert. Shadows, pixels and zoom-ins. '
                       f'How many did you get? Comment your score 👇 New quiz every day.\n\n'
                       f'3 more to guess today (shadow, zoom, clues): https://brawlzone.net/daily-challenge{FOOTER}\n'
                       '#brawlstars #brawlstarsquiz #guessthebrawler #brawlstarsgame #brawlzone',
        'used': [b['id'] for b in picks],
        'answers': names,
    }
elif KIND == 'skinquiz':
    META = {
        'title': f'Guess the brawler by its SKIN #{N} 👀 Only real fans get 5/5',
        'titles': {'pt-BR': f'Adivinhe o brawler pela SKIN #{N} 👀 Só fãs de verdade acertam 5/5', 'es-419': f'Adivina el brawler por su SKIN #{N} 👀 Solo los verdaderos fans aciertan 5/5',
                   **more_titles(id=f'Tebak brawler dari SKIN-nya #{N} 👀 Cuma fans sejati yang dapat 5/5',
                                 de=f'Errate den Brawler am SKIN #{N} 👀 Nur echte Fans schaffen 5/5',
                                 tr=f"Brawler'ı SKIN'inden tahmin et #{N} 👀 Sadece gerçek hayranlar 5/5 yapar",
                                 pl=f'Zgadnij brawlera po SKINIE #{N} 👀 Tylko prawdziwi fani mają 5/5')},
        'description': f'Guess the brawler by its skin #{N}: 5 rounds, medium to expert, in skins from the Brawl Stars Fan Kit. '
                       f'How many did you get? Comment your score 👇 New quiz every day.\n\n'
                       f"Today's puzzles on the site: https://brawlzone.net/daily-challenge{FOOTER}\n"
                       '#brawlstars #brawlstarsquiz #guessthebrawler #brawlstarsskins #brawlzone',
        'used': [b['id'] for b in picks],
        'answers': names,
    }
elif KIND == 'iconquiz':
    META = {
        'title': f'Guess the brawler from its GADGET #{N} 🧩 Only real fans get 5/5',
        'titles': {'pt-BR': f'Adivinhe o brawler pelo GADGET #{N} 🧩 Só fãs de verdade acertam 5/5', 'es-419': f'Adivina el brawler por su GADGET #{N} 🧩 Solo los verdaderos fans aciertan 5/5',
                   **more_titles(id=f'Tebak brawler dari GADGET-nya #{N} 🧩 Cuma fans sejati yang dapat 5/5',
                                 de=f'Errate den Brawler am GADGET #{N} 🧩 Nur echte Fans schaffen 5/5',
                                 tr=f"Brawler'ı GADGET'ından tahmin et #{N} 🧩 Sadece gerçek hayranlar 5/5 yapar",
                                 pl=f'Zgadnij brawlera po GADŻECIE #{N} 🧩 Tylko prawdziwi fani mają 5/5')},
        'description': f'Guess the brawler from its gadget, star power or hypercharge #{N}: 5 rounds, medium to expert. '
                       f'How many did you get? Comment your score 👇 New quiz every day.\n\n'
                       f"Today's puzzles on the site: https://brawlzone.net/daily-challenge{FOOTER}\n"
                       '#brawlstars #brawlstarsquiz #guessthebrawler #brawlstarsgadgets #brawlzone',
        'used': [b['id'] for b in picks],
        'answers': names,
    }
elif KIND == 'shadowquiz':
    META = {
        'title': f'Guess the brawler by its SHADOW #{N} 👤 Only real fans get 5/5',
        'titles': {'pt-BR': f'Adivinhe o brawler pela SOMBRA #{N} 👤 Só fãs de verdade acertam 5/5', 'es-419': f'Adivina el brawler por su SOMBRA #{N} 👤 Solo los verdaderos fans aciertan 5/5',
                   **more_titles(id=f'Tebak brawler dari BAYANGAN-nya #{N} 👤 Cuma fans sejati yang dapat 5/5',
                                 de=f'Errate den Brawler am SCHATTEN #{N} 👤 Nur echte Fans schaffen 5/5',
                                 tr=f"Brawler'ı GÖLGESİNDEN tahmin et #{N} 👤 Sadece gerçek hayranlar 5/5 yapar",
                                 pl=f'Zgadnij brawlera po CIENIU #{N} 👤 Tylko prawdziwi fani mają 5/5')},
        'description': f'Guess the brawler by its shadow #{N}: 5 silhouettes, medium to expert. '
                       f'How many did you get? Comment your score 👇 New quiz every day.\n\n'
                       f"Today's shadow puzzle on the site: https://brawlzone.net/daily-challenge{FOOTER}\n"
                       '#brawlstars #brawlstarsquiz #guessthebrawler #brawlstarsgame #brawlzone',
        'used': [b['id'] for b in picks],
        'answers': names,
    }
elif KIND == 'zoomquiz':
    META = {
        'title': f'Guess the brawler from this ZOOM #{N} 🔍 Only real fans get 5/5',
        'titles': {'pt-BR': f'Adivinhe o brawler pelo ZOOM #{N} 🔍 Só fãs de verdade acertam 5/5', 'es-419': f'Adivina el brawler por el ZOOM #{N} 🔍 Solo los verdaderos fans aciertan 5/5',
                   **more_titles(id=f'Tebak brawler dari ZOOM ini #{N} 🔍 Cuma fans sejati yang dapat 5/5',
                                 de=f'Errate den Brawler im ZOOM #{N} 🔍 Nur echte Fans schaffen 5/5',
                                 tr=f"Bu ZOOM'dan brawler'ı tahmin et #{N} 🔍 Sadece gerçek hayranlar 5/5 yapar",
                                 pl=f'Zgadnij brawlera z tego ZBLIŻENIA #{N} 🔍 Tylko prawdziwi fani mają 5/5')},
        'description': f'Guess the brawler from an extreme zoom #{N}: 5 rounds, medium to expert. '
                       f'How many did you get? Comment your score 👇 New quiz every day.\n\n'
                       f"Today's zoom puzzle on the site: https://brawlzone.net/daily-challenge{FOOTER}\n"
                       '#brawlstars #brawlstarsquiz #guessthebrawler #brawlstarsgame #brawlzone',
        'used': [b['id'] for b in picks],
        'answers': names,
    }


HI_ZOOM = 2.4
_zoom_at = {}
def zoom_center(b, m, lvl):
    """Where to zoom: the head for MEDIUM; for HARD and EXPERT a spot on the
    body (seeded by brawler, so every frame agrees) that is mostly model
    rather than background."""
    key = (b['id'], lvl)
    if key not in _zoom_at:
        alpha = m.getchannel('A')
        a = alpha.getbbox() or (0, 0, m.width, m.height)
        at = ((a[0] + a[2]) / 2, a[1] + (a[3] - a[1]) * 0.22)
        if lvl in ('HARD', 'EXPERT'):
            pick = random.Random(f"{b['id']}/{lvl}")
            side = 760 / ZOOM_FROM[lvl]
            for _ in range(40):
                x = a[0] + (a[2] - a[0]) * pick.uniform(0.25, 0.75)
                y = a[1] + (a[3] - a[1]) * pick.uniform(0.3, 0.75)
                box = tuple(int(v) for v in (x - side / 2, y - side / 2, x + side / 2, y + side / 2))
                hist = alpha.crop(box).histogram()
                if sum(hist[128:]) > 0.7 * sum(hist):
                    at = (x, y)
                    break
        _zoom_at[key] = at
    return _zoom_at[key]


def fit_in(img, side):
    k = min(1.0, side / max(img.size))
    return img if k == 1.0 else img.resize((int(img.width * k), int(img.height * k)), Image.LANCZOS)


def zoom_view(b, z, lvl='MEDIUM', framed=True):
    """The model cropped at z times around zoom_center, inside a rounded window
    (framed), or bare and sized to the quiz card's inside (2026-11-13)."""
    m = art(b, 900)
    cx, cy = zoom_center(b, m, lvl)
    # Cropped from the body at 2.4x that size, so a deep zoom shows the Fan
    # Kit render's own detail instead of a blown-up 900px picture.
    hi = art(b, 900 * HI_ZOOM, 900 * HI_ZOOM)
    k = hi.width / m.width
    win = 760; side = win / z * k
    box = (cx * k - side / 2, cy * k - side / 2, cx * k + side / 2, cy * k + side / 2)
    crop = hi.crop(tuple(int(v) for v in box)).resize((win, win), Image.BILINEAR)
    if not framed:  # the same view, filling the card's 828px inside
        inner = Image.new('RGBA', (win, win), (30, 34, 80, 255)); inner.alpha_composite(crop)
        return inner.resize((828, 828), Image.BILINEAR)
    frame = Image.new('RGBA', (win + 24, win + 24), (0, 0, 0, 0)); d = ImageDraw.Draw(frame)
    d.rounded_rectangle((0, 0, win + 23, win + 23), 70, fill=(12, 14, 34, 255), outline=WHITE, width=10)
    inner = Image.new('RGBA', (win, win), (30, 34, 80, 255)); inner.alpha_composite(crop)
    frame.paste(inner, (12, 12), rounded_mask(win, win, 60))
    return frame


def pixelated(img, blocks):
    w = max(2, blocks); h = max(2, int(blocks * img.height / img.width))
    return img.resize((w, h), Image.BILINEAR).resize(img.size, Image.NEAREST)


_partial = {}
def partial_shadow(b, a, lvl):
    """The silhouette with only its top SHADOW_KEEP showing; EXPERT mirrored."""
    key = (b['id'], lvl)
    if key not in _partial:
        sil = silhouette(a, (200, 180, 255))
        keep = SHADOW_KEEP[lvl]
        if keep < 1:
            # The kept part, blown up to the full shadow's height so it fills
            # the frame rather than floating small at the top of it.
            box = sil.getchannel('A').getbbox() or (0, 0, sil.width, sil.height)
            bottom = int(box[1] + (box[3] - box[1]) * keep)
            part = sil.crop((box[0], box[1], box[2], bottom))
            k = min((box[3] - box[1]) * 0.85 / part.height, 900 / part.width)
            sil = part.resize((int(part.width * k), int(part.height * k)), Image.LANCZOS)
        if lvl == 'EXPERT':
            sil = sil.transpose(Image.FLIP_LEFT_RIGHT)
        _partial[key] = sil
    return _partial[key]


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
        if s.get('style') == 'shadow':
            slam(canvas, 'GUESS THE', 180, WHITE, W / 2, 560, bt)
            slam(canvas, 'SHADOW', 250, None, W / 2, 770, bt - 1, gold=True)
        elif s.get('style') == 'zoom':
            slam(canvas, 'ZOOMED IN', 190, WHITE, W / 2, 560, bt)
            slam(canvas, 'WHO IS IT?', 210, None, W / 2, 770, bt - 1, gold=True)
        elif s.get('style') == 'skin':
            slam(canvas, 'WHOSE SKIN', 190, WHITE, W / 2, 560, bt)
            slam(canvas, 'IS THIS?', 230, None, W / 2, 770, bt - 1, gold=True)
        elif s.get('style') == 'icon':
            slam(canvas, 'WHOSE GADGET', 150, WHITE, W / 2, 560, bt)
            slam(canvas, 'IS THIS?', 230, None, W / 2, 770, bt - 1, gold=True)
        else:
            slam(canvas, 'GUESS THE', 180, WHITE, W / 2, 560, bt)
            slam(canvas, 'BRAWLER', 250, None, W / 2, 770, bt - 1, gold=True)
        if bt > 2: put(canvas, pill(f"#{s['n']}", (255, 60, 100), size=90), W / 2, 990, scale=out_back((bt - 2) / 0.4, 2.2), rot=-6)
        if bt > 3: put(canvas, text_sprite('ONLY REAL FANS GET 5/5', 66, WHITE, stroke=7), W / 2, 1160, scale=out_back((bt - 3) / 0.4))
        shake, flash = hits(bt, (0, 1, 2, 3), 1.2, 0.5)
    elif k == 'q':
        # 2026-11-13 look: the clue inside a framed card with a timer bar
        # draining under it and the countdown on a badge at its top; at the
        # reveal the brawler breaks out of the card and the name lands on a
        # ribbon.
        b = s['b']; reveal = bt >= 4
        lcol = {'EASY': EASY, 'MEDIUM': MEDIUM, 'HARD': HARD, 'EXPERT': EXPERT}[s['lvl']]
        col = TIER.get(b.get('tier') or 'B', (150, 90, 255)) if reveal else (110, 80, 230)
        canvas = background(t, col).convert('RGBA')
        for j in range(5):  # progress: one dot per round, done ones gold, this one pulsing
            r = 22 if j != s['i'] else 22 + 6 * abs(math.sin(t * 6))
            d = ImageDraw.Draw(canvas); x = W / 2 + (j - 2) * 80
            d.ellipse((x - r, 330 - r, x + r, 330 + r), fill=GOLD_TOP if j < s['i'] or (j == s['i'] and reveal) else (60, 60, 110), outline=(10, 12, 28), width=5)
        put(canvas, text_sprite(f"#{s['i'] + 1}", 150, gold=True), 170, 450)
        put(canvas, pill(s['lvl'], lcol, size=56), W - 220, 450)
        a = art(b, 820)
        PX, PY, PW = W / 2, 960, 860
        if not reveal:
            put_rays(canvas, (160, 140, 255), t, PX, PY, speed=10, alpha=0.35)
            pop = 1 + 0.25 * (1 - out_back(bt / 0.5, 1.4))
            label = CLUES.get(s['clue'], 'WHO IS THIS?')
            if s.get('style') == 'skin':
                label = CLUES['skin']
            tab = None
            if s['clue'] == 'skin':
                content = fit_in(a, 780)
            elif s['clue'] == 'icon':
                ab = b['ability']; kind = ab['kind']
                content = ability_icon(ab)
                if b.get('pixelate'):
                    content = pixelated(content, ICON_PIXELS[min(3, int(bt))])
                tab = pill(ICON_LABEL[kind], ICON_COL[kind], size=60)
                label = f'WHOSE {ICON_LABEL[kind]}?'
            elif s['clue'] == 'shadow':
                content = fit_in(partial_shadow(b, a, s['lvl']), 800)
            elif s['clue'] == 'pixel':
                step = min(3, int(bt))  # sharper on every beat, never sharp
                content = pixelated(fit_in(a, 790), PIXEL_STEPS[s['lvl']][step])
            else:
                z = ZOOM_FROM[s['lvl']] - ZOOM_PULL * min(bt, 3.6)  # slowly pulling back
                content = zoom_view(b, z, s['lvl'], framed=False)
            put_panel(canvas, PW, PW, lcol, PX, PY, content, scale=pop, inner=(95, 135, 255))  # blue inside: clues read on it
            if tab is not None:
                put(canvas, tab, PX, PY + PW / 2 + 4, scale=out_back(bt / 0.4, 1.8))
            timer_bar(canvas, 1 - bt / 4, PX, PY + PW / 2 + (110 if tab is not None else 80))
            put(canvas, fit(label, 104, 1000, WHITE), W / 2, PY + PW / 2 + (215 if tab is not None else 190), scale=out_back(bt / 0.4))
            n = 4 - int(bt) if bt >= 1 else None; u = bt % 1
            put(canvas, count_badge(n if n else '?', (255, 70, 100) if n == 1 else (40, 44, 90)), PX, PY - PW / 2 - 6,
                scale=1 + 0.5 * (1 - out_back(u / 0.4, 1.3)) if n else out_back(bt / 0.4, 1.6))
            if n and u < 0.3: shake = max(shake, impact(u * P, 0.4))
            shake = max(shake, impact(lt, 0.8))
        else:
            u = bt - 4
            put_rays(canvas, col, t, PX, PY, speed=40, alpha=0.9)
            put_panel(canvas, PW, PW, col, PX, PY, None, lit=True)
            burst(canvas, u * P, PX, PY)
            put(canvas, art(b, 960, 1000), PX, PY - 40, scale=1 + 0.25 * (1 - out_back(u / 0.4, 1.6)))
            put(canvas, ribbon(nice(b['n']).upper(), col if col != (110, 80, 230) else (150, 90, 255), 140), W / 2, PY + PW / 2 + 90,
                scale=out_back(u / 0.35, 1.6))
            extra = (f"{b['skin']} SKIN" if b.get('skin') else
                     f"{ICON_LABEL[b['ability']['kind']]}: {b['ability']['name'].upper()}" if b.get('ability') and b['ability'].get('name') else None)
            if extra:
                put(canvas, fit(extra, 64, 980, GOLD_TOP, stroke=7), W / 2, PY + PW / 2 + 225, scale=out_back((u - 0.25) / 0.35, 1.6))
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
        site_cta(canvas, bt - 3.4, 1260, "PLAY TODAY'S PUZZLE")
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
    fresh_or_exit(r['id'] for r in up + down)
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
        'titles': {'pt-BR': 'Quem ficou QUEBRADO esta semana? 📈 Brawl Stars Ranqueado', 'es-419': '¿Quién está ROTO esta semana? 📈 Brawl Stars Competitivo',
                   **more_titles(id='Siapa yang BROKEN minggu ini? 📈 Brawl Stars Ranked',
                                 de='Wer ist diese Woche BROKEN? 📈 Brawl Stars Ranked',
                                 tr='Bu hafta kim OP oldu? 📈 Brawl Stars Ranked',
                                 pl='Kto jest OP w tym tygodniu? 📈 Brawl Stars Ranked')},
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
        site_cta(canvas, bt - 2.6, 1200)
        shake, flash = hits(bt, (0, 0.8, 2.6), 0.8, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ ranks
LOWC, LEGC = (70, 150, 255), (255, 175, 40)

if KIND == 'ranks':
    BR = data['brackets']
    low = BR['low']['top'][:5]; leg = BR['pro']['top'][:5]
    leg_ids = {b['id'] for b in BR['pro']['top']}
    fresh_or_exit([f"low:{b['id']}" for b in low] + [f"pro:{b['id']}" for b in leg])
    tl.add(4, 'p_intro')
    tl.add(6, 'p_list', side='low', items=low)
    tl.add(6, 'p_list', side='leg', items=leg)
    tl.add(5, 'p_reveal', low1=low[0], leg1=leg[0], missing=low[0]['id'] not in leg_ids)
    tl.add(7, 'p_outro')
    META = {
        'title': 'What you pick vs what MASTERS pick 😳',
        'titles': {'pt-BR': 'O que você escolhe vs o que os MESTRES escolhem 😳', 'es-419': 'Lo que tú eliges vs lo que eligen los MAESTROS 😳',
                   **more_titles(id='Pilihanmu vs pilihan pemain MASTERS 😳',
                                 de='Was du pickst vs was MASTERS picken 😳',
                                 tr="Senin seçtiğin vs MASTERS oyuncularının seçtiği 😳",
                                 pl='Co ty wybierasz vs co wybierają gracze MASTERS 😳')},
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
        site_cta(canvas, bt - 2.4, 1200)
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
    fresh_or_exit(f"{mk}:{b['id']}" for mk, b, _, _ in best)
    tl.add(5, 'm_intro', modes=[b[0] for b in best])
    seen = set()
    for mk, b, n_hits, maps in best:
        tl.add(4, 'm_mode', mode=mk, b=b, hits=n_hits, maps=maps, again=b['id'] in seen); seen.add(b['id'])
    tl.add(7, 'm_outro')
    META = {
        'title': 'The BEST brawler for EVERY mode 🏆',
        'titles': {'pt-BR': 'O MELHOR brawler para CADA modo 🏆', 'es-419': 'El MEJOR brawler para CADA modo 🏆',
                   **more_titles(id='Brawler TERBAIK untuk SETIAP mode 🏆',
                                 de='Der BESTE Brawler für JEDEN Modus 🏆',
                                 tr='HER mod için EN İYİ brawler 🏆',
                                 pl='NAJLEPSZY brawler do KAŻDEGO trybu 🏆')},
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
        site_cta(canvas, bt - 2.6, 1200)
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
                   'es-419': f"¿{R['name']} está roto? Tier {R['tier']} tras {R['battles']:,} partidas 😳",
                   **more_titles(id=f"Apakah {R['name']} broken? Tier {R['tier']} setelah {R['battles']:,} pertandingan 😳".replace(',', '.'),
                                 de=f"Ist {R['name']} broken? {R['tier']}-Tier nach {R['battles']:,} Matches 😳".replace(',', '.'),
                                 tr=f"{R['name']} OP mi? {R['battles']:,} maçtan sonra {R['tier']} tier 😳".replace(',', '.'),
                                 pl=f"Czy {R['name']} jest OP? Tier {R['tier']} po {R['battles']:,} meczach 😳".replace(',', ' '))},
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
        site_cta(canvas, bt - 2.6, 1320)
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
        search_cta(canvas, bt - 0.6, 540)
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
# The class countdown's group in the four extra title languages (more_titles);
# Polish carries its own "all", whose form depends on the noun.
GROUP_L10N = {
    'ASSASSIN': {'id': 'assassin', 'de': 'Assassinen', 'tr': 'suikastçılar', 'pl': 'Wszyscy asasyni'},
    'TANK': {'id': 'tank', 'de': 'Tanks', 'tr': 'tanklar', 'pl': 'Wszystkie tanki'},
    'SNIPER': {'id': 'sniper', 'de': 'Scharfschützen', 'tr': 'keskin nişancılar', 'pl': 'Wszyscy snajperzy'},
    'LEGENDARY': {'id': 'brawler Legendaris', 'de': 'legendären Brawler', 'tr': 'Efsanevi brawlerlar', 'pl': 'Wszyscy legendarni brawlerzy'},
    'SUPPORT': {'id': 'support', 'de': 'Supporter', 'tr': 'destekçiler', 'pl': 'Wszystkie supporty'},
    'CONTROLLER': {'id': 'controller', 'de': 'Controller', 'tr': 'kontrolcüler', 'pl': 'Wszyscy kontrolerzy'},
    'THROWER': {'id': 'thrower', 'de': 'Werfer', 'tr': 'atıcılar', 'pl': 'Wszyscy miotacze'},
    'DAMAGE DEALER': {'id': 'damage dealer', 'de': 'Damage Dealer', 'tr': 'hasarcılar', 'pl': 'Wszyscy damage dealerzy'},
}
COUNT_HASHTAGS = '#brawlstars #brawlstarstierlist #brawlstarsranked #tierlist #brawlzone'

if KIND in ('everyrank', 'classrank', 'seasonclimb'):
    N_EP = episode(KIND)
    if KIND in ('everyrank', 'seasonclimb'):
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
    if KIND == 'seasonclimb':  # only the top ten, one at a time
        singles = range(10, 1, -1)
    elif NB > 20:  # the original's shape: tier pages, then the top 20 in rows, then one at a time
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
    if KIND == 'seasonclimb':
        # The first season under the Ranked Refresh (19 November 2026) says so.
        refresh = str(data.get('date', '')) <= '2026-11-30'
        META = {
            'title': 'NEW Ranked season: the 10 BEST brawlers to climb 🏆 #Shorts',
            'titles': {'pt-BR': 'NOVA temporada do Ranqueado: os 10 MELHORES brawlers para subir 🏆 #Shorts',
                       'es-419': 'NUEVA temporada de Competitivo: los 10 MEJORES brawlers para subir 🏆 #Shorts',
                       **more_titles(id='Season Ranked BARU: 10 brawler TERBAIK buat naik rank 🏆 #Shorts',
                                     de='NEUE Ranked-Saison: die 10 BESTEN Brawler zum Aufsteigen 🏆 #Shorts',
                                     tr='YENİ Ranked sezonu: rank atlamak için EN İYİ 10 brawler 🏆 #Shorts',
                                     pl='NOWY sezon Ranked: 10 NAJLEPSZYCH brawlerów do wbijania rangi 🏆 #Shorts')},
            'description': 'A new Ranked season starts today. '
                           + ('It is the first under the Ranked Refresh: Power 11 at every rank, and the reset only '
                              'drops you 2 ranks. ' if refresh else '')
                           + f"The 10 best brawlers to climb with, from this week's Ranked games. Top 3: {top3}. "
                             f'Who are you climbing with? Comment below 👇\n\n'
                             f'Full tier list for your rank: https://brawlzone.net/tier-list/ranked{FOOTER}\n{COUNT_HASHTAGS}',
        }
    elif KIND == 'everyrank':
        META = {
            'title': 'Every brawler ranked from WORST to BEST 😳 #Shorts',
            'titles': {'pt-BR': 'Todos os brawlers do PIOR ao MELHOR 😳 #Shorts',
                       'es-419': 'Todos los brawlers del PEOR al MEJOR 😳 #Shorts',
                       **more_titles(id='Semua brawler dari TERBURUK ke TERBAIK 😳 #Shorts',
                                     de='Alle Brawler vom SCHLECHTESTEN zum BESTEN 😳 #Shorts',
                                     tr='Tüm brawlerlar EN KÖTÜDEN EN İYİYE 😳 #Shorts',
                                     pl='Wszyscy brawlerzy od NAJGORSZEGO do NAJLEPSZEGO 😳 #Shorts')},
            'description': f"All {NB} brawlers ranked by this week's Ranked games (Season {data.get('season')}). "
                           f'Top 3: {top3}. Where is your main? Comment below 👇 New ranking every week.\n\n'
                           f'Full tier list for your rank: https://brawlzone.net/tier-list/ranked{FOOTER}\n{COUNT_HASHTAGS}',
        }
    else:
        META = {
            'title': f'Every {en_pl.split()[0] if en_pl[0].isupper() else en_pl[:-1]} ranked from WORST to BEST 😳 #Shorts',
            'titles': {'pt-BR': f'Todos os {pt_pl} do PIOR ao MELHOR 😳 #Shorts',
                       'es-419': f'Todos los {es_pl} del PEOR al MEJOR 😳 #Shorts',
                       **more_titles(**{lang: t.format(GROUP_L10N[WORD][lang]) for lang, t in (
                           ('id', 'Semua {} dari TERBURUK ke TERBAIK 😳 #Shorts'),
                           ('de', 'Alle {} vom SCHLECHTESTEN zum BESTEN 😳 #Shorts'),
                           ('tr', 'Tüm {} EN KÖTÜDEN EN İYİYE 😳 #Shorts'),
                           ('pl', '{} od NAJGORSZEGO do NAJLEPSZEGO 😳 #Shorts'))} if WORD in GROUP_L10N else {})},
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
        climb = KIND == 'seasonclimb'
        words = ((('NEW', 0, False, 360, 200), ('SEASON', 1, False, 560, 200), ('TOP 10', 2, True, 790, 250)) if climb else
                 (('EVERY', 0, False, 360, 200), (WORD, 1, False, 560, word_size), ('RANKED', 2, True, 790, 250)))
        for w_, at, gold, y, size in words:
            slam(canvas, w_, size, WHITE, W / 2, y, bt - at, gold=gold, k=1.4)
        shake, flash = hits(bt, (0, 1, 2), 0.8, 0.4)
        if bt >= 3 and climb:
            put(canvas, text_sprite('BEST TO CLIMB', 110, (90, 230, 140)), W / 2, 1040, scale=out_back((bt - 3) / 0.5))
        elif bt >= 3:
            u = bt - 3
            put(canvas, text_sprite('WORST', 110, (255, 90, 100)), W / 2 - 230 - 300 * (1 - out_back(u / 0.5)), 1040)
            put(canvas, text_sprite('BEST', 110, (90, 230, 140)), W / 2 + 250 + 300 * (1 - out_back(u / 0.5)), 1040)
            put(canvas, text_sprite('>', 120, WHITE), W / 2 + 10, 1040, scale=out_back(u / 0.5))
        if bt >= 4:
            put(canvas, text_sprite("FROM THIS WEEK'S RANKED GAMES" if climb else f"THIS WEEK IN RANKED · SEASON {data.get('season')}",
                                    56, GOLD_TOP, stroke=7), W / 2, 1210, scale=out_back((bt - 4) / 0.4))
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
            x = W / 2 + (c_ - (in_row - 1) / 2) * 320; y = 980 - ((n + 2) // 3 - 1) * 200 + r_ * 400  # centred (2026-11-13)
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
        burst(canvas, lt, W / 2, 1000, GOLD_TOP if one else mixc(tcol, (255, 255, 255), 0.3))
        put(canvas, ribbon(nice(b['n']).upper(), tcol, 150 if len(b['n']) <= 7 else 130 if len(b['n']) <= 10 else 110),
            W / 2, 1540, scale=out_back((lt - 0.1) / 0.4, 1.5))
        shake = impact(lt, 1.6 if heavy else 0.9); flash = impact(lt) * (0.9 if one else 0.6 if heavy else 0.35)
    else:  # c_outro: the question that made the original's comments
        mark = False
        bounce = abs(math.sin(bt * math.pi)) * 26
        put(canvas, text_sprite("WHERE'S YOUR", 120, WHITE), W / 2, 460 - bounce * 0.4, scale=out_back(bt / 0.6))
        put(canvas, text_sprite('MAIN?', 300, gold=True), W / 2, 700 - bounce, scale=out_back((bt - 0.3) / 0.6))
        put(canvas, text_sprite('COMMENT BELOW', 96, WHITE), W / 2, 990, scale=out_back((bt - 1) / 0.5))
        if bt > 1.3: arrow(canvas, W / 2, 1180 + abs(math.sin(t * 6)) * 40)
        site_cta(canvas, bt - 2.2, 1420)
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
    fresh_or_exit([f"over:{b['id']}" for b in over] + [f"gem:{b['id']}" for b in gems])
    TOTAL = len(a)
    tl.add(6, 's_intro')
    for i, b in enumerate(over): tl.add(3, 's_over', b=b, n=len(over) - i)
    tl.add(3, 's_switch')
    for i, b in enumerate(gems): tl.add(3, 's_gem', b=b, n=len(gems) - i)
    tl.add(7, 's_outro')
    worst, best = nice(over[-1]['n']), nice(gems[-1]['n'])
    META = {
        'title': 'STOP picking these brawlers 🛑 #Shorts',
        'titles': {'pt-BR': 'PARE de escolher esses brawlers 🛑 #Shorts', 'es-419': 'DEJA de elegir estos brawlers 🛑 #Shorts',
                   **more_titles(id='BERHENTI pakai brawler ini 🛑 #Shorts',
                                 de='HÖR AUF, diese Brawler zu picken 🛑 #Shorts',
                                 tr='Bu brawlerları SEÇMEYİ BIRAK 🛑 #Shorts',
                                 pl='PRZESTAŃ wybierać tych brawlerów 🛑 #Shorts')},
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
        site_cta(canvas, bt - 2.2, 1400, 'THE HIDDEN META')
        shake, flash = hits(bt, (0, 0.6, 0.9), 0.7, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ giveaway
GW_END = (2026, 11, 30)  # draw at 20:00 UTC, lib/giveaway

if KIND == 'giveaway':
    import datetime
    DAYS = (datetime.date(*GW_END) - datetime.date.today()).days
    if DAYS < 1:
        print('the giveaway has closed'); sys.exit(3)
    tl.add(4, 'g_intro')
    tl.add(3, 'g_days')
    tl.add(7, 'g_how')
    tl.add(4, 'g_more')
    tl.add(5, 'g_outro')
    last = DAYS <= 3
    META = {
        'title': (f'LAST CHANCE: free Brawl Pass giveaway ends in {DAYS} days 🎁 #Shorts' if last
                  else f'FREE Brawl Pass giveaway 🎁 {DAYS} days left! #Shorts'),
        'titles': {'pt-BR': (f'ÚLTIMA CHANCE: sorteio grátis do Brawl Pass acaba em {DAYS} dias 🎁 #Shorts' if last
                             else f'Sorteio GRÁTIS do Brawl Pass 🎁 Faltam {DAYS} dias! #Shorts'),
                   'es-419': (f'ÚLTIMA OPORTUNIDAD: el sorteo gratis del Brawl Pass termina en {DAYS} días 🎁 #Shorts' if last
                              else f'Sorteo GRATIS del Brawl Pass 🎁 ¡Quedan {DAYS} días! #Shorts'),
                   **more_titles(id=(f'KESEMPATAN TERAKHIR: giveaway Brawl Pass gratis berakhir {DAYS} hari lagi 🎁 #Shorts' if last
                                     else f'GIVEAWAY Brawl Pass GRATIS 🎁 Sisa {DAYS} hari! #Shorts'),
                                 de=(f'LETZTE CHANCE: Gratis-Brawl-Pass-Gewinnspiel endet in {DAYS} Tagen 🎁 #Shorts' if last
                                     else f'GRATIS Brawl Pass Gewinnspiel 🎁 Noch {DAYS} Tage! #Shorts'),
                                 tr=(f'SON ŞANS: Ücretsiz Brawl Pass çekilişi {DAYS} gün sonra bitiyor 🎁 #Shorts' if last
                                     else f'ÜCRETSİZ Brawl Pass çekilişi 🎁 {DAYS} gün kaldı! #Shorts'),
                                 pl=(f'OSTATNIA SZANSA: darmowy konkurs o Brawl Pass kończy się za {DAYS} dni 🎁 #Shorts' if last
                                     else f'DARMOWY Brawl Pass do wygrania 🎁 Zostało {DAYS} dni! #Shorts'))},
        'description': 'Win a €10 Google Play or App Store gift card, enough for the Brawl Pass. Free to enter, '
                       'no login: just your player tag. More points = more chances: +2 for joining our Discord, '
                       '+1 for every friend who enters with your link. Drawn on Nov 30 at 20:00 UTC with public '
                       'randomness anyone can check.\n\n'
                       f'Enter: https://brawlzone.net/giveaway\nRules: https://brawlzone.net/giveaway/rules{FOOTER}\n'
                       '#brawlstars #brawlpass #giveaway #brawlstarsgiveaway #brawlzone',
    }


_prize = []
def prize_art(w):
    """The Brawl Pass ticket the owner supplied (in the cache), else a box."""
    if not _prize:
        for name in ('brawl-pass.png', 'box-rainbow.png'):
            path = f"{os.environ.get('ASSETS', '.')}/{name}"
            if os.path.exists(path):
                _prize.append(Image.open(path).convert('RGBA')); break
    if not _prize: return None
    im = _prize[0]
    return im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)


GW_PURPLE = (150, 90, 255)
def fit(txt, size, maxw, *a, **kw):
    """text_sprite, made smaller until it is at most maxw wide."""
    sp = text_sprite(txt, size, *a, **kw)
    # A loop, not one step: text_sprite caps a sprite at the frame's width, so
    # its width stops following the size for long text.
    while sp.width > maxw and size > 20:
        size = max(20, min(size - 2, int(size * maxw / sp.width)))
        sp = text_sprite(txt, size, *a, **kw)
    return sp


def giveaway_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    canvas = background(t, GW_PURPLE).convert('RGBA')
    if k == 'g_intro':
        put_rays(canvas, GOLD_TOP, t, W / 2, 1150, speed=14, alpha=0.7)
        slam(canvas, 'FREE', 260, None, W / 2, 420, bt, gold=True)
        slam(canvas, 'GIVEAWAY', 190, WHITE, W / 2, 640, bt - 1)
        a = prize_art(700)
        if a is not None and bt > 1.6:
            put(canvas, a, W / 2, 1150 + 14 * math.sin(t * 3), scale=out_back((bt - 1.6) / 0.5, 1.8), rot=-4)
        if bt > 2.6:
            put(canvas, pill('WIN THE BRAWL PASS', (255, 60, 100), size=74), W / 2, 1560, scale=out_back((bt - 2.6) / 0.4, 2.0), rot=-3)
        shake, flash = hits(bt, (0, 1, 1.6, 2.6), 1.2, 0.45)
    elif k == 'g_days':
        put_rays(canvas, (255, 60, 100), t, W / 2, 820, speed=30, alpha=0.8)
        last = DAYS <= 3
        if last: slam(canvas, 'LAST CHANCE', 150, (255, 90, 110), W / 2, 420, bt)
        n = text_sprite(str(DAYS), 520, gold=True, stroke=16)
        put(canvas, n, W / 2, 830, scale=1 + 0.9 * (1 - out_back(bt / 0.45, 1.4)) + 0.04 * math.sin(t * 8))
        slam(canvas, 'DAYS LEFT' if DAYS != 1 else 'DAY LEFT', 170, WHITE, W / 2, 1180, bt - 0.8)
        if bt > 1.6:
            put(canvas, pill('ENDS NOV 30', (40, 50, 110), size=70), W / 2, 1420, scale=out_back((bt - 1.6) / 0.4))
        shake, flash = hits(bt, (0, 0.8), 1.4, 0.5)
    elif k == 'g_how':
        slam(canvas, 'HOW TO ENTER', 150, None, W / 2, 380, bt, gold=True)
        steps = [('1', 'GO TO', 'BRAWLZONE.NET/GIVEAWAY'), ('2', 'TYPE YOUR', 'PLAYER TAG'), ('3', "DONE! IT'S", 'FREE')]
        for i, (num, a, b) in enumerate(steps):
            u = bt - 0.8 - i * 1.6
            if u < 0: continue
            y = 700 + i * 360
            put(canvas, pill(num, (255, 60, 100), size=110), 150, y, scale=out_back(u / 0.35, 2.0))
            put(canvas, text_sprite(a, 64, (220, 210, 255), stroke=6), 610, y - 55, scale=out_back((u - 0.1) / 0.35))
            put(canvas, fit(b, 110, 740, WHITE, stroke=8), 610, y + 40, scale=out_back((u - 0.15) / 0.35))
            if u < 0.4: shake = max(shake, impact(u * tl.step, 0.8))
    elif k == 'g_more':
        slam(canvas, 'MORE POINTS', 170, WHITE, W / 2, 520, bt)
        slam(canvas, '= MORE CHANCES', 130, None, W / 2, 720, bt - 0.7, gold=True)
        for i, (txt, col) in enumerate((('+2 JOIN OUR DISCORD', (88, 101, 242)), ('+1 PER FRIEND', (60, 200, 120)))):
            u = bt - 1.4 - i * 0.5
            if u > 0: put(canvas, pill(txt, col, size=80), W / 2, 1060 + i * 200, scale=out_back(u / 0.4, 2.0), rot=(-3 if i else 3))
        shake, flash = hits(bt, (0, 0.7, 1.4, 1.9), 1.0, 0.35)
    else:  # g_outro
        mark = False
        confetti(canvas, lt)
        bounce = abs(math.sin(bt * math.pi)) * 26
        put(canvas, fit('ENTER NOW', 230, 960, gold=True), W / 2, 460 - bounce, scale=out_back(bt / 0.5))
        put(canvas, fit('BRAWLZONE.NET/GIVEAWAY', 92, 960, WHITE, stroke=8), W / 2, 680, scale=out_back((bt - 0.6) / 0.4))
        if bt > 1.1: arrow(canvas, W / 2, 880 + abs(math.sin(t * 6)) * 40)
        a = prize_art(420)
        if a is not None and bt > 1.4: put(canvas, a, W / 2, 1150, scale=out_back((bt - 1.4) / 0.4), rot=4 * math.sin(t * 2))
        follow_cta(canvas, bt - 2.4, 1500, 'FOR THE WINNER ON NOV 30')
        shake, flash = hits(bt, (0, 0.6), 0.8, 0.3)
    return finish(canvas, shake, flash, mark)



# ================================================================ drops
# "1,000 Chaos Drops with the real drop rates" (2026-10-29): the drop opener on
# /starr-drops as a Short. Rolled from the wiki's tables (data['drops'], from
# viral-data.ts) with a seed from the date, so the two PARTs agree; the
# screen says it is a simulation the whole way through.
DROP_N = 1000
RAR_COL = {'Rare': (95, 212, 95), 'Super Rare': (62, 168, 255), 'Epic': (192, 91, 255), 'Mythic': (255, 77, 109),
           'Legendary': (255, 197, 61), 'Ultra': (255, 138, 61)}
RAR_NAME = {'Ultra': 'ULTRA LEGENDARY'}
BRAWLER_RAR = {'Epic Brawler': 'Epic', 'Mythic Brawler': 'Mythic', 'Legendary Brawler': 'Legendary', 'Ultra Brawler': 'Ultra Legendary'}

_dimg = {}
def dimg(name, size):
    """Art the job copies into ASSETS/drops: the grey Chaos Drop, reward icons."""
    key = (name, size)
    if key not in _dimg:
        path = f"{os.environ.get('ASSETS', '.')}/drops/{name}"
        if not os.path.exists(path):
            _dimg[key] = None
        else:
            im = Image.open(path).convert('RGBA'); sc = size / max(im.size)
            _dimg[key] = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
    return _dimg[key]

_tint = {}
def chaos_drop(rarity, size):
    """The wiki's grey Chaos Drop in a rarity's colour, as the game shows it upgrading."""
    key = (rarity, size)
    if key not in _tint:
        from PIL import ImageOps
        base = dimg('chaos-drop.png', size)
        col = RAR_COL.get(rarity, (200, 200, 220))
        im = ImageOps.colorize(base.convert('L'), black=tuple(int(c * 0.22) for c in col), mid=col,
                               white=tuple(min(255, int(c * 0.55 + 255 * 0.45)) for c in col)).convert('RGBA')
        im.putalpha(base.getchannel('A'))
        _tint[key] = im
    return _tint[key]

# Which drop or box, by episode (2026-11-02, owner approved "I opened 1,000
# X" every week after the Chaos Drops one became the channel's best Short,
# 2,451 views): the ones people know first, then whatever else the wiki has
# a complete table for. The Chaos Drop is the hand-cached grey one, tinted by
# rarity; every other one is its own art, cached by brawlzone-viral as
# drops/<slug>.png.
# Episode 1 was the Chaos Drops one (2026-10-29), so the list starts there.
# Only the drops that are always in the game (owner, 2026-11-13: "monster eggs
# are not even in the game anymore"). The event and brawler boxes come and
# go with events, and a video about one that is gone reads as stale; the
# site's own data marks these three as `core`.
DROP_ROTATION = ['chaos-drops', 'starr-drops', 'ranked-starr-drops']
if KIND == 'drops':
    _drops = data.get('drops', {})
    _ok = [k for k in DROP_ROTATION if k in _drops and dimg('chaos-drop.png' if k == 'chaos-drops' else f'{k}.png', 16) is not None]
    if not _ok:
        print('no drop table with art'); sys.exit(3)
    DROP_KEY = _ok[(episode('drops') - 1) % len(_ok)]
    DROP = _drops[DROP_KEY]
    NAME = DROP['name'].upper()
    ODDS = [o for o in DROP.get('odds') or [] if o['chance']]
    if ODDS:
        TABLES = {t['rarity']: [r for r in t['rewards'] if r['chance']] for t in DROP['tables'] if t['rarity']}
    else:  # a box: one roll of its one table per box
        TABLES = {None: [r for r in DROP['tables'][0]['rewards'] if r['chance']]}
        ODDS = [{'rarity': None, 'chance': 1}]
    sim = random.Random(f"{data.get('date', '')}/drops")
    def wpick(items, w):
        x = sim.random() * sum(w(i) for i in items)
        for i in items:
            x -= w(i)
            if x < 0: return i
        return items[-1]
    COUNT = {o['rarity']: 0 for o in ODDS}; TOTAL = {}; ITEMS = {}; LINES = {}
    for _ in range(DROP_N):
        o = wpick(ODDS, lambda o: o['chance']); COUNT[o['rarity']] += 1
        if not TABLES.get(o['rarity']): continue
        r = wpick(TABLES[o['rarity']], lambda r: r['chance'])
        # How many gave each kind of reward: amounts by currency, items by name.
        line = (r['label'] if r['amount'] else ('Skin' if 'skin' in r['reward'].lower() else r['reward'])).upper()
        LINES[line] = LINES.get(line, 0) + 1
        if r['amount']:
            TOTAL[r['label']] = TOTAL.get(r['label'], 0) + int(r['amount'].replace(',', ''))
        else:
            name = r['reward']
            key = ('Skin' if 'skin' in name.lower() else 'Pin' if name.lower().endswith('pin') else
                   'Spray' if 'spray' in name.lower() else name)
            ITEMS[key] = ITEMS.get(key, 0) + 1
    # The bars while opening: rarities for a drop, the five commonest rewards for a box.
    if ODDS[0]['rarity'] is not None:
        BARS = [(RAR_NAME.get(o['rarity'], o['rarity'].upper()), COUNT[o['rarity']], RAR_COL.get(o['rarity'], (200, 200, 220))) for o in ODDS]
    else:
        PALETTE = [(95, 212, 95), (62, 168, 255), (192, 91, 255), (255, 77, 109), (255, 197, 61)]
        common = sorted(LINES.items(), key=lambda kv: -kv[1])[:5]
        BARS = [(k, v, PALETTE[i % 5]) for i, (k, v) in enumerate(common)]
    # Which brawlers, for the art: a draw from that rarity, as the game does for a brawler you lack.
    def brawlers_of(item, n):
        pool = [b for b in data['all'] if b.get('rar') == BRAWLER_RAR[item] and has_model(b)]
        return sim.sample(pool, min(n, len(pool)))
    CAN_LEG = any(r['reward'] == 'Legendary Brawler' for t in TABLES.values() for r in t)
    LEGS = brawlers_of('Legendary Brawler', min(ITEMS.get('Legendary Brawler', 0), 3))
    ULTRAS = brawlers_of('Ultra Brawler', min(ITEMS.get('Ultra Brawler', 0), 1))
    ultra_odd = next((o['chance'] for o in ODDS if o['rarity'] == 'Ultra'), 0)
    ultra_row = next((r['chance'] for r in TABLES.get('Ultra', []) if r['reward'] == 'Ultra Brawler'), 0)
    ULTRA_IN = round(1 / (ultra_odd * ultra_row)) if ultra_odd and ultra_row else None
    GOOD = [(k, f) for k, f in (('Star Power', 'star-power.png'), ('Hypercharge', 'hypercharge.png'), ('Gadget', 'gadget.png'),
                                ('Skin', 'skin-legendary.png'), ('Buffie', 'buffie.png'), ('Mythic Brawler', 'brawlers.png'),
                                ('Epic Brawler', 'brawlers.png'))
            if ITEMS.get(k) and dimg(f, 16) is not None][:6]
    LOOT = [(k, f) for k, f in (('Coins', 'coins.png'), ('Power Points', 'power-points.png'), ('Credits', 'credits.png'),
                                ('Gems', 'gems.png'), ('Bling', 'bling.png'))
            if TOTAL.get(k) and dimg(f, 16) is not None][:4]
    if not LOOT and not GOOD:
        print(f'{DROP_KEY}: nothing to show'); sys.exit(3)

    tl.add(4, 'd_intro')
    tl.add(6, 'd_open')
    if LOOT: tl.add(2 + len(LOOT), 'd_loot')
    if GOOD: tl.add(2 + len(GOOD), 'd_good')
    if CAN_LEG: tl.add(5, 'd_leg')
    if ULTRA_IN: tl.add(7, 'd_ultra')
    tl.add(8, 'd_outro')

    legs = ITEMS.get('Legendary Brawler', 0); ultras = ITEMS.get('Ultra Brawler', 0)
    parts = [f"{TOTAL[k]:,} {k.lower()}" for k, _ in LOOT] + [f"{ITEMS[k]} {k}{'s' if ITEMS[k] != 1 else ''}" for k, _ in GOOD]
    if CAN_LEG: parts.append(f"{legs} Legendary Brawler{'s' if legs != 1 else ''}")
    if ULTRA_IN: parts.append(f'{ultras} Ultra Legendary')
    summary = ', '.join(parts) + '.'
    plain = DROP['name']
    META = {
        'title': f'1,000 {plain} with the REAL drop rates: what do you get? 😱',
        'titles': {'pt-BR': f'1.000 {plain} com as chances REAIS: o que você ganha? 😱',
                   'es-419': f'1.000 {plain} con las probabilidades REALES: ¿qué te toca? 😱',
                   **more_titles(id=f'1.000 {plain} dengan peluang ASLI: dapat apa? 😱',
                                 de=f'1.000 {plain} mit den ECHTEN Drop-Chancen: was bekommst du? 😱',
                                 tr=f'GERÇEK oranlarla 1.000 {plain}: ne çıkar? 😱',
                                 pl=f'1000 {plain} z PRAWDZIWYMI szansami: co wypadnie? 😱')},
        'description': f'What 1,000 {plain} give you, simulated with the real drop rates from the Brawl Stars Wiki: {summary} '
                       f'What would you hope for? Comment 👇\n\n'
                       f'Every drop and box with its odds: https://brawlzone.net/starr-drops{FOOTER}\n'
                       f"#brawlstars #{''.join(c for c in plain.lower() if c.isalnum())} #starrdrop #brawlstarsgame #brawlzone",
    }


def drop_art(rarity, size):
    """The drop or box: the Chaos Drop tinted by rarity, any other its own art."""
    return chaos_drop(rarity, size) if DROP_KEY == 'chaos-drops' else dimg(f'{DROP_KEY}.png', size)


def sim_note(canvas):
    put(canvas, text_sprite('SIMULATED WITH THE REAL DROP RATES', 36, (225, 220, 255), stroke=5, shadow=False), W / 2, 290)


def drops_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    order = [o['rarity'] for o in ODDS]
    cols = [c for _, _, c in BARS] or [RAR_COL['Legendary']]
    if k == 'd_intro':
        rar = order[int(bt * 2) % len(order)]
        col = cols[int(bt * 2) % len(cols)]
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 1180, speed=16, alpha=0.8)
        slam(canvas, '1,000', 300, None, W / 2, 540, bt, gold=True)
        slam(canvas, NAME, 150 if len(NAME) <= 12 else 120 if len(NAME) <= 16 else 96, WHITE, W / 2, 770, bt - 1)
        if bt > 1.5:
            put(canvas, drop_art(rar, 520), W / 2, 1180 + 16 * math.sin(t * 3), scale=out_back((bt - 1.5) / 0.5, 1.8), rot=4 * math.sin(t * 5))
        if bt > 2.6:
            put(canvas, pill('WHAT DO YOU GET?', (255, 60, 100), size=78), W / 2, 1560, scale=out_back((bt - 2.6) / 0.4, 2.0), rot=-3)
        shake, flash = hits(bt, (0, 1, 1.5, 2.6), 1.2, 0.4)
    elif k == 'd_open':
        prog = out_cubic(bt / 4.5)
        top = max((r for r in order if COUNT[r] * prog >= 1), key=order.index, default=order[0])
        rar = order[int(t * 9) % len(order)] if prog < 1 else top
        col = cols[int(t * 9) % len(cols)] if prog < 1 else cols[-1]
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 860, speed=40, alpha=0.7)
        put(canvas, text_sprite('OPENING...' if prog < 1 else 'OPENED!', 90, WHITE, stroke=8), W / 2, 400)
        put(canvas, text_sprite(f'{int(DROP_N * prog):,}', 220, gold=True, stroke=14), W / 2, 580)
        wob = 0 if prog >= 1 else 7 * math.sin(t * 45)
        put(canvas, drop_art(rar, 400), W / 2, 880, scale=1 + 0.05 * abs(math.sin(t * 20)) * (prog < 1), rot=wob)
        most = max((n for _, n, _ in BARS), default=1) or 1
        for i, (label, count, col) in enumerate(BARS):
            y = 1150 + i * 92; n = int(count * prog)
            put(canvas, fit(label, 44, 380, col, stroke=6, shadow=False), 250, y)
            bar = Image.new('RGBA', (440, 46), (0, 0, 0, 0)); d = ImageDraw.Draw(bar)
            d.rounded_rectangle((0, 0, 439, 45), 23, fill=(10, 12, 28, 220))
            wbar = int(434 * n / most)
            if wbar > 20: d.rounded_rectangle((3, 3, 3 + wbar, 42), 20, fill=col)
            canvas.alpha_composite(bar, (450, int(y - 23)))
            put(canvas, text_sprite(f'{n:,}', 54, WHITE, stroke=6, shadow=False), 980, y)
        if 4.5 <= bt < 5: shake, flash = hits(bt, (4.5,), 1.0, 0.5)
    elif k == 'd_loot':
        canvas = background(t, GOLD_TOP).convert('RGBA')
        slam(canvas, 'THE LOOT', 160, None, W / 2, 420, bt, gold=True)
        for i, (key, f) in enumerate(LOOT):
            u = bt - 1 - i; y = 720 + i * 320
            if u < 0: continue
            icon = dimg(f, 230)
            if icon is not None: put(canvas, icon, 250, y, scale=out_back(u / 0.4, 2.0))
            put(canvas, text_sprite(f'{TOTAL[key]:,}', 150, gold=True, stroke=12), 640, y - 30, scale=out_back((u - 0.1) / 0.4))
            put(canvas, text_sprite(key.upper(), 60, WHITE, stroke=6), 640, y + 85, scale=out_back((u - 0.2) / 0.4))
        shake, flash = hits(bt, [0] + [1 + i for i in range(len(LOOT))], 1.0, 0.3)
    elif k == 'd_good':
        canvas = background(t, (192, 91, 255)).convert('RGBA')
        slam(canvas, 'THE GOOD STUFF', 140, None, W / 2, 420, bt, gold=True)
        for i, (key, f) in enumerate(GOOD):
            u = bt - 1 - i; x = 290 if i % 2 == 0 else 790; y = 730 + (i // 2) * 330
            if u < 0: continue
            sc = out_back(u / 0.4, 2.0)
            tile = Image.new('RGBA', (440, 300), (0, 0, 0, 0))
            ImageDraw.Draw(tile).rounded_rectangle((0, 0, 439, 299), 40, fill=(10, 12, 28, 200), outline=(10, 12, 28), width=6)
            put(canvas, tile, x, y, scale=sc)
            icon = dimg(f, 150)
            if icon is not None: put(canvas, icon, x - 105, y - 20, scale=sc)
            put(canvas, text_sprite(f'x{ITEMS[key]}', 110, gold=True, stroke=10), x + 80, y - 30, scale=sc)
            label = {'Skin': 'SKINS', 'Mythic Brawler': 'MYTHIC BRAWLERS', 'Epic Brawler': 'EPIC BRAWLERS'}.get(key, key.upper() + 'S')
            put(canvas, fit(label, 46, 400, WHITE, stroke=5, shadow=False), x, y + 100, scale=sc)
        shake, flash = hits(bt, [0] + [1 + i for i in range(len(GOOD))], 0.9, 0.3)
    elif k == 'd_leg':
        legs = ITEMS.get('Legendary Brawler', 0)
        canvas = background(t, RAR_COL['Legendary']).convert('RGBA')
        put_rays(canvas, RAR_COL['Legendary'], t, W / 2, 1150, speed=14, alpha=0.8)
        slam(canvas, 'LEGENDARY', 150, None, W / 2, 400, bt, gold=True)
        slam(canvas, 'BRAWLERS', 130, WHITE, W / 2, 560, bt - 0.5)
        if bt > 1.2:
            put(canvas, text_sprite(f'x{legs}', 230, gold=True, stroke=14), W / 2, 760, scale=1 + 0.8 * (1 - out_back((bt - 1.2) / 0.45, 1.4)))
        xs = {1: [W / 2], 2: [330, 750], 3: [220, W / 2, 860]}.get(len(LEGS), [])
        for i, (b, x) in enumerate(zip(LEGS, xs)):
            u = bt - 2 - i * 0.6
            if u < 0: continue
            put(canvas, art(b, 560, 420), x, 1230, scale=out_back(u / 0.4, 1.8))
            put(canvas, fit(nice(b['n']).upper(), 60, 320, WHITE, stroke=6), x, 1560, scale=out_back((u - 0.2) / 0.4))
        if not LEGS and bt > 2:
            slam(canvas, 'NONE...', 150, (255, 90, 110), W / 2, 1200, bt - 2)
        shake, flash = hits(bt, [0, 0.5, 1.2] + [2 + i * 0.6 for i in range(len(LEGS))], 1.1, 0.4)
    elif k == 'd_ultra':
        got = bool(ULTRAS)
        canvas = background(t, RAR_COL['Ultra']).convert('RGBA')
        slam(canvas, 'ULTRA BRAWLER?', 130, None, W / 2, 420, bt, gold=True)
        if bt > 0.8:
            put(canvas, pill(f'1 IN {ULTRA_IN:,}', (255, 60, 100), size=80), W / 2, 600, scale=out_back((bt - 0.8) / 0.4, 2.0), rot=-3)
        if bt < 6:
            put_rays(canvas, RAR_COL['Ultra'], t, W / 2, 1100, speed=20 + bt * 25, alpha=min(1, 0.5 + bt * 0.09))
            put(canvas, drop_art('Ultra', 480), W / 2, 1100, scale=1 + 0.02 * bt * abs(math.sin(t * 30)), rot=(bt * 2) * math.sin(t * 40))
            if bt > 1.5: put(canvas, text_sprite('...', 160, WHITE), W / 2, 1480 + 10 * math.sin(t * 8))
        elif got:
            confetti(canvas, lt - 6 * tl.step)
            put_rays(canvas, GOLD_TOP, t, W / 2, 1100, speed=30)
            b = ULTRAS[0]
            put(canvas, art(b, 640, 640), W / 2, 1120, scale=out_back((bt - 6) / 0.45, 1.8))
            slam(canvas, f'WE GOT {nice(b["n"]).upper()}!', 110, None, W / 2, 1530, bt - 6.3, gold=True)
        else:
            put(canvas, grey(drop_art('Ultra', 480)), W / 2, 1060)
            slam(canvas, '0', 300, (255, 90, 110), W / 2, 1060, bt - 6)
            slam(canvas, 'NOT EVEN ONE', 120, WHITE, W / 2, 1450, bt - 6.6)
        shake, flash = hits(bt, (0, 0.8, 6, 6.6), 1.4, 0.6)
    else:  # d_outro
        mark = False
        canvas = background(t, RAR_COL['Legendary']).convert('RGBA')
        bounce = abs(math.sin(bt * math.pi)) * 22
        put(canvas, fit('OPEN YOUR OWN', 170, 960, gold=True), W / 2, 420 - bounce, scale=out_back(bt / 0.5))
        search_cta(canvas, bt - 0.6, 600, 'brawlzone.net/starr-drops', width=960, height=112)
        if bt > 1.1: arrow(canvas, W / 2, 790 + abs(math.sin(t * 6)) * 36)
        if bt > 1.4:
            rar = order[int(bt) % len(order)]
            put(canvas, drop_art(rar, 330), W / 2, 1090, scale=out_back((bt - 1.4) / 0.4), rot=5 * math.sin(t * 3))
        follow_cta(canvas, bt - 2.4, 1390, 'FOR THE NEXT 1,000')
        shake, flash = hits(bt, (0, 0.6), 0.8, 0.3)
    if k != 'd_outro': sim_note(canvas)
    return finish(canvas, shake, flash, mark)

# ================================================================ render
# ================================================================ whatsnew
# "What's new" (2026-11-02, owner: "one showcasing the new brawlers/new
# buffies would be awesome"): the five newest brawlers, each revealed in
# Supercell's Fan Kit render with its Ranked tier, then the five newest
# Buffies, each brawler with its gadget, star power and hypercharge Buffie.
# The Buffie icons and their newest-first order come from the Fan Kit
# (scripts/fankit-sync.py), cached by brawlzone-viral in $ASSETS/buffies.
BUFFIE_COL = {'gadget': (60, 200, 110), 'starPower': (255, 190, 40), 'hyperCharge': (255, 80, 200)}
BUFFIE_LABEL = {'gadget': 'GADGET', 'starPower': 'STAR POWER', 'hyperCharge': 'HYPERCHARGE'}
if KIND == 'whatsnew':
    scored = sorted((b for b in data['all'] if b.get('tier')), key=lambda b: -(b['score'] or 0))
    RANK = {b['id']: i + 1 for i, b in enumerate(scored)}
    # The newest brawlers whether or not they have a Ranked tier yet
    # (2026-11-03): a launch-week brawler has none, so Thunder Frogs, Rey and
    # Ruby were skipped in their own week. `newest` comes from the catalogue
    # (scripts/viral-data.ts); older data files only have the ranked roster.
    if data.get('newest'):
        NEWEST = [b for b in data['newest'] if has_model(b)][:5]
    else:
        NEWEST = [b for b in sorted(scored, key=lambda b: -b['id']) if has_model(b)][:5]
    # The latest update (2026-11-03): its own new brawlers and Buffies, read
    # from Supercell's release notes by viral-data (lib/release-notes
    # updateHeadliners), lead for two weeks after it ships.
    import datetime
    UPD = data.get('update') or {}
    try:
        FRESH = (datetime.date.fromisoformat(data['date']) - datetime.date.fromisoformat(UPD['date'])).days <= 14
    except (KeyError, TypeError, ValueError):
        FRESH = False
    _pool = {b['id']: b for b in data.get('newest') or []}
    if FRESH:
        _heads = [_pool.get(e['id']) or by_id.get(e['id']) or {'n': e['n'], 'id': e['id'], 'tier': None}
                  for e in UPD.get('brawlers', [])]
        _heads = [b for b in _heads if has_art(b)]  # an interim crop will do for the update's own
        _ids = {b['id'] for b in _heads}
        NEWEST = (_heads + [b for b in NEWEST if b['id'] not in _ids])[:5]
    try:
        _bi = json.load(open(f"{os.environ.get('ASSETS', '.')}/buffies/index.json"))
    except (OSError, ValueError):
        _bi = {}
    BUFFIES = []
    if FRESH and UPD.get('buffies'):
        try:
            _ab = json.load(open(f"{os.environ.get('ASSETS', '.')}/abilities/index.json"))
        except (OSError, ValueError):
            _ab = []
        for e in UPD['buffies']:
            b = by_id.get(e['id']) or _pool.get(e['id'])
            if not b or not has_model(b):
                continue
            icons = {k: optional(f"{os.environ.get('ASSETS', '.')}/buffies/{e['id']}-{k}.png") for k in BUFFIE_COL}
            if not all(icons.values()):
                # An update's Buffie icons reach the Fan Kit weeks late: the
                # brawler's own gadget, star power and hypercharge stand in
                # (Buffies upgrade exactly those). One missing, and it is skipped.
                files = {k: next((x['file'] for x in _ab if x.get('bid') == e['id'] and x.get('kind') == k), None)
                         for k in BUFFIE_COL}
                icons = {k: optional(f"{os.environ.get('ASSETS', '.')}/{f}") if f else None for k, f in files.items()}
            if all(icons.values()):
                BUFFIES.append((b, icons))
            if len(BUFFIES) == 5:
                break
    for bid, v in sorted(_bi.items(), key=lambda kv: kv[1].get('order', 1e9)):
        if len(BUFFIES) >= 3 and FRESH and UPD.get('buffies'):
            break  # the update's own are enough; older ones only make up numbers
        b = by_id.get(int(bid))
        icons = {k: optional(f"{os.environ.get('ASSETS', '.')}/buffies/{bid}-{k}.png") for k in BUFFIE_COL}
        if b and b.get('tier') and has_model(b) and all(icons.values()) and all(x[0]['id'] != b['id'] for x in BUFFIES):
            BUFFIES.append((b, icons))
        if len(BUFFIES) == 5:
            break
    if len(NEWEST) < 3 or len(BUFFIES) < 3:
        print('not enough new brawlers or buffies'); sys.exit(3)
    fresh_or_exit([b['id'] for b in NEWEST] + [f"buffie:{b['id']}" for b, _ in BUFFIES])
    tl.add(5, 'w_intro')
    tl.add(2, 'w_part', label='NEW BRAWLERS', col=(255, 60, 100))
    for b in reversed(NEWEST):  # oldest of the five first, the newest last
        tl.add(4, 'w_brawler', b=b)
    tl.add(2, 'w_part', label='NEW BUFFIES', col=(139, 107, 255))
    for b, icons in reversed(BUFFIES):
        tl.add(4, 'w_buffie', b=b, icons=icons)
    tl.add(7, 'w_outro')
    nb = ', '.join(f"{nice(b['n'])} (" + (f"{b['tier']} tier" if b.get('tier') else f"{b['trophyTier']} tier in trophy games"
                                          if b.get('trophyTier') else 'just released') + ')' for b in reversed(NEWEST))
    bf = ', '.join(nice(b['n']) for b, _ in reversed(BUFFIES))
    META = {
        'title': (f"{UPD['title'].split()[-2]} update: NEW brawlers & Buffies, are they good? 🔥"
                  if FRESH and len(UPD.get('title', '').split()) >= 2 else 'NEW brawlers & Buffies: are they actually good? 🔥'),
        'titles': {'pt-BR': 'Brawlers e Buffies NOVOS: são bons mesmo? 🔥',
                   'es-419': '¿Los NUEVOS brawlers y Buffies son buenos? 🔥',
                   **more_titles(id='Brawler & Buffie BARU: beneran bagus? 🔥',
                                 de='NEUE Brawler & Buffies: sind sie wirklich gut? 🔥',
                                 tr="YENİ brawlerlar ve Buffie'ler: gerçekten iyi mi? 🔥",
                                 pl='NOWI brawlerzy i Buffie: czy są naprawdę dobrzy? 🔥')},
        'description': f"The newest brawlers right now: {nb}. The newest Buffies: {bf}. "
                       f"Which one is your favourite? 👇\n\n"
                       f"Every brawler's tier, from real Ranked battles: https://brawlzone.net/tier-list/ranked{FOOTER}\n"
                       f"#brawlstars #brawlstarsnewbrawler #buffies #brawlstarsmeta #brawlzone",
    }


def wn_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'w_intro':
        col = (255, 60, 100) if int(t * 3) % 2 == 0 else (139, 107, 255)
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 1100, speed=50, alpha=0.6)
        for j, b in enumerate([b for b in NEWEST if has_model(b)][:3]):  # a framed crop has no silhouette
            sil = silhouette(art(b, 520, 420), (255, 255, 255))
            x = W / 2 + (j - 1) * 330
            put(canvas, sil, x, 1180 + (j % 2) * 40, scale=0.85 + 0.04 * math.sin(t * 6 + j), alpha=clamp(bt - j * 0.3))
        slam(canvas, 'NEW', 230, None, W / 2, 330, bt, gold=True)
        slam(canvas, 'BRAWLERS', 170, WHITE, W / 2, 520, bt - 1)
        slam(canvas, '+ BUFFIES', 150, (190, 160, 255), W / 2, 690, bt - 2)
        slam(canvas, 'ARE THEY GOOD?', 110, WHITE, W / 2, 1660, bt - 3.2)
        shake, flash = hits(bt, (0, 1, 2, 3.2), 1.3, 0.5)
    elif k == 'w_part':
        canvas = background(t, s['col']).convert('RGBA')
        put_rays(canvas, s['col'], t, W / 2, 960, speed=70, alpha=0.8)
        a, b_ = s['label'].split(' ', 1)
        slam(canvas, a, 210, None, W / 2, 840, bt, gold=True)
        slam(canvas, b_, 190, WHITE, W / 2, 1060, bt - 0.5)
        shake, flash = hits(bt, (0, 0.5), 1.4, 0.6)
    elif k == 'w_brawler':
        # No Ranked tier (launch week, or kept out of Ranked): the trophy-game
        # tier stands in, and with neither it is just released.
        b = s['b']; tier = b.get('tier') or b.get('trophyTier'); tcol = TIER.get(tier, (255, 60, 100))
        canvas = background(t, tcol).convert('RGBA')
        put_rays(canvas, tcol, t, W / 2, 860, speed=40, alpha=0.9)
        put(canvas, art(b, 860, 900), W / 2, 820, scale=1 + 0.35 * (1 - out_back(bt / 0.45, 1.6)))
        nm = nice(b['n']).upper(); fs = 170 if len(nm) <= 8 else 130 if len(nm) <= 12 else 100
        if bt > 0.3:
            put(canvas, text_sprite(nm, fs, gold=True), W / 2, 1330, scale=1 + 1.2 * (1 - out_back((bt - 0.3) / 0.5, 1.2)))
        if bt > 1.3:
            u = bt - 1.3
            badge = tier_pill(tier) if tier else pill('JUST RELEASED', (255, 60, 100), size=72)
            put(canvas, badge, W / 2, 1520, scale=1.5 * (1 + 1.0 * (1 - out_back(u / 0.5, 1.2))) if u < 0.5 else 1.5)
        if bt > 2.2:
            line = (f"#{RANK[b['id']]} OF {len(RANK)} IN RANKED" if b.get('tier') and b['id'] in RANK
                    else 'IN TROPHY GAMES' if tier else 'TOO NEW FOR RANKED')
            put(canvas, text_sprite(line, 64, WHITE, stroke=6), W / 2, 1680, scale=out_back((bt - 2.2) / 0.4))
        if bt > 2.9:
            word, vcol = VERDICT[tier] if tier else ('BRAND NEW!', (255, 60, 100))
            put(canvas, text_sprite(word, 150, vcol), W / 2, 330, scale=1 + 1.6 * (1 - out_back((bt - 2.9) / 0.4, 1.0)), rot=-8)
            if not tier or tier in 'SA': confetti(canvas, (bt - 2.9) * P)
        shake = max(impact(lt, 1.2), hits(bt, (1.3, 2.9), 1.1, 0.4)[0])
        flash = max(impact(lt) * 0.8, hits(bt, (1.3, 2.9), 1.1, 0.4)[1])
    elif k == 'w_buffie':
        b = s['b']; tier = b.get('tier') or b.get('trophyTier')
        canvas = background(t, (139, 107, 255)).convert('RGBA')
        put_rays(canvas, (139, 107, 255), t, W / 2, 640, speed=40, alpha=0.8)
        put(canvas, art(b, 700, 760), W / 2, 640, scale=1 + 0.3 * (1 - out_back(bt / 0.45, 1.6)))
        nm = nice(b['n']).upper(); fs = 150 if len(nm) <= 8 else 115 if len(nm) <= 12 else 90
        if bt > 0.3:
            put(canvas, text_sprite(nm, fs, gold=True), W / 2, 1080, scale=1 + 1.2 * (1 - out_back((bt - 0.3) / 0.5, 1.2)))
        for j, kind in enumerate(('gadget', 'starPower', 'hyperCharge')):
            u = (bt - 1.0 - j * 0.5) / 0.35
            if u <= 0:
                continue
            x = W / 2 + (j - 1) * 330
            put(canvas, s['icons'][kind].resize((250, 250), Image.LANCZOS), x, 1340, scale=out_back(u, 1.9))
            put(canvas, text_sprite(BUFFIE_LABEL[kind], 44, BUFFIE_COL[kind], stroke=5), x, 1500, alpha=clamp(u - 0.4))
            if u < 0.5: shake = max(shake, impact(u * 0.4 * P, 0.8))
        if bt > 2.9 and tier:
            put(canvas, tier_pill(tier), W / 2, 1690, scale=1.3 * (1 + 1.0 * (1 - out_back((bt - 2.9) / 0.5, 1.2))) if bt < 3.4 else 1.3)
        shake = max(shake, impact(lt, 1.0)); flash = max(flash, impact(lt) * 0.7)
    else:  # w_outro
        canvas = background(t, (255, 170, 40)).convert('RGBA'); mark = False
        faces = [b for b in NEWEST] + [b for b, _ in BUFFIES]
        for j, b in enumerate(faces):
            u = (bt - j * 0.08) / 0.3
            if u <= 0: continue
            x = W / 2 + ((j % 5) - 2) * 190; y = 330 + (j // 5) * 200
            put(canvas, load_face(b).resize((170, 170), Image.LANCZOS), x, y, scale=out_back(u, 1.6))
        slam(canvas, 'WHICH ONE IS', 120, WHITE, W / 2, 790, bt - 0.8)
        slam(canvas, 'YOUR FAVOURITE?', 130, None, W / 2, 940, bt - 1.3, gold=True)
        slam(canvas, 'TELL US IN THE COMMENTS', 62, WHITE, W / 2, 1070, bt - 1.9)
        site_cta(canvas, bt - 2.8, 1320)
        shake, flash = hits(bt, (0.8, 1.3, 2.8), 0.9, 0.3)
    return finish(canvas, shake, flash, mark)


# ================================================================ rankedrefresh
# "Ranked just changed" (2026-11-03, owner: yes to a Ranked Refresh Short):
# the November update's Ranked rework, one change a card, before -> after.
# Written from Supercell's release notes, not from data, and posted once by
# hand (`brawlzone-viral rankedrefresh`), not part of the rotation.
RR = [
    dict(icon='trophy', big='5,000 TROPHIES', line='TO UNLOCK RANKED', was='WAS 1,000',
         note='ALREADY UNLOCKED? YOU KEEP IT', col=(255, 140, 40)),
    dict(icon='power-11', big='POWER 11', line='BRAWLERS AT EVERY RANK', was='WAS POWER 9 UP TO DIAMOND',
         note='DIAMOND NOW NEEDS 12 BRAWLERS', col=(255, 60, 100)),
    dict(icon='brawlers', big='6 FREE MAXED', line='BRAWLERS EVERY SEASON', was='WAS 3', note=None, col=(70, 215, 120)),
    dict(icon='league-mythic', big='ONLY -2 RANKS', line='AT THE SEASON RESET', was='WAS -6',
         note='LESS CLIMBING BACK UP', col=(139, 107, 255)),
    dict(icon='ranked', big='2-0 = MORE ELO', line='1-2 = YOU LOSE LESS', was=None,
         note='EPIC WIN AND CLOSE MATCH', col=(60, 170, 255)),
    dict(icon='league-masters', big='NO TEAMS', line='AT MASTERS I AND ABOVE', was=None,
         note='SOLO QUEUE AT THE TOP', col=(255, 205, 40)),
    dict(icon='draft', big='NEW DRAFT', line='BAN SUGGESTIONS + QUICK CHAT', was=None,
         note='AND YOU CAN SWAP PICK ORDER', col=(255, 90, 60)),
]
RR_LEAGUES = ['bronze', 'silver', 'gold', 'diamond', 'mythic', 'legendary', 'masters', 'pro']
if KIND == 'rankedrefresh':
    tl.add(4, 'r_intro')
    for i, c in enumerate(RR):
        tl.add(4, 'r_change', i=i, c=c)
    tl.add(5, 'r_outro')
    META = {
        'title': 'Ranked just CHANGED: 7 things you need to know 😱 #Shorts',
        'titles': {'pt-BR': 'O Ranked MUDOU: 7 coisas que você precisa saber 😱 #Shorts',
                   'es-419': 'El Ranked CAMBIÓ: 7 cosas que tienes que saber 😱 #Shorts'},
        'description': 'The November update\'s Ranked Refresh: Ranked now unlocks at 5,000 trophies (you keep it if '
                       'you already had it), needs Power 11 brawlers at every rank, gives 6 free maxed brawlers a '
                       'season, and the season reset drops you only 2 ranks. 2-0 wins give more Elo, 1-2 losses '
                       'cost less, no teams at Masters I and above, and a new draft screen. Good or bad? 👇\n\n'
                       'The best brawlers for the new season (Nov 19), from real Ranked battles: '
                       f'https://brawlzone.net/tier-list/ranked{FOOTER}\n'
                       '#brawlstars #brawlstarsranked #ranked #brawlstarsupdate #brawlzone',
    }

_rr_icons = {}
def rr_icon(name, w):
    """An icon from $ASSETS/ranked (brawlzone-viral copies them), w wide."""
    if (name, w) not in _rr_icons:
        path = f"{os.environ.get('ASSETS', '.')}/ranked/{name}.png"
        im = Image.open(path).convert('RGBA') if os.path.exists(path) else None
        _rr_icons[(name, w)] = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS) if im else None
    return _rr_icons[(name, w)]


def rr_scene(s, t, bt, lt):
    k = s['kind']; shake = flash = 0.0; mark = True
    if k == 'r_intro':
        canvas = background(t, (255, 90, 60)).convert('RGBA')
        put_rays(canvas, (255, 190, 60), t, W / 2, 1250, speed=50, alpha=0.8)
        for j, name in enumerate(RR_LEAGUES):
            im = rr_icon(f'league-{name}', 165)
            u = (bt - 0.3 - j * 0.12) / 0.3
            if im is None or u <= 0:
                continue
            ang = (j - 3.5) * 0.36
            put(canvas, im, W / 2 + math.sin(ang) * 470, 1380 - math.cos(ang) * 300, scale=out_back(u, 1.8))
        slam(canvas, 'RANKED', 240, None, W / 2, 380, bt, gold=True)
        slam(canvas, 'JUST CHANGED', 140, WHITE, W / 2, 590, bt - 0.8)
        slam(canvas, '7 THINGS TO KNOW', 96, (255, 235, 170), W / 2, 1700, bt - 2.0)
        shake, flash = hits(bt, (0, 0.8, 2.0), 1.3, 0.5)
    elif k == 'r_change':
        c = s['c']; col = c['col']
        canvas = background(t, col).convert('RGBA')
        put_rays(canvas, col, t, W / 2, 720, speed=40, alpha=0.8)
        put(canvas, pill(f"{s['i'] + 1}/{len(RR)}", (12, 14, 30), size=64), W / 2, 400, scale=out_back(bt / 0.3, 1.8))
        icon = rr_icon(c['icon'], 300)
        if icon is not None:
            put(canvas, icon, W / 2, 720, scale=1 + 0.4 * (1 - out_back(bt / 0.45, 1.6)))
        slam(canvas, c['big'], 160, None, W / 2, 1060, bt - 0.4, gold=True)
        if bt > 0.9:
            put(canvas, fit(c['line'], 82, W - 120, WHITE, stroke=7), W / 2, 1220, scale=out_back((bt - 0.9) / 0.35))
        if c['was'] and bt > 1.6:
            put(canvas, pill(c['was'], (70, 74, 110), size=58), W / 2, 1390, scale=out_back((bt - 1.6) / 0.35, 1.8))
        if c['note'] and bt > 2.3:
            put(canvas, fit(c['note'], 58, W - 140, (255, 235, 170), stroke=5), W / 2, 1550 if c['was'] else 1400,
                alpha=clamp((bt - 2.3) * 3))
        shake, flash = hits(bt, (0.4, 1.6), 1.1, 0.4)
    else:  # r_outro
        canvas = background(t, (255, 170, 40)).convert('RGBA'); mark = False
        put_rays(canvas, (255, 220, 120), t, W / 2, 700, speed=60, alpha=0.7)
        slam(canvas, 'GOOD', 210, WHITE, W / 2, 520, bt)
        slam(canvas, 'OR BAD?', 210, None, W / 2, 730, bt - 0.5, gold=True)
        slam(canvas, 'TELL US IN THE COMMENTS', 62, WHITE, W / 2, 900, bt - 1.2)
        follow_cta(canvas, bt - 2.0, 1240, 'NEW SEASON: NOV 19')
        if bt > 2.6:
            put(canvas, text_sprite('BEST PICKS: BRAWLZONE.NET', 58, WHITE, stroke=5), W / 2, 1600, alpha=clamp(bt - 2.6))
        shake, flash = hits(bt, (0, 0.5, 1.2), 1.3, 0.5)
    return finish(canvas, shake, flash, mark)


# ================================================================ plan
# --plan <dir> (2026-11-13): the same video as data for deploy/motion, the
# Remotion renderer that draws the formats it knows instead of the frames
# below (owner: "the design is still the same... make them way better").
# Everything that decides what a video says stays here: the picks, the
# levels, the clues, the timeline in beats. What gets written: <dir>/plan.json
# and the pictures it names under <dir>/public (brawler art and faces, each
# quiz clue already pixelated, shadowed or with its zoom window), so the two
# render paths can never disagree on content.
PLAN_KINDS = ('quiz', 'shadowquiz', 'zoomquiz', 'skinquiz', 'iconquiz', 'everyrank', 'classrank', 'seasonclimb')


def export_plan(out):
    A = f'{out}/public'
    for d in ('b', 'c'):
        os.makedirs(f'{A}/{d}', exist_ok=True)

    def save(img, rel):
        if not os.path.exists(f'{A}/{rel}'):
            img.save(f'{A}/{rel}')
        return rel

    def bz(b, full=False, face=True):
        o = {'id': str(b['id']), 'name': nice(b['n']).upper(), 'tier': b.get('tier'), 'wr': b.get('wr'),
             'use': b.get('use'), 'cls': b.get('cls'), 'rar': b.get('rar')}
        if b.get('skin'): o['skin'] = b['skin']
        if b.get('ability'): o['ability'] = {'kind': b['ability']['kind'], 'label': ICON_LABEL[b['ability']['kind']],
                                             'name': (b['ability'].get('name') or '').upper()}
        if face and not str(b['id']).startswith('skin_'):
            o['face'] = save(load_face(b).resize((256, 256), Image.LANCZOS), f"b/{b['id']}-face.png")
        if full:
            o['art'] = save(art(b, 1000, 1000), f"b/{b['id']}-art.png")
        return o

    segs = []
    for s in tl.segments:
        k = s['kind']; o = {'kind': k, 'start': s['start'], 'len': s['len']}
        if k == 'q_intro':
            o.update(n=s['n'], style=s.get('style'),
                     faces=[save(shadow_face(b), f"c/decoy-{b['id']}.png") for b in s['faces']])
        elif k == 'q':
            b, i, clue, lvl = s['b'], s['i'], s['clue'], s['lvl']
            a = art(b, 820)
            o.update(i=i, lvl=lvl, clue=clue, style=s.get('style'), b=bz(b, full=True, face=False))
            label = CLUES.get(clue, 'WHO IS THIS?')
            if s.get('style') == 'skin': label = CLUES['skin']
            if clue == 'skin':
                o['img'] = [save(fit_in(a, 780), f'c/{i}-skin.png')]
            elif clue == 'pixel':
                o['img'] = [save(pixelated(fit_in(a, 790), PIXEL_STEPS[lvl][st]), f'c/{i}-px{st}.png') for st in range(4)]
            elif clue == 'shadow':
                o['img'] = [save(fit_in(partial_shadow(b, a, lvl), 800), f'c/{i}-shadow.png')]
            elif clue == 'icon':
                ab = b['ability']; icon = ability_icon(ab)
                o['img'] = ([save(pixelated(icon, ICON_PIXELS[st]), f'c/{i}-icon{st}.png') for st in range(4)]
                            if b.get('pixelate') else [save(icon, f'c/{i}-icon.png')])
                label = f"WHOSE {ICON_LABEL[ab['kind']]}?"
                o['tab'] = {'label': ICON_LABEL[ab['kind']], 'color': '#%02x%02x%02x' % ICON_COL[ab['kind']]}
            else:  # zoom: the big render and where to look; the pull-back is animated there
                m = art(b, 900); cx, cy = zoom_center(b, m, lvl)
                hi = art(b, 900 * HI_ZOOM, 900 * HI_ZOOM); kk = hi.width / m.width
                o['zoom'] = {'img': save(hi, f'c/{i}-zoom.png'), 'w': hi.width, 'h': hi.height, 'cx': cx * kk, 'cy': cy * kk,
                             's0': 760 * kk, 'from': ZOOM_FROM[lvl], 'pull': ZOOM_PULL}
            o['label'] = label
        elif k == 'q_outro':
            o.update(n=s['n'], picks=[bz(b) for b in s['picks']])
        elif k in ('c_slam',):
            o.update(tier=s['tier'], label=s.get('label'))
        elif k in ('c_page', 'c_rows'):
            o.update(tier=s.get('tier'), label=s.get('label'), items=[{'rank': r, **bz(b)} for r, b in s['items']])
        elif k in ('c_big', 'c_one', 'c_tease'):
            b = s['b']; o.update(rank=s.get('rank', 1), heavy=bool(s.get('heavy')), b=bz(b, full=True))
            if k == 'c_tease':
                o['sil'] = save(silhouette(art(b, 900, 1000), (255, 200, 60)), f"c/tease-{b['id']}.png")
        segs.append(o)
    plan = {'kind': KIND, 'fps': FPS, 'step': tl.step, 'beats': tl.beats, 'duration': round(tl.dur, 3), 'period': P,
            'track': os.environ.get('TRACK') or 'fontana', 'episode': episode(KIND), 'segments': segs,
            'title': META.get('title')}
    if KIND in ('everyrank', 'classrank', 'seasonclimb'):
        plan.update(word=WORD, bestLine=BEST_LINE, season=data.get('season'), count=NB,
                    wall=[save(load_face(b).resize((200, 200), Image.LANCZOS), f"b/{b['id']}-face.png") for b in ranked])
    json.dump(plan, open(f'{out}/plan.json', 'w'), ensure_ascii=False)
    print(KIND, 'plan', len(segs), 'segments', round(tl.dur, 2), 's')


SCENE = {'quiz': quiz_scene, 'shadowquiz': quiz_scene, 'zoomquiz': quiz_scene, 'skinquiz': quiz_scene, 'iconquiz': quiz_scene,
         'broken': broken_scene, 'ranks': ranks_scene, 'modes': modes_scene,
         'newbrawler': nb_scene, 'daily': daily_scene, 'everyrank': count_scene, 'classrank': count_scene, 'seasonclimb': count_scene,
         'stop': stop_scene, 'giveaway': giveaway_scene, 'drops': drops_scene, 'whatsnew': wn_scene,
         'rankedrefresh': rr_scene}[KIND]


def frame(t):
    s, bt, lt = tl.at(t)
    return SCENE(s, t, bt, lt)


if __name__ == '__main__':
    os.makedirs(f'{OUT}/frames', exist_ok=True)
    META['duration'] = round(tl.dur, 3)
    META['kind'] = KIND
    META['episode'] = episode(KIND)
    if SHOWN: META['shown'] = SHOWN
    json.dump(META, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False)
    if '--plan' in sys.argv[6:7]:
        if KIND not in PLAN_KINDS:
            print(f'{KIND} has no Remotion design yet'); sys.exit(4)
        export_plan(OUT); sys.exit()
    if ONLY is not None:
        for sec in ONLY:
            frame(sec).save(f'{OUT}/{KIND}-{sec}.jpg', quality=85)
        print(KIND, 'duration', round(tl.dur, 2)); sys.exit()
    n = int(tl.dur * FPS); part, parts = int(os.environ.get('PART', 0)), int(os.environ.get('PARTS', 1))
    for i in range(n):
        if i % parts != part or os.path.exists(f'{OUT}/frames/{i:04d}.jpg'): continue
        frame(i / FPS).save(f'{OUT}/frames/{i:04d}.jpg', quality=92)
    print(KIND, 'frames', n, 'duration', round(tl.dur, 2))
