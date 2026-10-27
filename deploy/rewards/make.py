"""Slides for a free-rewards post (2026-10-21), drawn by brawlzone-rewards.

    python make.py <rewards.json> <out dir> <assets dir> <portrait cache dir>

rewards.json is [{"name": "Mega Box", "url": "https://link.brawlstars.com/..."}].
Writes 1.jpg.. and meta.json ({count, title, description}) to the out dir.

Our own art throughout: a drawn gift box, or the brawler's portrait when the
reward names one ("Wendy Box"). The first set (2026-10-21, by hand in
~/shots/vouchers) cropped Supercell's announcement image; a post that goes
out unattended cannot rely on there being one.
"""
import json
import re
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import qrcode
import qrcode.constants

rewards_path, OUT, ASSETS, ICONS = sys.argv[1:5]
rewards = json.load(open(rewards_path))[:4]
W, H = 1080, 1920
YEL = (255, 199, 44); WHITE = (245, 247, 255); MUTED = (176, 186, 222); NAVY = (11, 15, 29); CARD = (28, 38, 86)
ACCENTS = [(90, 170, 255), (60, 220, 240), (240, 90, 220), (120, 230, 140)]
F = lambda s: ImageFont.truetype(f'{ASSETS}/LilitaOne-Regular.ttf', s)
G = lambda s: ImageFont.truetype(f'{ASSETS}/Geist-Regular.ttf', s)


def bg():
    im = Image.new('RGB', (W, H)); dr = ImageDraw.Draw(im)
    for y in range(H):
        t = y / (H - 1); dr.line([(0, y), (W, y)], fill=(int(11 + 19 * t), int(15 + 27 * t), int(29 + 67 * t)))
    g = Image.new('L', (W, H), 0); ImageDraw.Draw(g).ellipse((-300, -350, 900, 700), fill=70); g = g.filter(ImageFilter.GaussianBlur(220))
    return Image.composite(Image.new('RGB', (W, H), (110, 85, 10)), im, g)


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


def gift(size, col):
    """A drawn gift box: ours, so nothing borrowed needs to be on hand."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im); s = size
    d.rounded_rectangle((s * .12, s * .42, s * .88, s * .92), s * .06, fill=col)
    d.rounded_rectangle((s * .06, s * .28, s * .94, s * .46), s * .05, fill=tuple(min(255, c + 40) for c in col))
    d.rectangle((s * .44, s * .28, s * .56, s * .92), fill=YEL)
    d.ellipse((s * .22, s * .08, s * .50, s * .30), outline=YEL, width=int(s * .06))
    d.ellipse((s * .50, s * .08, s * .78, s * .30), outline=YEL, width=int(s * .06))
    return im


def art(i, size):
    name = rewards[i]['name']; col = ACCENTS[i % 4]
    face = portrait(name)
    tile = Image.new('RGB', (size, size), tuple(int(c * .35) for c in col))
    inner = face.resize((int(size * .86), int(size * .86)), Image.LANCZOS) if face else gift(int(size * .8), col)
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

# cover
im = bg(); logo(im)
ctext(im, 'FREE', 250, F(230), YEL); ctext(im, 'REWARDS' if n > 1 else 'REWARD', 480, F(150), WHITE)
ctext(im, f'{n} official Brawl Stars gifts. Claim them all!' if n > 1 else 'An official Brawl Stars gift. Claim it now!', 680, G(50), WHITE, shadow=False)
y = 790
for i, r in enumerate(rewards):
    rowh = 170 if n > 2 else 230
    dr = ImageDraw.Draw(im); dr.rounded_rectangle((90, y, 990, y + rowh), 36, fill=CARD, outline=ACCENTS[i % 4], width=5)
    a = art(i, rowh - 30); im.paste(a, (110, y + 15), rounded(a, 24))
    f = F(72)
    while f.size > 34 and dr.textlength(r['name'], font=f) > 990 - (150 + rowh) - 30: f = F(f.size - 4)
    dr.text((130 + rowh, y + (rowh - f.size) // 2 - 6), r['name'], font=f, fill=WHITE)
    y += rowh + 30
pill(im, 'Scan the codes inside' if n > 1 else 'Scan the code inside', min(y + 30, 1640), size=54)
mark(im); slides.append(im)

# one per reward
for i, r in enumerate(rewards):
    im = bg(); logo(im)
    ctext(im, f'GIFT {i + 1} OF {n}' if n > 1 else 'FREE GIFT', 230, F(70), YEL)
    ctext(im, r['name'].upper(), 320, F(110), WHITE)
    a = art(i, 520); card(im, a, (W - 536) // 2, 490, ACCENTS[i % 4])
    q = qr(r['url'], 520); card(im, q, (W - 536) // 2, 1060, YEL, r=24)
    ctext(im, 'Screenshot → scan it with Google Lens', 1610, G(44), WHITE, shadow=False)
    mark(im); slides.append(im)

# all codes on one slide, for a screenshot
if n > 1:
    im = bg(); logo(im)
    ctext(im, 'SCREENSHOT THIS', 240, F(110), YEL)
    ctext(im, f'All {n} codes in one picture', 370, G(50), WHITE, shadow=False)
    rowh = 380 if n <= 3 else 290
    y = 470
    for i, r in enumerate(rewards):
        dr = ImageDraw.Draw(im); col = ACCENTS[i % 4]
        dr.rounded_rectangle((60, y, 1020, y + rowh), 40, fill=CARD, outline=col, width=5)
        q = qr(r['url'], rowh - 50); im.paste(q, (1020 - q.width - 25, y + 25))
        words = r['name'].split(' ', 1)
        f1 = F(72 if n <= 3 else 60)
        while f1.size > 34 and dr.textlength(words[0], font=f1) > 560 - q.width + 300: f1 = F(f1.size - 4)
        dr.text((100, y + rowh // 2 - 90), words[0], font=f1, fill=WHITE)
        if len(words) > 1:
            f2 = F(54)
            while f2.size > 28 and dr.textlength(words[1], font=f2) > 1020 - q.width - 160: f2 = F(f2.size - 2)
            dr.text((100, y + rowh // 2 + 5), words[1], font=f2, fill=col)
        y += rowh + 30
    mark(im); slides.append(im)

# follow
im = bg(); logo(im)
ctext(im, 'FOLLOW', 330, F(190), YEL)
ctext(im, 'FOR MORE FREE STUFF', 540, F(96), WHITE)
ctext(im, 'We post every free reward the moment it drops,', 720, G(48), WHITE, shadow=False)
ctext(im, '+ the best Ranked picks for every map.', 785, G(48), WHITE, shadow=False)
x0 = (W - (n * 260 - 30)) // 2
for i in range(n):
    a = art(i, 230); im.paste(a, (x0 + i * 260, 930), rounded(a, 30))
pill(im, 'Links are in the caption too', 1260, size=54)
mark(im); slides.append(im)

for i, s in enumerate(slides, 1):
    s.save(f'{OUT}/{i}.jpg', quality=92)

names = [r['name'] for r in rewards]
listed = names[0] if n == 1 else ', '.join(names[:-1]) + ' and ' + names[-1]
links = '\n'.join(f"🎁 {r['name']}: {r['url']}" for r in rewards)
title = f"FREE Brawl Stars {'rewards' if n > 1 else 'reward'}: {listed}"[:90]
description = (
    f"🎁 FREE Brawl Stars {'rewards' if n > 1 else 'reward'}! Claim {listed} before {'they are' if n > 1 else 'it is'} gone 👀\n\n"
    f"Scan the QR {'codes' if n > 1 else 'code'} (screenshot → Google Lens works) or use the {'links' if n > 1 else 'link'}:\n{links}\n\n"
    "Every free reward in one place, with claim buttons: brawlzone.net/rewards\n"
    "Follow for every free reward the moment it drops, and the best Ranked picks every day.\n"
    "Unofficial fan project, not affiliated with Supercell.\n"
    "#brawlstars #brawlstarsfree #brawlstarsrewards #freerewards #brawlzone"
)
json.dump({'count': len(slides), 'title': title, 'description': description}, open(f'{OUT}/meta.json', 'w'), indent=1, ensure_ascii=False)
print(len(slides))
