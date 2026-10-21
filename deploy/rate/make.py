"""Slides for a "rating a top player's account" Short (2026-10-21), drawn by brawlzone-rate.

    python make.py <player.json> <value-story.png> <facts.json> <out dir> <assets dir> <icon cache>

player.json is the official API's /players/<tag> reply; value-story.png is the
site's /account-value/<tag>/story/en; facts.json carries what only the site
computes ({"value": "2.26M", "standing": "Top 10% of players", "rank": ...}).

Four slides: the hook (who, and "guess the value"), the value, their best
brawlers, and the ask -- check your own. The value slide is the site's own
image with two changes: its "MY ACCOUNT VALUE" label (it was made for players
sharing their own) and the player's tag, replaced by their trophies.
"""
import json
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont

player_path, value_path, facts_path, OUT, ASSETS, ICONS = sys.argv[1:7]
player = json.load(open(player_path))
facts = json.load(open(facts_path))
W, H = 1080, 1920
YEL = (255, 199, 44); WHITE = (245, 247, 255); MUTED = (176, 186, 222); NAVY = (11, 15, 29); CARD = (28, 38, 86)
F = lambda s: ImageFont.truetype(f'{ASSETS}/LilitaOne-Regular.ttf', s)
G = lambda s: ImageFont.truetype(f'{ASSETS}/Geist-Regular.ttf', s)
UA = {'user-agent': 'BrawlZone (https://brawlzone.net)'}


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


def pill(im, txt, y, size=46, fill=YEL, fg=NAVY):
    dr = ImageDraw.Draw(im); f = F(size); tw = dr.textlength(txt, font=f); x = (W - tw) / 2
    dr.rounded_rectangle((x - 34, y - 12, x + tw + 34, y + size + 16), 40, fill=fill); dr.text((x, y), txt, font=f, fill=fg)


def fetch_png(url, path):
    try:
        return Image.open(path).convert('RGBA')
    except OSError:
        pass
    try:
        req = urllib.request.Request(url, headers=UA)
        open(path, 'wb').write(urllib.request.urlopen(req, timeout=30).read())
        return Image.open(path).convert('RGBA')
    except Exception:  # noqa: BLE001 -- a blank tile beats no Short
        return None


def roster():
    try:
        req = urllib.request.Request('https://api.brawlapi.com/v1/brawlers', headers=UA)
        return {b['id']: b for b in json.load(urllib.request.urlopen(req, timeout=30))['list']}
    except Exception:  # noqa: BLE001
        return {}


ROSTER = roster()
name = player['name']
trophies = f"{player['trophies']:,}"
slides = []

# 1 hook
im = bg(); logo(im)
ctext(im, 'RATING A TOP', 250, F(130), WHITE)
ctext(im, "PLAYER'S ACCOUNT", 400, F(110), YEL)
icon_id = (player.get('icon') or {}).get('id')
icon = fetch_png(f'https://cdn.brawlify.com/profile-icons/regular/{icon_id}.png', f'{ICONS}/p{icon_id}.png') if icon_id else None
if icon:
    icon = icon.resize((400, 400), Image.LANCZOS)
    frame = Image.new('RGB', (420, 420), YEL); frame.paste(icon, (10, 10), icon)
    im.paste(frame, ((W - 420) // 2, 600), rounded(frame, 60))
ctext(im, name, 1070, F(110), WHITE)
pill(im, f'{trophies} TROPHIES', 1230, size=60)
if facts.get('rank'):
    ctext(im, f"Best ranked: {facts['rank']}", 1350, G(50), MUTED, shadow=False)
ctext(im, 'GUESS THE VALUE...', 1480, F(96), YEL)
slides.append(im)

# 2 the value: the site's own card, relabelled
im = Image.open(value_path).convert('RGB').resize((W, H))
dr = ImageDraw.Draw(im)
panel = im.getpixel((110, 470))
dr.rectangle((125, 355, 900, 410), fill=panel)
dr.text((133, 362), 'ACCOUNT VALUE', font=F(40), fill=YEL)
behind = im.getpixel((1000, 230))
dr.rectangle((262, 200, 1000, 255), fill=behind)
dr.text((266, 208), f'{trophies} trophies', font=G(38), fill=MUTED)
slides.append(im)

# 3 their best brawlers
im = bg(); logo(im)
ctext(im, 'THEIR TOP BRAWLERS', 250, F(100), YEL)
ctext(im, 'By trophies', 380, G(50), WHITE, shadow=False)
best = sorted(player.get('brawlers', []), key=lambda b: b.get('trophies', 0), reverse=True)[:6]
for i, b in enumerate(best):
    r, c = divmod(i, 2); x = 110 + c * 450; y = 480 + r * 420
    meta = ROSTER.get(b['id'])
    face = fetch_png(meta['imageUrl2'], f"{ICONS}/{b['id']}.png") if meta else None
    tile = Image.new('RGB', (260, 260), CARD)
    if face:
        f = face.resize((240, 240), Image.LANCZOS); tile.paste(f, (10, 10), f)
    im.paste(tile, (x + 45, y), rounded(tile, 36))
    d = ImageDraw.Draw(im); n = b['name'].title(); fn = F(56)
    while fn.size > 32 and d.textlength(n, font=fn) > 380: fn = F(fn.size - 4)
    d.text((x + 175 - d.textlength(n, font=fn) / 2, y + 268), n, font=fn, fill=WHITE)
    line = f"{b.get('trophies', 0):,} trophies · P{b.get('power', '?')}"
    fs = G(34); d.text((x + 175 - d.textlength(line, font=fs) / 2, y + 336), line, font=fs, fill=MUTED)
slides.append(im)

# 4 the ask
im = bg(); logo(im)
ctext(im, 'HOW MUCH IS', 380, F(130), WHITE)
ctext(im, 'YOURS WORTH?', 530, F(150), YEL)
ctext(im, 'Free account value calculator:', 760, G(52), WHITE, shadow=False)
ctext(im, 'every brawler, gear and hypercharge', 825, G(52), WHITE, shadow=False)
ctext(im, 'counted in coins.', 890, G(52), WHITE, shadow=False)
pill(im, 'brawlzone.net/account-value', 1050, size=62)
ctext(im, 'LINK IN BIO', 1220, F(90), WHITE)
ctext(im, 'Unofficial fan project, not affiliated with Supercell.', 1460, G(32), MUTED, shadow=False)
slides.append(im)

for i, s in enumerate(slides, 1):
    s.save(f'{OUT}/{i}.jpg', quality=92)
value = facts['value']
standing = facts.get('standing') or ''
title = f"How Much Is {name}'s Brawl Stars Account Worth? {value} Coins"
description = (
    f"Rating a top Brawl Stars player's account: {name} ({trophies} trophies) is worth {value} coins"
    + (f", {standing[0].lower() + standing[1:]}" if standing else '') + ". "
    "How much is yours worth? Free calculator, every brawler, gear and hypercharge counted: "
    "https://brawlzone.net/account-value\n\n"
    "#brawlstars #brawlstarsaccount #accountvalue #brawlstarstips #brawlzone"
)
json.dump({'count': len(slides), 'title': title, 'description': description},
          open(f'{OUT}/meta.json', 'w'), indent=1, ensure_ascii=False)
print(len(slides))
