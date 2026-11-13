"""Drawing helpers for the daily viral Short (deploy/viral/make.py), 2026-10-22.

Moved here from the hand-run engine in ~/shots/viral2/render.py, which made
"Every brawler ranked" (2026-10-21): frame-by-frame 1080x1920 motion graphics,
every slam, shake and flash on the beat of one track. Nothing here knows about
a particular video; make.py builds the timelines.
"""
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

W, H, FPS = 1080, 1920, 30
# Every cut lands on the beat of the track in $TRACK (tracks.json beside this
# file; Fontana, 129 BPM, when unset), from the YouTube Audio Library, cut in
# at its `start`. Fontana's period came from ~/shots/viral2/beats.py; the
# others (2026-10-28) from librosa's beat tracker, keeping only tracks whose
# beats sit within ~40 ms of a straight grid -- a track that drifts puts
# every cut visibly off the music.
TRACKS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tracks.json')))
_track = TRACKS[os.environ.get('TRACK') or 'fontana']
MUSIC, MUSIC_START, P = _track['file'], _track['start'], _track['period']
# Every format was paced against Fontana's beat; Timeline rescales to it so a
# faster or slower track keeps the video about as long.
BASE_P = 0.4644
# Fonts, the app icon, and per-brawler art (models/, faces/), all under ASSETS.
ASSETS = os.environ.get('ASSETS', '.')
NAVY = (9, 12, 26)
WHITE = (250, 250, 255)
GOLD_TOP, GOLD_BOT = (255, 236, 120), (255, 160, 20)
TIER = {'S': (255, 60, 100), 'A': (255, 140, 40), 'B': (255, 205, 40), 'C': (70, 215, 120),
        'D': (60, 170, 255), 'E': (150, 105, 255), 'F': (125, 135, 170)}
TIER_NAME = {'S': 'S TIER', 'A': 'A TIER', 'B': 'B TIER', 'C': 'C TIER', 'D': 'D TIER', 'E': 'E TIER', 'F': 'F TIER'}
LIL = f'{ASSETS}/LilitaOne-Regular.ttf'; GEI = f'{ASSETS}/Geist-Regular.ttf'
# The headline font (owner, 2026-11-03): Nougat Extra Black, the game's own,
# from the Fan Kit's fonts page. Licensed to the Fan Kit, not to us to pass on,
# so it lives only in the cache (fonts/), never in the repo or on the site:
# a copy with narrower word spaces and a narrower "1" (the original's are
# 0.54em and tabular). Without it, or for a character it lacks (€, →), Lilita.
NOU = f'{ASSETS}/fonts/Nougat-ExtraBlack-tight.ttf'
HEAD = NOU if os.path.exists(NOU) else LIL
try: NOU_CHARS = set(open(f'{ASSETS}/fonts/Nougat-ExtraBlack-tight.chars', encoding='utf-8').read()) | {' '}
except OSError: NOU_CHARS = set()
_fonts = {}
def F(s):
    if ('H', s) not in _fonts: _fonts[('H', s)] = ImageFont.truetype(HEAD, s)
    return _fonts[('H', s)]
def L(s):
    if ('L', s) not in _fonts: _fonts[('L', s)] = ImageFont.truetype(LIL, s)
    return _fonts[('L', s)]
def head_for(txt):
    """F, unless the headline font lacks one of txt's characters."""
    return F if HEAD == LIL or set(txt) <= NOU_CHARS else L
def G(s):
    if ('G', s) not in _fonts: _fonts[('G', s)] = ImageFont.truetype(GEI, s)
    return _fonts[('G', s)]

def nice(n): return ' '.join(w.capitalize() for w in n.split(' '))

# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def out_cubic(t): t = clamp(t); return 1 - (1 - t) ** 3
def out_back(t, s=1.9): t = clamp(t) - 1; return 1 + (s + 1) * t ** 3 + s * t ** 2
def in_cubic(t): t = clamp(t); return t ** 3
def in_out(t): t = clamp(t); return 3 * t * t - 2 * t * t * t

# ---------------------------------------------------------------- assets
def interim_path(b, full=False):
    """Our own crop for a brawler no source has art for yet (2026-11-04: Rey
    and Ruby, from Supercell's reveal; public/icons/interim, copied to
    $ASSETS/interim by brawlzone-viral). Real art always comes first."""
    return f"{ASSETS}/interim/{b['id']}{'-full' if full else ''}.png"

def load_face(b):
    p = f"{ASSETS}/faces/{b['id']}.png"
    if os.path.exists(p):
        return Image.open(p).convert('RGBA')
    if os.path.exists(interim_path(b)):
        return Image.open(interim_path(b)).convert('RGBA')
    # A brawler too new for Brawlify's portraits: a plain tile with their initial.
    im = Image.new('RGBA', (256, 256), (40, 46, 96, 255)); d = ImageDraw.Draw(im)
    d.text((128, 128), b['n'][:1].upper(), font=ImageFont.truetype(LIL, 170), fill=WHITE, anchor='mm')
    return im

def load_model(b):
    p = f"{ASSETS}/models/{b['id']}.png"
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None

def has_model(b):
    """Whether a full body exists, without decoding it: the Fan Kit's are
    ~2,000px tall, and the quiz asks this of every brawler."""
    return os.path.exists(f"{ASSETS}/models/{b['id']}.png")

def has_art(b):
    """A full body, or an interim crop that art() can frame instead. Only for
    showing a brawler: a quiz needs a real cut-out, so it asks has_model."""
    return has_model(b) or os.path.exists(interim_path(b, True))

def vgrad(w, h, top, bot):
    a = np.linspace(0, 1, h)[:, None, None]
    arr = (np.array(top)[None, None, :] * (1 - a) + np.array(bot)[None, None, :] * a)
    return Image.fromarray(np.repeat(arr, w, axis=1).astype('uint8'), 'RGB')

def radial_mask(w, h, cx, cy, r):
    y, x = np.ogrid[:h, :w]
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    return Image.fromarray((np.clip(1 - d, 0, 1) ** 1.6 * 255).astype('uint8'), 'L')

# The look from 2026-11-13 (owner: "really nice designs and attractive"): the
# scene's own colour carries the whole frame, deep at the edges and lit in the
# middle where the subject stands, with comic halftone at the top and bottom
# and slow light bands. The navy backdrop it replaces made every format read
# dark and alike in a feed.
def shade(col, k): return tuple(int(clamp(c * k, 0, 255)) for c in col)
def mixc(a, b, t): return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))

GLOW = radial_mask(W, H, W / 2, H * 0.45, 1250)
VIGN = Image.fromarray((np.clip(np.sqrt(((np.ogrid[:H, :W][1] - W / 2) / (W * 0.75)) ** 2 + ((np.ogrid[:H, :W][0] - H / 2) / (H * 0.75)) ** 2), 0, 1) ** 2 * 200).astype('uint8'), 'L')
# light bands, drawn once twice the needed size and scrolled
STRIPES = Image.new('L', (W * 2, H * 2), 0)
_d = ImageDraw.Draw(STRIPES)
for x in range(-H * 2, W * 2, 150):
    _d.polygon([(x, 0), (x + 56, 0), (x + 56 + H * 2, H * 2), (x + H * 2, H * 2)], fill=20)
def _halftone():
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m); step = 30
    for yi, y in enumerate(range(0, H + step, step)):
        e = max(0.0, 1 - y / (H * 0.3), (y - H * 0.7) / (H * 0.3))
        if e <= 0: continue
        r = step * 0.46 * e ** 0.8; off = step / 2 if yi % 2 else 0
        for x in range(-step, W + step, step):
            d.ellipse((x + off - r, y - r, x + off + r, y + r), fill=255)
    return m
HALFTONE = _halftone()
_bg_cache = {}
def tier_bg(col):
    if col not in _bg_cache:
        im = vgrad(W, H, mixc(shade(col, 0.42), NAVY, 0.3), mixc(shade(col, 0.2), NAVY, 0.45))
        im.paste(mixc(col, (255, 255, 255), 0.12), (0, 0), GLOW.point(lambda v: int(v * 0.85)))
        im.paste(mixc(shade(col, 0.12), NAVY, 0.5), (0, 0), HALFTONE.point(lambda v: int(v * 0.42)))
        _bg_cache[col] = im
    return _bg_cache[col]

def _sparkle(r):
    """A four-point star with a soft halo, the game's own glint."""
    S = int(r * 6); im = Image.new('L', (S, S), 0); d = ImageDraw.Draw(im); c = S / 2
    d.polygon([(c, c - r * 2.6), (c + r * 0.42, c - r * 0.42), (c + r * 2.6, c), (c + r * 0.42, c + r * 0.42),
               (c, c + r * 2.6), (c - r * 0.42, c + r * 0.42), (c - r * 2.6, c), (c - r * 0.42, c - r * 0.42)], fill=255)
    halo = im.filter(ImageFilter.GaussianBlur(r * 0.9)).point(lambda v: int(v * 0.7))
    out = Image.new('RGBA', (S, S), (255, 255, 255, 0)); out.putalpha(ImageChops.lighter(im, halo))
    return out
random.seed(7)
SPARKS = [(random.uniform(0, W), random.uniform(0, H), random.uniform(20, 60), random.choice((5, 7, 9)), random.uniform(0, 6.28)) for _ in range(34)]
_spark_img = {r: _sparkle(r) for r in (5, 7, 9)}
_spark_big = {r: _sparkle(r * 2) for r in (5, 7, 9)}

def background(t, col, col2=None, mix=0.0):
    im = tier_bg(col).copy()
    if col2 is not None and mix > 0:
        im = Image.blend(im, tier_bg(col2), clamp(mix))
    off = int(t * 60) % 300
    im.paste((255, 255, 255), (0, 0), STRIPES.crop((off, off, off + W, off + H)))
    im = im.convert('RGBA')
    for x, y, v, r, ph in SPARKS:
        a = 0.5 + 0.5 * math.sin(t * 2.6 + ph)
        if a < 0.15: continue
        yy = (y - t * v) % H; xx = x + math.sin(t * 1.1 + ph) * 16
        sp = _spark_img[r]
        if a < 0.98:
            sp = sp.copy(); sp.putalpha(sp.getchannel('A').point(lambda q: int(q * a)))
        im.alpha_composite(sp, (int(xx - sp.width / 2), int(yy - sp.height / 2)))
    return im  # RGBA; callers' .convert('RGBA') is then a plain copy

# ---------------------------------------------------------------- text
_txt = {}
def text_sprite(txt, size, fill=WHITE, gold=False, stroke=10, shadow=True, font=None):
    key = (txt, size, fill, gold, stroke, shadow, font)
    if key in _txt: return _txt[key]
    face_of = font or head_for(txt)
    f = face_of(size)
    l, t_, r, b = f.getbbox(txt, stroke_width=stroke)
    # Never wider than the frame less a margin: Nougat runs ~10% wider than
    # the Lilita the layouts were drawn for, and long names ("Larry & Lawrie")
    # went off the edges.
    while r - l > W - 90 and size > 24:
        size = max(24, int(size * (W - 90) / (r - l)))
        f = face_of(size)
        l, t_, r, b = f.getbbox(txt, stroke_width=stroke)
    w, h = r - l + 30, b - t_ + 40
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).text((15 - l, 15 - t_), txt, font=f, fill=255)
    outline = Image.new('L', (w, h), 0)
    ImageDraw.Draw(outline).text((15 - l, 15 - t_), txt, font=f, fill=255, stroke_width=stroke, stroke_fill=255)
    out = Image.new('RGBA', (w, h + 14), (0, 0, 0, 0))
    if shadow:  # a soft drop, then a solid extrude stepped down to the letters (2026-11-13: deeper, the game's 3D titles)
        drop = Image.new('L', (w, h + 14), 0); drop.paste(outline, (0, 14))
        out.paste(Image.new('RGBA', (w, h + 14), (0, 0, 0, 150)), (0, 0), drop.filter(ImageFilter.GaussianBlur(6)))
        depth = max(4, min(14, size // 12))
        for dy in range(depth, 0, -2):
            out.paste(Image.new('RGBA', (w, h), (4, 5, 14, 255)), (0, dy), outline)
    out.paste(Image.new('RGBA', (w, h), (12, 14, 30, 255)), (0, 0), outline)
    face = vgrad(w, h, GOLD_TOP, GOLD_BOT).convert('RGBA') if gold else Image.new('RGBA', (w, h), fill + (255,))
    out.paste(face, (0, 0), mask)
    # a glossy band across the top third of the letters
    gloss = Image.new('L', (w, h), 0); ImageDraw.Draw(gloss).rectangle((0, 0, w, int(h * 0.42)), fill=46)
    out.paste(Image.new('RGBA', (w, h), (255, 255, 255, 255)), (0, 0), ImageChops.multiply(gloss, mask))
    _txt[key] = out
    return out

def put(canvas, sprite, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if scale <= 0.01 or alpha <= 0.01: return
    s = sprite
    if scale != 1.0:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.BILINEAR)
    if rot: s = s.rotate(rot, resample=Image.BILINEAR, expand=True)
    if alpha < 1.0:
        s = s.copy(); s.putalpha(s.getchannel('A').point(lambda v: int(v * alpha)))
    canvas.alpha_composite(s, (int(cx - s.width / 2), int(cy - s.height / 2)))

# ---------------------------------------------------------------- cards
def rounded_mask(w, h, r):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return m

_cards = {}
def card(rank, b, w=290, h=350):
    key = (rank, w, h)
    if key in _cards: return _cards[key]
    col = TIER[b['tier']]
    lite = tuple(min(255, int(c * 0.55 + 255 * 0.45)) for c in col)
    dark = tuple(int(c * 0.45) for c in col)
    pad = 26
    out = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh = Image.new('L', out.size, 0); ImageDraw.Draw(sh).rounded_rectangle((pad, pad + 14, pad + w, pad + h + 14), 40, fill=170)
    out.paste(Image.new('RGBA', out.size, (0, 0, 0, 255)), (0, 0), sh.filter(ImageFilter.GaussianBlur(14)))
    body = vgrad(w, h, lite, dark).convert('RGBA')
    inner = Image.new('RGBA', (w - 28, w - 28), (14, 18, 40, 255))
    face = load_face(b).resize((w - 40, w - 40), Image.LANCZOS)
    inner.alpha_composite(face, (6, 6))
    body.paste(inner, (14, 14), rounded_mask(w - 28, w - 28, 26))
    hl = Image.new('L', (w, h), 0); ImageDraw.Draw(hl).rounded_rectangle((6, 6, w - 7, h // 2), 34, fill=40)
    body.paste(Image.new('RGBA', (w, h), (255, 255, 255, 255)), (0, 0), hl)
    border = Image.new('L', (w, h), 0); ImageDraw.Draw(border).rounded_rectangle((0, 0, w - 1, h - 1), 36, outline=255, width=5)
    body.paste(Image.new('RGBA', (w, h), (255, 255, 255, 255)), (0, 0), border)
    out.paste(body, (pad, pad), rounded_mask(w, h, 36))
    d = ImageDraw.Draw(out)
    nm = nice(b['n']); fs = 44
    while F(fs).getlength(nm) > w - 24 and fs > 24: fs -= 2
    nx = pad + (w - F(fs).getlength(nm)) / 2; ny = pad + w - 4 + (h - w - fs) / 2 - 6
    d.text((nx, ny), nm, font=F(fs), fill=WHITE, stroke_width=4, stroke_fill=(10, 12, 28))
    tag = f'#{rank}'; tf = F(46); tw = tf.getlength(tag)
    d.rounded_rectangle((pad - 12, pad - 14, pad - 12 + tw + 30, pad - 14 + 62), 22, fill=(10, 12, 28), outline=GOLD_BOT, width=3)
    d.text((pad + 3, pad - 12), tag, font=tf, fill=GOLD_TOP)
    _cards[key] = out
    return out

def silhouette(img, col):
    a = img.getchannel('A')
    out = Image.new('RGBA', img.size, (6, 8, 18, 255)); out.putalpha(a)
    rim = a.filter(ImageFilter.MaxFilter(9))
    glow = Image.new('RGBA', img.size, col + (255,)); glow.putalpha(ImageChops.subtract(rim, a).filter(ImageFilter.GaussianBlur(4)))
    glow.alpha_composite(out)
    return glow

_pills = {}
def tier_pill(tier):
    if tier in _pills: return _pills[tier]
    label = text_sprite(TIER_NAME[tier], 72, WHITE, stroke=7)
    w, h = label.width + 50, 130
    pill = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(pill)
    d.rounded_rectangle((0, 10, w - 1, h - 1), 50, fill=(10, 12, 28))
    d.rounded_rectangle((0, 0, w - 1, h - 12), 50, fill=TIER[tier], outline=(10, 12, 28), width=6)
    pill.alpha_composite(label, ((w - label.width) // 2, (h - 12 - label.height) // 2 + 4))
    _pills[tier] = pill
    return pill

_rays = {}
def rays(col, n=18):
    if col in _rays: return _rays[col]
    S = 2400
    m = Image.new('L', (S, S), 0); d = ImageDraw.Draw(m)
    for i in range(n):
        a0 = i * 2 * math.pi / n; a1 = a0 + math.pi / n * 0.55
        d.polygon([(S / 2, S / 2), (S / 2 + S * math.cos(a0), S / 2 + S * math.sin(a0)), (S / 2 + S * math.cos(a1), S / 2 + S * math.sin(a1))], fill=120)
    m = ImageChops.multiply(m, radial_mask(S, S, S / 2, S / 2, S / 2))
    r = Image.new('RGBA', (S, S), col + (255,)); r.putalpha(m)
    _rays[col] = r
    return r

def put_rays(canvas, col, t, cx, cy, speed=12, alpha=1.0):
    r = rays(col).rotate(t * speed, resample=Image.BILINEAR)
    if alpha < 1: r = r.copy(); r.putalpha(r.getchannel('A').point(lambda v: int(v * alpha)))
    canvas.alpha_composite(r, (int(cx - r.width / 2), int(cy - r.height / 2)))

random.seed(3)
CONFETTI = [(random.uniform(-100, W + 100), random.uniform(-900, -20), random.uniform(260, 520), random.uniform(-80, 80),
             random.uniform(0, 360), random.uniform(-400, 400), random.choice([GOLD_TOP, (255, 90, 120), (90, 200, 255), WHITE, (120, 230, 140)]),
             random.uniform(14, 26)) for _ in range(170)]
def confetti(canvas, t):
    d = ImageDraw.Draw(canvas)
    for x, y, vy, vx, a0, va, col, s in CONFETTI:
        yy = y + vy * t; xx = x + vx * t + math.sin(t * 4 + a0) * 25
        if yy > H + 50: continue
        ang = math.radians(a0 + va * t); w = s * abs(math.cos(ang * 1.7)) + 3
        pts = [(xx + math.cos(ang) * w - math.sin(ang) * s * 0.4, yy + math.sin(ang) * w + math.cos(ang) * s * 0.4),
               (xx - math.cos(ang) * w - math.sin(ang) * s * 0.4, yy - math.sin(ang) * w + math.cos(ang) * s * 0.4),
               (xx - math.cos(ang) * w + math.sin(ang) * s * 0.4, yy - math.sin(ang) * w - math.cos(ang) * s * 0.4),
               (xx + math.cos(ang) * w + math.sin(ang) * s * 0.4, yy + math.sin(ang) * w - math.cos(ang) * s * 0.4)]
        d.polygon(pts, fill=col)

def crown(size):
    im = Image.new('RGBA', (size, int(size * 0.75)), (0, 0, 0, 0)); d = ImageDraw.Draw(im); s = size
    pts = [(0.05 * s, 0.7 * s), (0.05 * s, 0.25 * s), (0.28 * s, 0.45 * s), (0.5 * s, 0.05 * s), (0.72 * s, 0.45 * s), (0.95 * s, 0.25 * s), (0.95 * s, 0.7 * s)]
    d.polygon(pts, fill=GOLD_BOT, outline=(90, 50, 0), width=8)
    d.rectangle((0.05 * s, 0.6 * s, 0.95 * s, 0.72 * s), fill=GOLD_TOP, outline=(90, 50, 0), width=6)
    for cx in (0.05, 0.5, 0.95):
        d.ellipse((cx * s - 0.06 * s, (0.25 if cx != 0.5 else 0.05) * s - 0.06 * s, cx * s + 0.06 * s, (0.25 if cx != 0.5 else 0.05) * s + 0.06 * s), fill=(255, 80, 110), outline=(90, 50, 0), width=5)
    return im

APP = Image.open(f'{ASSETS}/app-icon.png').convert('RGBA')
INK = (12, 14, 30)

def magnifier(size, col=INK, width=None):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    w = width or max(4, size // 7); r = size * 0.3; c = size * 0.42
    d.ellipse((c - r, c - r, c + r, c + r), outline=col, width=w)
    d.line((c + r * 0.72, c + r * 0.72, size * 0.9, size * 0.9), fill=col, width=int(w * 1.25))
    return im

_boxes = {}
def search_box(text, width, height, typed=None, cursor=False, button=True):
    """A search field with `text` typed in it (the first `typed` characters):
    white, outlined, on a dark lip. The address at the top of every frame and
    the closing call to action both look like one (2026-11-13): most people
    find the site by typing its name after seeing a video."""
    n = len(text) if typed is None else typed
    key = (text, width, height, n, cursor, button)
    if key in _boxes: return _boxes[key]
    lip = max(6, height // 12); r = height // 2
    im = Image.new('RGBA', (width, height + lip), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, lip, width - 1, height + lip - 1), r, fill=INK)
    d.rounded_rectangle((0, 0, width - 1, height - 1), r, fill=WHITE, outline=INK, width=max(4, height // 18))
    icon = APP.resize((int(height * 0.7),) * 2, Image.LANCZOS)
    im.alpha_composite(icon, (int(height * 0.18), int(height * 0.15)))
    f = L(int(height * 0.52)); x0 = int(height * 1.02)
    shown = text[:n]
    d.text((x0, height * 0.47), shown, font=f, fill=INK, anchor='lm')
    if cursor:
        cx = x0 + f.getlength(shown) + 6
        d.rectangle((cx, height * 0.24, cx + max(4, height // 22), height * 0.72), fill=(40, 120, 255))
    if button:
        b = int(height * 0.78); bx = width - b - int(height * 0.12); by = int((height - b) / 2)
        d.ellipse((bx, by + 4, bx + b, by + b + 4), fill=shade(GOLD_BOT, 0.55))
        d.ellipse((bx, by, bx + b, by + b), fill=GOLD_BOT, outline=INK, width=max(3, height // 30))
        im.alpha_composite(magnifier(int(b * 0.66)), (bx + int(b * 0.17), by + int(b * 0.16)))
    _boxes[key] = im
    return im

def watermark(canvas):
    canvas.alpha_composite(search_box('brawlzone.net', 470, 82), ((W - 470) // 2, 160))

# ---------------------------------------------------------------- timeline
# Built in beats. Each segment: (start beat, length in beats, kind, payload).

# ---------------------------------------------------------------- timeline
def impact(lt, k=1.0):
    """Shake and flash right after a hit at lt=0 (seconds)."""
    return max(0.0, 1 - lt / 0.22) * k


class Timeline:
    """Segments measured in beats; at(t) finds the one playing at t seconds.

    Two ways to slow a video down (2026-10-23: "too fast, keep them a little
    slower"), both still on the music:

    pace  beats per step. 2 is half-time: every animation step, countdown
          number and cut lands on every other beat, so a quiz round gives
          ~3.7s to guess instead of ~1.9s. For the formats you have to think in.
    hold  each scene lasts this many times longer, its animations unchanged:
          the same punch, then time to read. For the list formats.
    """

    def __init__(self, pace=1, hold=1.0):
        self.segments, self.beats = [], 0
        scale = BASE_P / P
        if pace > 1:
            # Steps stay on the beat or the half beat, as near Fontana's length as that allows.
            pace = max(1.0, round(pace * scale * 2) / 2)
        else:
            hold *= scale
        self.step = P * pace
        self.hold = hold

    def add(self, length, kind, **kw):
        length = math.ceil(length * self.hold)
        self.segments.append({'start': self.beats, 'len': length, 'kind': kind, **kw})
        self.beats += length

    @property
    def dur(self):
        return self.beats * self.step

    def at(self, t):
        bt = t / self.step
        for s in self.segments:
            if s['start'] <= bt < s['start'] + s['len']:
                return s, bt - s['start'], t - s['start'] * self.step
        s = self.segments[-1]
        return s, s['len'], s['len'] * self.step


def hits(bt, beats, k=1.0, glare=0.3):
    """Shake and flash for slams landing on each of `beats` (in beats)."""
    shake = flash = 0.0
    for at in beats:
        if 0 <= bt - at < 0.5:
            shake = max(shake, impact((bt - at) * P, k)); flash = max(flash, impact((bt - at) * P) * glare)
    return shake, flash


# ---------------------------------------------------------------- pieces
def pill(text, col, fg=WHITE, size=60):
    label = text_sprite(text, size, fg, stroke=6)
    w, h = label.width + 50, label.height + 26
    im = Image.new('RGBA', (w, h + 10), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 10, w - 1, h + 9), h // 2, fill=(10, 12, 28))
    d.rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=col, outline=(10, 12, 28), width=6)
    im.alpha_composite(label, ((w - label.width) // 2, (h - label.height) // 2 + 2))
    return im


def slam(canvas, txt, size, col, x, y, u, gold=False, k=1.5):
    """Text that lands from big to its size over half a beat; u in beats since it started."""
    if u < 0: return
    put(canvas, text_sprite(txt, size, col or WHITE, gold=gold), x, y, scale=1 + k * (1 - out_back(u / 0.55, 1.2)) if u < 0.55 else 1)


def arrow(canvas, x, y, col=GOLD_TOP, flip=False):
    a = Image.new('RGBA', (220, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(a)
    d.polygon([(70, 0), (150, 0), (150, 130), (210, 130), (110, 250), (10, 130), (70, 130)], fill=col, outline=(10, 12, 28), width=10)
    put(canvas, a.rotate(180) if flip else a, x, y)


_follow = None
def follow_button():
    """A generic "+ FOLLOW" button: a plain pill, nothing borrowed from any app."""
    global _follow
    if _follow is None:
        label = text_sprite('FOLLOW', 88, WHITE, stroke=7)
        h = 150; w = label.width + 190
        im = Image.new('RGBA', (w, h + 14), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 14, w - 1, h + 13), h // 2, fill=(10, 12, 28))
        d.rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=(255, 52, 92), outline=(10, 12, 28), width=7)
        d.ellipse((22, 22, h - 22, h - 22), fill=WHITE, outline=(10, 12, 28), width=5)
        c = h // 2; r = 26
        d.rectangle((c - r, c - 8, c + r, c + 8), fill=(255, 52, 92)); d.rectangle((c - 8, c - r, c + 8, c + r), fill=(255, 52, 92))
        im.alpha_composite(label, (h - 10, (h - label.height) // 2 + 4))
        _follow = im
    return _follow


def follow_cta(canvas, u, y, line, sub=None):
    """The follow ask that closes every video: the button pops, pulses, and a
    hand-drawn tap ring goes out from it each beat. u in beats since it starts.
    With `sub` (the site address, 2026-11-03), `line` is a small white lead-in
    and the address is typed into a big search box under it, a letter a frame
    group, cursor blinking, the search button pressed at the end (2026-11-13)."""
    if u < 0: return
    pulse = 1 + 0.06 * abs(math.sin(u * math.pi))
    if u > 0.6:
        ring = (u % 1.0); r = 90 + ring * 200
        layer = Image.new('RGBA', (W, 900), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse((W / 2 - r * 2.4, 450 - r, W / 2 + r * 2.4, 450 + r), outline=(255, 255, 255, int(170 * (1 - ring))), width=8)
        canvas.alpha_composite(layer, (0, int(y - 450)))
    put(canvas, follow_button(), W / 2, y, scale=out_back(u / 0.45, 2.2) * pulse)
    if sub:
        put(canvas, text_sprite(line, 56, WHITE, stroke=7), W / 2, y + 140, scale=out_back((u - 0.5) / 0.4))
        search_cta(canvas, u - 0.7, y + 262, sub.lower())
    else:
        put(canvas, text_sprite(line, 64, GOLD_TOP, stroke=7), W / 2, y + 150, scale=out_back((u - 0.5) / 0.4))


def search_cta(canvas, u, y, text='brawlzone.net', width=940, height=136):
    """The address typed into a search box; u in beats since it appears."""
    if u < 0: return
    n = int(clamp((u - 0.25) / 0.9) * len(text) + 0.5)
    done = n >= len(text)
    blink = (not done) or int(u * 3) % 2 == 0
    box = search_box(text, width, height, typed=n, cursor=blink)
    press = done and (u - 1.2) % 2.0 < 0.18
    put(canvas, box, W / 2, y, scale=out_back(u / 0.35, 1.8) * (0.97 if press else 1))
    if done and u > 1.2:  # a tap on the search button, each couple of beats
        k = ((u - 1.2) % 2.0) / 0.6
        if k < 1:
            bx = W / 2 + width / 2 - height * 0.51; layer = Image.new('RGBA', (400, 400), (0, 0, 0, 0)); rr = 40 + 120 * k
            ImageDraw.Draw(layer).ellipse((200 - rr, 200 - rr, 200 + rr, 200 + rr), outline=(255, 255, 255, int(220 * (1 - k))), width=8)
            canvas.alpha_composite(layer, (int(bx - 200), int(y - 200)))


_panels = {}
def panel(w, h, col, r=64, lit=False, inner=None):
    """A game-style card for a clue or a stat: the colour deep inside with a
    lit top, a thick dark outline, a light rim and a dark lip under it
    (2026-11-13). Returns (image, interior box) so callers can clip into it."""
    key = (w, h, col, r, lit, inner)
    if key not in _panels:
        ic = inner or col
        lip = 16; ow = 10; rim = 6
        im = Image.new('RGBA', (w, h + lip), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, lip, w - 1, h + lip - 1), r, fill=(4, 5, 14, 255))
        d.rounded_rectangle((0, 0, w - 1, h - 1), r, fill=INK)
        d.rounded_rectangle((ow, ow, w - 1 - ow, h - 1 - ow), r - ow, fill=mixc(col, (255, 255, 255), 0.35) if not lit else GOLD_TOP)
        ix0 = ow + rim; iw, ih = w - 2 * ix0, h - 2 * ix0
        inner = vgrad(iw, ih, mixc(shade(ic, 0.5), NAVY, 0.2), mixc(shade(ic, 0.18), NAVY, 0.5)).convert('RGBA')
        inner.paste(mixc(ic, (255, 255, 255), 0.1), (0, 0), radial_mask(iw, ih, iw / 2, ih * 0.42, iw * 0.75).point(lambda v: int(v * 0.6)))
        gl = Image.new('L', (iw, ih), 0); ImageDraw.Draw(gl).rounded_rectangle((8, 8, iw - 9, ih * 0.34), r - ix0, fill=22)
        inner.paste((255, 255, 255), (0, 0), gl)
        im.paste(inner, (ix0, ix0), rounded_mask(iw, ih, r - ix0))
        _panels[key] = (im, (ix0, ix0, ix0 + iw, ix0 + ih))
    return _panels[key]


def put_panel(canvas, w, h, col, cx, cy, content=None, scale=1.0, lit=False, inner=None):
    """A panel with `content` (RGBA, interior-sized or smaller, centred)
    clipped inside it."""
    im, (x0, y0, x1, y1) = panel(w, h, col, lit=lit, inner=inner)
    if content is not None:
        im = im.copy(); iw, ih = x1 - x0, y1 - y0
        layer = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
        layer.alpha_composite(content, ((iw - content.width) // 2, (ih - content.height) // 2)) if content.width <= iw and content.height <= ih \
            else layer.alpha_composite(content.crop(((content.width - iw) // 2, (content.height - ih) // 2, (content.width - iw) // 2 + iw, (content.height - ih) // 2 + ih)))
        m = rounded_mask(iw, ih, 48)
        layer.putalpha(ImageChops.multiply(layer.getchannel('A'), m))
        im.alpha_composite(layer, (x0, y0))
    put(canvas, im, cx, cy, scale=scale)


_ribbons = {}
def ribbon(text, col, size=150, maxw=None):
    """The answer on a banner with folded tails (2026-11-13)."""
    key = (text, col, size, maxw)
    if key not in _ribbons:
        maxw = maxw or W - 120
        lab = text_sprite(text, size, WHITE, stroke=9)
        if lab.width > maxw - 170:
            k = (maxw - 170) / lab.width; lab = lab.resize((int(lab.width * k), int(lab.height * k)), Image.LANCZOS)
        bw = lab.width + 120; bh = int(lab.height * 0.86); tail = int(bh * 0.55); drop = int(bh * 0.22)
        w = bw + 2 * tail; h = bh + drop + 14
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        dk = shade(col, 0.55)
        for side in (0, 1):  # the tails, behind and lower, notched
            x = 0 if side == 0 else w - tail - 40
            pts = [(x, drop), (x + tail + 40, drop), (x + tail + 40, bh + drop), (x, bh + drop), (x + tail * 0.45, drop + bh / 2)] if side == 0 else \
                  [(x, drop), (x + tail + 40, drop), (x + tail + 40 - tail * 0.45, drop + bh / 2), (x + tail + 40, bh + drop), (x, bh + drop)]
            d.polygon(pts, fill=dk, outline=INK, width=8)
        d.rounded_rectangle((tail, 10, tail + bw, bh + 10), 18, fill=INK)
        d.rounded_rectangle((tail, 0, tail + bw, bh), 18, fill=col, outline=INK, width=8)
        gl = Image.new('L', (bw, bh), 0); ImageDraw.Draw(gl).rectangle((10, 8, bw - 10, bh * 0.4), fill=40)
        im.paste((255, 255, 255), (tail, 0), gl)
        im.alpha_composite(lab, ((w - lab.width) // 2, (bh - lab.height) // 2 + 6))
        _ribbons[key] = im
    return _ribbons[key]


random.seed(11)
BURST = [(random.uniform(0, 2 * math.pi), random.uniform(380, 760), random.choice((5, 7, 9))) for _ in range(22)]
def burst(canvas, u, cx, cy, col=GOLD_TOP):
    """A reveal's pop: a ring going out and glints flying off; u in seconds."""
    if u < 0 or u > 0.9: return
    k = u / 0.9; layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    rr = 120 + 620 * out_cubic(k)
    d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=col + (int(230 * (1 - k)),), width=int(26 * (1 - k)) + 2)
    canvas.alpha_composite(layer)
    for ang, dist, r in BURST:
        dd = dist * out_cubic(k)
        put(canvas, _spark_big[r], cx + math.cos(ang) * dd, cy + math.sin(ang) * dd, alpha=1 - k)


def timer_bar(canvas, frac, cx, y, w=700, col=GOLD_TOP):
    """Time left to guess, draining left to right; frac 1 -> 0."""
    h = 34; im = Image.new('RGBA', (w, h + 8), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 6, w - 1, h + 7), h // 2, fill=(4, 5, 14, 255))
    d.rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=(30, 32, 60, 255), outline=INK, width=6)
    if frac > 0.01:
        fw = max(h, int((w - 12) * clamp(frac)))
        c = (255, 80, 100) if frac < 0.34 else col
        d.rounded_rectangle((6, 6, 6 + fw, h - 7), (h - 12) // 2, fill=c)
        d.rounded_rectangle((12, 8, fw, h // 2 - 2), 6, fill=mixc(c, (255, 255, 255), 0.5))
    put(canvas, im, cx, y)


_badges = {}
def count_badge(n, col):
    key = (n, col)
    if key not in _badges:
        S = 190; im = Image.new('RGBA', (S, S + 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.ellipse((0, 12, S - 1, S + 11), fill=(4, 5, 14, 255))
        d.ellipse((0, 0, S - 1, S - 1), fill=col, outline=INK, width=9)
        d.ellipse((22, 14, S - 23, S * 0.48), fill=mixc(col, (255, 255, 255), 0.35))
        lab = text_sprite(str(n), 130, WHITE, stroke=9)
        im.alpha_composite(lab, ((S - lab.width) // 2, (S - lab.height) // 2 + 8))
        _badges[key] = im
    return _badges[key]


_art = {}
def art(b, h=860, wmax=900):
    """A brawler's full-body model fitted into h x wmax, or its card when there is none."""
    key = (b['id'], h, wmax)
    if key not in _art:
        m = load_model(b)
        if m is None and os.path.exists(interim_path(b, True)):
            # A screenshot crop has its scene behind it, so it is shown as a
            # picture: rounded, in a white frame, rather than as a cut-out.
            im = Image.open(interim_path(b, True)).convert('RGBA'); bd = 14
            sc = min((h - 2 * bd) / im.height, (wmax - 2 * bd) / im.width)
            im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
            out = Image.new('RGBA', (im.width + 2 * bd, im.height + 2 * bd), (0, 0, 0, 0))
            out.paste(Image.new('RGBA', out.size, WHITE + (255,)), (0, 0), rounded_mask(out.width, out.height, 52))
            out.paste(im, (bd, bd), rounded_mask(im.width, im.height, 40))
            _art[key] = out
        elif m is None:
            _art[key] = card(0, b, 600, 690)
        else:
            sc = min(h / m.height, wmax / m.width)
            _art[key] = m.resize((int(m.width * sc), int(m.height * sc)), Image.LANCZOS)
    return _art[key]


def grey(img):
    """Desaturated and darkened, alpha kept: a brawler who fell off."""
    g = img.convert('LA').convert('RGBA')
    g = Image.blend(g, Image.new('RGBA', g.size, (40, 44, 70, 255)), 0.35)
    g.putalpha(img.getchannel('A'))
    return g


def finish(canvas, shake, flash, mark=True):
    if mark: watermark(canvas)
    frame = canvas.convert('RGB')
    frame.paste((0, 0, 0), (0, 0), VIGN.point(lambda v: int(v * 0.6)))
    if shake > 0.01:
        rnd = random.Random(int(shake * 1e6))
        f2 = Image.new('RGB', (W, H), NAVY); f2.paste(frame, (int(rnd.uniform(-1, 1) * 30 * shake), int(rnd.uniform(-1, 1) * 30 * shake))); frame = f2
    if flash > 0.01:
        frame = Image.blend(frame, Image.new('RGB', (W, H), (255, 255, 255)), clamp(flash))
    return frame
