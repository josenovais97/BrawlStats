"""Slides for a free-rewards post (2026-10-21), drawn by brawlzone-rewards.

    python make.py <rewards.json> <out dir> <assets dir> <portrait cache dir> [public dir]

rewards.json is [{"name": "Mega Box", "url": "https://link.brawlstars.com/..."}].
Writes 1.jpg.. and meta.json ({count, title, description}) to the out dir.

Art, best first (2026-10-28): a high-res file for the reward in
public/rewards/art (`art_slug`, e.g. credits.png; from Supercell's Fan Kit,
which has no Chaos Drop or plain Starr Drop), the brawler's portrait
when the reward names one ("Wendy Box"), the site's own icons for what it has
them for, and a plain gift for anything else. The first set (2026-10-21, by
hand in ~/shots/vouchers) cropped Supercell's announcement image; a post that
goes out unattended cannot rely on there being one.

The look is the /rewards page's: a violet stage with rays and the reward
floating in it, because the first slide is the whole hook on TikTok.
"""
import os
import json
import re
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import qrcode
import qrcode.constants

rewards_path, OUT, ASSETS, ICONS = sys.argv[1:5]
PUBLIC = sys.argv[5] if len(sys.argv) > 5 else None
rewards = json.load(open(rewards_path))[:4]
W, H = 1080, 1920
YEL = (255, 199, 44); WHITE = (245, 247, 255); MUTED = (176, 186, 222); NAVY = (11, 15, 29); CARD = (28, 38, 86)
ACCENTS = [(90, 170, 255), (60, 220, 240), (240, 90, 220), (120, 230, 140)]
F = lambda s: ImageFont.truetype(f'{ASSETS}/LilitaOne-Regular.ttf', s)
G = lambda s: ImageFont.truetype(f'{ASSETS}/Geist-Regular.ttf', s)


def bg(cy=760):
    """The /rewards stage: violet radial light, slow rays, a gold glow at `cy`."""
    im = Image.new('RGB', (W, H), (8, 11, 22)); g = ImageDraw.Draw(im)
    stops = [(0, (123, 77, 255)), (.36, (59, 31, 158)), (.7, (22, 13, 64)), (1, (8, 11, 22))]
    R = 1500
    for r in range(R, 0, -6):
        t = r / R
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if a <= t <= b:
                k = (t - a) / (b - a); col = tuple(int(ca[j] + (cb[j] - ca[j]) * k) for j in range(3)); break
        g.ellipse((W // 2 - r * .75, cy - r * .62, W // 2 + r * .75, cy + r * .62), fill=col)
    rays = Image.new('L', (W, H), 0); rd = ImageDraw.Draw(rays)
    for k in range(16):
        a0 = k * 22.5; a1 = a0 + 8
        rd.pieslice((W // 2 - 2400, cy - 2400, W // 2 + 2400, cy + 2400), a0, a1, fill=34)
    fade = Image.new('L', (W, H), 0); ImageDraw.Draw(fade).ellipse((W // 2 - 760, cy - 760, W // 2 + 760, cy + 760), fill=255)
    fade = fade.filter(ImageFilter.GaussianBlur(260))
    rays = Image.composite(rays, Image.new('L', (W, H), 0), fade)
    im = Image.composite(Image.new('RGB', (W, H), (255, 255, 255)), im, rays)
    glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).ellipse((W // 2 - 300, cy - 300, W // 2 + 300, cy + 300), fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.composite(Image.new('RGB', (W, H), (255, 197, 61)), im, glow)


def stext(im, txt, y, font, fill, maxw=980, stroke=None, cx=W // 2):
    """Game lettering: centred on `cx`, with the game's thick dark outline and hard drop."""
    dr = ImageDraw.Draw(im)
    while font.size > 30 and dr.textlength(txt, font=font) > maxw:
        font = F(font.size - 4)
    sw = stroke if stroke is not None else max(4, font.size // 9)
    x = cx - dr.textlength(txt, font=font) / 2
    dr.text((x, y + sw + 2), txt, font=font, fill=NAVY, stroke_width=sw, stroke_fill=NAVY)
    dr.text((x, y), txt, font=font, fill=fill, stroke_width=sw, stroke_fill=NAVY)
    return y + int(font.size * 1.1) + sw


def rounded(img, r):
    m = Image.new('L', img.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), r, fill=255); return m


def ctext(im, txt, y, font, fill, shadow=True, maxw=980):
    dr = ImageDraw.Draw(im)
    while font.size > 30 and dr.textlength(txt, font=font) > maxw:
        font = (F if 'Lilita' in font.path else G)(font.size - 4)
    x = (W - dr.textlength(txt, font=font)) / 2
    if shadow: dr.text((x + 4, y + 5), txt, font=font, fill=(0, 0, 0))
    dr.text((x, y), txt, font=font, fill=fill); return y + int(font.size * 1.12)


appi = Image.open(f'{ASSETS}/app-icon.png').convert('RGBA')


def logo(im, y=100):
    s = appi.resize((80, 80)); im.paste(s, (W // 2 - 170, y), rounded(s, 20))
    ImageDraw.Draw(im).text((W // 2 - 74, y + 14), 'BrawlZone', font=F(52), fill=WHITE)


def mark(im):
    dr = ImageDraw.Draw(im); f = F(46); t = 'brawlzone.net'; tw = dr.textlength(t, font=f)
    dr.rounded_rectangle(((W - tw) / 2 - 30, H - 170, (W + tw) / 2 + 30, H - 100), 35, fill=(0, 0, 0))
    dr.text(((W - tw) / 2, H - 166), t, font=f, fill=YEL)
    ctext(im, 'Unofficial fan project, not affiliated with Supercell.', H - 80, G(30), MUTED, shadow=False)


def pill(im, txt, y, size=46):
    dr = ImageDraw.Draw(im); f = F(size); tw = dr.textlength(txt, font=f); x = (W - tw) / 2
    dr.rounded_rectangle((x - 34, y - 12, x + tw + 34, y + size + 16), 40, fill=YEL); dr.text((x, y), txt, font=f, fill=NAVY)


def brawlers():
    try:
        req = urllib.request.Request('https://api.brawlapi.com/v1/brawlers', headers={'user-agent': 'BrawlZone (https://brawlzone.net)'})
        return {b['name'].lower(): b for b in json.load(urllib.request.urlopen(req, timeout=30))['list']}
    except Exception:  # noqa: BLE001 -- a gift box instead of a face
        return {}


ROSTER = brawlers()


def portrait(name):
    """The brawler a reward names ("Wendy Box" -> Wendy), as an RGBA image, or None."""
    words = name.lower()
    for bname in sorted(ROSTER, key=len, reverse=True):
        if re.search(rf'\b{re.escape(bname)}\b', words):
            b = ROSTER[bname]; path = f"{ICONS}/{b['id']}.png"
            try:
                return Image.open(path).convert('RGBA')
            except OSError:
                try:
                    req = urllib.request.Request(b['imageUrl2'], headers={'user-agent': 'BrawlZone (https://brawlzone.net)'})
                    open(path, 'wb').write(urllib.request.urlopen(req, timeout=30).read())
                    return Image.open(path).convert('RGBA')
                except Exception:  # noqa: BLE001
                    return None
    return None


def art_slug(name):
    """ "1x Chaos Drop" -> "chaos-drop", "2000 Credits" -> "credits": the file name in public/rewards/art. """
    base = re.sub(r'^\s*\d[\d,.]*\s*[x×]?\s*', '', name, flags=re.I)
    base = re.sub(r'\s*[x×]\s*\d+\s*$', '', base, flags=re.I)
    return re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')


def display_name(name):
    """What the slide says: "1x Chaos Drop" is a Chaos Drop; "2000 Credits" keeps its number."""
    return re.sub(r'^\s*1\s*[x×]\s*', '', name, flags=re.I).strip()


# The site's own icons, for when there is no high-res file (same order as
# LOCAL_ART in src/lib/free-rewards.ts).
LOCAL_ART = [
    (r'mega box', 'rewards/box-red.png'), (r'big box', 'rewards/box-pink.png'),
    (r'starr drop', 'icons/starr-drop.png'), (r'power point', 'icons/power-point.png'),
    (r'coin', 'icons/coin.png'), (r'box', 'rewards/box-blue.png'),
]


def open_rgba(path):
    try:
        return Image.open(path).convert('RGBA')
    except OSError:
        return None


def reward_image(name):
    """The best art we have for a reward, as RGBA, or the gift."""
    if PUBLIC:
        slug = art_slug(name)
        # "100 XP Doubler" and "XP Doublers" are one file; so are Box / Boxes.
        for s in (slug, re.sub(r'(box)es$', r'\1', slug), slug.rstrip('s'), slug + 's'):
            hi = open_rgba(f'{PUBLIC}/rewards/art/{s}.png')
            if hi: return hi
    face = portrait(name)
    if face: return face
    if PUBLIC:
        for pat, rel in LOCAL_ART:
            if re.search(pat, name, re.I):
                im = open_rgba(f'{PUBLIC}/{rel}')
                if im: return im
        g = open_rgba(f'{PUBLIC}/rewards/gift.png')
        if g: return g
    return gift_drawn(512)


def gift_drawn(size, col=(255, 72, 104)):
    """A drawn gift box, if even public/ is missing."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im); s = size
    d.rounded_rectangle((s * .12, s * .42, s * .88, s * .92), s * .06, fill=col)
    d.rounded_rectangle((s * .06, s * .28, s * .94, s * .46), s * .05, fill=tuple(min(255, c + 40) for c in col))
    d.rectangle((s * .44, s * .28, s * .56, s * .92), fill=YEL)
    d.ellipse((s * .22, s * .08, s * .50, s * .30), outline=YEL, width=int(s * .06))
    d.ellipse((s * .50, s * .08, s * .78, s * .30), outline=YEL, width=int(s * .06))
    return im


def fit(img, size):
    """Scaled to fit a size x size square, keeping its shape."""
    k = size / max(img.width, img.height)
    return img.resize((max(1, int(img.width * k)), max(1, int(img.height * k))), Image.LANCZOS)


def floating(im, img, cx, cy, size):
    """The reward on the stage: centred at (cx, cy), with a soft drop shadow."""
    a = fit(img, size)
    sh = Image.new('L', im.size, 0)
    sh.paste(a.getchannel('A').point(lambda v: v * .55), (cx - a.width // 2, cy - a.height // 2 + size // 14))
    sh = sh.filter(ImageFilter.GaussianBlur(size // 18))
    im.paste((10, 6, 30), (0, 0), sh)
    im.paste(a, (cx - a.width // 2, cy - a.height // 2), a)


def art(i, size):
    """A square tile of the reward's art, for rows and the follow slide."""
    col = ACCENTS[i % 4]
    tile = Image.new('RGB', (size, size), tuple(int(c * .35) for c in col))
    inner = fit(reward_image(rewards[i]['name']), int(size * .82))
    tile.paste(inner, ((size - inner.width) // 2, (size - inner.height) // 2), inner)
    return tile


def card(im, img, x, y, border, r=36):
    c = Image.new('RGB', (img.width + 16, img.height + 16), border); c.paste(img, (8, 8), rounded(img, r))
    sh = Image.new('L', c.size, 0); ImageDraw.Draw(sh).rounded_rectangle((0, 0, c.width - 1, c.height - 1), r + 8, fill=160); sh = sh.filter(ImageFilter.GaussianBlur(20))
    im.paste((0, 0, 0), (x + 8, y + 20), sh); im.paste(c, (x, y), rounded(c, r + 8))


def qr(url, size):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=2, box_size=20); q.add_data(url); q.make(fit=True)
    return q.make_image(fill_color=NAVY, back_color='white').convert('RGB').resize((size, size), Image.NEAREST)


n = len(rewards)
slides = []
names = [display_name(r['name']) for r in rewards]

# cover: the reward itself, as the game shows it, because this slide is the hook
im = bg(cy=880); logo(im, y=90)
stext(im, 'FREE', 200, F(200), YEL)
if n == 1:
    floating(im, reward_image(rewards[0]['name']), W // 2, 880, 620)
    stext(im, names[0].upper(), 1250, F(120), WHITE)
else:
    cell = 400
    for i, r in enumerate(rewards):
        cx = int(W // 2 + (i % 2 - .5) * 460)
        cy = 880 if n == 2 else 700 + (i // 2) * 420
        if n == 3 and i == 2: cx = W // 2
        floating(im, reward_image(r['name']), cx, cy, cell - 80)
        stext(im, names[i].upper(), cy + cell // 2 - 50, F(56), WHITE, maxw=430, cx=cx)
pill(im, 'Official Brawl Stars gift' + ('s' if n > 1 else '') + ' · claim now', 1450, size=50)
stext(im, 'SWIPE FOR THE CODE →' if n == 1 else 'SWIPE FOR THE CODES →', 1560, F(64), WHITE)
mark(im); slides.append(im)

# one per reward: the code, and the one-tap way that needs no scanning
for i, r in enumerate(rewards):
    im = bg(cy=520); logo(im, y=90)
    stext(im, f'GIFT {i + 1} OF {n}' if n > 1 else 'FREE GIFT', 200, F(64), YEL)
    stext(im, names[i].upper(), 285, F(96), WHITE)
    floating(im, reward_image(r['name']), W // 2, 590, 300)
    q = qr(r['url'], 500); card(im, q, (W - 516) // 2, 790, YEL, r=24)
    ctext(im, 'Screenshot → scan it with Google Lens', 1335, G(42), WHITE, shadow=False)
    pill(im, 'or tap Claim on brawlzone.net/rewards', 1420, size=46)
    mark(im); slides.append(im)

# all codes on one slide, for a screenshot
if n > 1:
    im = bg(cy=900); logo(im, y=90)
    stext(im, 'SCREENSHOT THIS', 220, F(104), YEL)
    ctext(im, f'All {n} codes in one picture', 370, G(50), WHITE, shadow=False)
    rowh = 380 if n <= 3 else 290
    y = 470
    for i, r in enumerate(rewards):
        dr = ImageDraw.Draw(im); col = ACCENTS[i % 4]
        dr.rounded_rectangle((60, y, 1020, y + rowh), 40, fill=CARD, outline=col, width=5)
        q = qr(r['url'], rowh - 50); im.paste(q, (1020 - q.width - 25, y + 25))
        a = fit(reward_image(r['name']), rowh - 150); im.paste(a, (100, y + 30), a)
        f1 = F(60 if n <= 3 else 50)
        while f1.size > 30 and dr.textlength(names[i], font=f1) > 1020 - q.width - 160: f1 = F(f1.size - 4)
        dr.text((100, y + rowh - 30 - f1.size), names[i], font=f1, fill=WHITE)
        y += rowh + 30
    mark(im); slides.append(im)

# the next one: the site's notifications, then follow
im = bg(cy=760); logo(im, y=90)
stext(im, 'GET THE NEXT', 250, F(120), WHITE)
stext(im, 'ONE FIRST', 390, F(150), YEL)
x0 = (W - (n * 260 - 30)) // 2
for i in range(n):
    a = art(i, 230); card(im, a, x0 + i * 260, 640, ACCENTS[i % 4], r=30)
ctext(im, 'Tap "Notify me" on brawlzone.net/rewards', 1010, G(48), WHITE, shadow=False)
ctext(im, 'and your phone pings the minute one drops.', 1075, G(48), WHITE, shadow=False)
pill(im, 'Follow for every free reward', 1230, size=56)
ctext(im, 'Links are in the caption too', 1360, G(42), MUTED, shadow=False)
mark(im); slides.append(im)

for i, s in enumerate(slides, 1):
    s.save(f'{OUT}/{i}.jpg', quality=92)

listed = names[0] if n == 1 else ', '.join(names[:-1]) + ' and ' + names[-1]
links = '\n'.join(f"🎁 {r['name']}: {r['url']}" for r in rewards)
title = f"FREE Brawl Stars {'rewards' if n > 1 else 'reward'}: {listed}"[:90]
description = (
    f"🎁 FREE Brawl Stars {'rewards' if n > 1 else 'reward'}! Claim {listed} before {'they are' if n > 1 else 'it is'} gone 👀\n\n"
    f"Scan the QR {'codes' if n > 1 else 'code'} (screenshot → Google Lens works) or use the {'links' if n > 1 else 'link'}:\n{links}\n\n"
    "Claim in one tap, and get a notification for the next one: brawlzone.net/rewards\n"
    "Follow for every free reward the moment it drops, and the best Ranked picks every day.\n"
    "Unofficial fan project, not affiliated with Supercell.\n"
    "#brawlstars #brawlstarsfree #brawlstarsrewards #freerewards #brawlzone"
)
json.dump({'count': len(slides), 'title': title, 'description': description}, open(f'{OUT}/meta.json', 'w'), indent=1, ensure_ascii=False)
print(len(slides))
