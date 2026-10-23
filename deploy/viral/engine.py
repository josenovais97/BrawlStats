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
# Every cut lands on the beat of one track: "Fontana" (129 BPM), from the
# YouTube Audio Library, cut in at MUSIC_START. Its period came from
# ~/shots/viral2/beats.py (onset autocorrelation).
MUSIC = 'Fontana - Ryan Stasik, Kanika Moore.mp3'
MUSIC_START = 63.994
P = 0.4644
# Fonts, the app icon, and per-brawler art (models/, faces/), all under ASSETS.
ASSETS = os.environ.get('ASSETS', '.')
NAVY = (9, 12, 26)
WHITE = (250, 250, 255)
GOLD_TOP, GOLD_BOT = (255, 236, 120), (255, 160, 20)
TIER = {'S': (255, 60, 100), 'A': (255, 140, 40), 'B': (255, 205, 40), 'C': (70, 215, 120),
        'D': (60, 170, 255), 'E': (150, 105, 255), 'F': (125, 135, 170)}
TIER_NAME = {'S': 'S TIER', 'A': 'A TIER', 'B': 'B TIER', 'C': 'C TIER', 'D': 'D TIER', 'E': 'E TIER', 'F': 'F TIER'}
LIL = f'{ASSETS}/LilitaOne-Regular.ttf'; GEI = f'{ASSETS}/Geist-Regular.ttf'
_fonts = {}
def F(s):
    if ('L', s) not in _fonts: _fonts[('L', s)] = ImageFont.truetype(LIL, s)
    return _fonts[('L', s)]
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
def load_face(b):
    p = f"{ASSETS}/faces/{b['id']}.png"
    if os.path.exists(p):
        return Image.open(p).convert('RGBA')
    # A brawler too new for Brawlify's portraits: a plain tile with their initial.
    im = Image.new('RGBA', (256, 256), (40, 46, 96, 255)); d = ImageDraw.Draw(im)
    d.text((128, 128), b['n'][:1].upper(), font=ImageFont.truetype(LIL, 170), fill=WHITE, anchor='mm')
    return im

def load_model(b):
    p = f"{ASSETS}/models/{b['id']}.png"
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None

def vgrad(w, h, top, bot):
    a = np.linspace(0, 1, h)[:, None, None]
    arr = (np.array(top)[None, None, :] * (1 - a) + np.array(bot)[None, None, :] * a)
    return Image.fromarray(np.repeat(arr, w, axis=1).astype('uint8'), 'RGB')

def radial_mask(w, h, cx, cy, r):
    y, x = np.ogrid[:h, :w]
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    return Image.fromarray((np.clip(1 - d, 0, 1) ** 1.6 * 255).astype('uint8'), 'L')

BASE = vgrad(W, H, (8, 10, 24), (18, 22, 52))
GLOW = radial_mask(W, H, W / 2, H * 0.42, 1100)
VIGN = Image.fromarray((np.clip(np.sqrt(((np.ogrid[:H, :W][1] - W / 2) / (W * 0.75)) ** 2 + ((np.ogrid[:H, :W][0] - H / 2) / (H * 0.75)) ** 2), 0, 1) ** 2 * 200).astype('uint8'), 'L')
# diagonal stripes, drawn once twice the needed size and scrolled
STRIPES = Image.new('L', (W * 2, H * 2), 0)
_d = ImageDraw.Draw(STRIPES)
for x in range(-H * 2, W * 2, 90):
    _d.polygon([(x, 0), (x + 40, 0), (x + 40 + H * 2, H * 2), (x + H * 2, H * 2)], fill=16)
_bg_cache = {}
def tier_bg(col):
    if col not in _bg_cache:
        im = BASE.copy()
        im.paste(Image.new('RGB', (W, H), col), (0, 0), GLOW.point(lambda v: int(v * 0.55)))
        _bg_cache[col] = im
    return _bg_cache[col]

random.seed(7)
SPARKS = [(random.uniform(0, W), random.uniform(0, H), random.uniform(20, 70), random.uniform(2, 5), random.uniform(0, 6.28)) for _ in range(70)]

def background(t, col, col2=None, mix=0.0):
    im = tier_bg(col).copy()
    if col2 is not None and mix > 0:
        im = Image.blend(im, tier_bg(col2), clamp(mix))
    off = int(t * 70) % 180
    white = Image.new('RGB', (W, H), (255, 255, 255))
    im.paste(white, (0, 0), STRIPES.crop((off, off, off + W, off + H)))
    d = ImageDraw.Draw(im)
    for x, y, v, r, ph in SPARKS:
        yy = (y - t * v) % H
        xx = x + math.sin(t * 1.3 + ph) * 18
        a = 0.5 + 0.5 * math.sin(t * 3 + ph)
        c = tuple(int(255 * (0.4 + 0.6 * a)) for _ in range(3))
        d.ellipse((xx - r, yy - r, xx + r, yy + r), fill=c)
    return im

# ---------------------------------------------------------------- text
_txt = {}
def text_sprite(txt, size, fill=WHITE, gold=False, stroke=10, shadow=True, font=None):
    key = (txt, size, fill, gold, stroke, shadow, font)
    if key in _txt: return _txt[key]
    f = (font or F)(size)
    l, t_, r, b = f.getbbox(txt, stroke_width=stroke)
    w, h = r - l + 30, b - t_ + 40
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).text((15 - l, 15 - t_), txt, font=f, fill=255)
    outline = Image.new('L', (w, h), 0)
    ImageDraw.Draw(outline).text((15 - l, 15 - t_), txt, font=f, fill=255, stroke_width=stroke, stroke_fill=255)
    out = Image.new('RGBA', (w, h + 14), (0, 0, 0, 0))
    if shadow:  # a solid extrude below, then a soft drop
        sh = Image.new('RGBA', (w, h), (0, 0, 0, 255)); out.paste(sh, (0, 12), outline)
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

APP = Image.open(f'{ASSETS}/app-icon.png').convert('RGBA').resize((64, 64), Image.LANCZOS)
def watermark(canvas):
    s = text_sprite('brawlzone.net', 40, GOLD_TOP, stroke=6, shadow=False)
    pill = Image.new('RGBA', (s.width + 100, 84), (0, 0, 0, 0))
    ImageDraw.Draw(pill).rounded_rectangle((0, 0, pill.width - 1, 83), 42, fill=(8, 10, 24, 200))
    pill.alpha_composite(APP, (12, 10)); pill.alpha_composite(s, (82, 4))
    canvas.alpha_composite(pill, ((W - pill.width) // 2, 196))

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


def follow_cta(canvas, u, y, line):
    """The follow ask that closes every video: the button pops, pulses, and a
    hand-drawn tap ring goes out from it each beat. u in beats since it starts."""
    if u < 0: return
    pulse = 1 + 0.06 * abs(math.sin(u * math.pi))
    if u > 0.6:
        ring = (u % 1.0); r = 90 + ring * 200
        layer = Image.new('RGBA', (W, 900), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse((W / 2 - r * 2.4, 450 - r, W / 2 + r * 2.4, 450 + r), outline=(255, 255, 255, int(170 * (1 - ring))), width=8)
        canvas.alpha_composite(layer, (0, int(y - 450)))
    put(canvas, follow_button(), W / 2, y, scale=out_back(u / 0.45, 2.2) * pulse)
    put(canvas, text_sprite(line, 64, GOLD_TOP, stroke=7), W / 2, y + 150, scale=out_back((u - 0.5) / 0.4))


_art = {}
def art(b, h=860, wmax=900):
    """A brawler's full-body model fitted into h x wmax, or its card when there is none."""
    key = (b['id'], h, wmax)
    if key not in _art:
        m = load_model(b)
        if m is None:
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
