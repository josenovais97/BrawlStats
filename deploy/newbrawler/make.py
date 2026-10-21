"""Slides for a new brawler's "first stats" post (2026-10-21), drawn by brawlzone-newbrawler.

    python make.py <report.json> <gear-names.json> <art.png> <out dir> <assets dir>

report.json is scripts/new-brawler-report.ts's output; art.png is the
brawler's square art (its profile icon on release day: Brawlify's portraits
arrive days later). Writes 1.jpg..5.jpg and meta.json {count, title,
description}. Generalised from the Vince post of 2026-10-21 (~/shots/vince):
the headline follows the verdict, so a weak release is called weak.
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

report_path, gears_path, art_path, OUT, ASSETS = sys.argv[1:6]
r = json.load(open(report_path))
try:
    gear_names = {int(k): v for k, v in json.load(open(gears_path)).items()}
except (OSError, ValueError):
    gear_names = {}

W, H = 1080, 1920
YEL = (255, 199, 44); WHITE = (245, 247, 255); MUTED = (176, 186, 222); NAVY = (11, 15, 29)
CARD = (28, 38, 86); GREEN = (52, 211, 153); ORANGE = (255, 160, 60); RED = (248, 113, 113)
TIER_COLOR = {'S': (255, 92, 92), 'A': (255, 170, 60), 'B': (250, 210, 70), 'C': (120, 200, 120),
              'D': (140, 150, 190), 'E': (140, 150, 190), 'F': (140, 150, 190)}
MODES = {'gemGrab': 'Gem Grab', 'heist': 'Heist', 'bounty': 'Bounty', 'hotZone': 'Hot Zone', 'brawlBall': 'Brawl Ball',
         'knockout': 'Knockout', 'wipeout': 'Wipeout', 'siege': 'Siege', 'basketBrawl': 'Basket Brawl'}
F = lambda s: ImageFont.truetype(f'{ASSETS}/LilitaOne-Regular.ttf', s)
G = lambda s: ImageFont.truetype(f'{ASSETS}/Geist-Regular.ttf', s)

name = r['name']; NAME = name.upper(); tier = r['tier'] or 'C'
# Headline, answer, answer colour.
VERDICT = {
    'S': (f'IS {NAME}', 'BROKEN?', 'YES.', GREEN),
    'A': (f'IS {NAME}', 'GOOD?', 'YES.', GREEN),
    'B': (f'IS {NAME}', 'GOOD?', 'PRETTY GOOD.', YEL),
    'C': (f'IS {NAME}', 'GOOD?', 'NOT REALLY.', ORANGE),
}.get(tier, (f'IS {NAME}', 'BAD?', 'RIGHT NOW, YES.', RED))


def bg():
    im = Image.new('RGB', (W, H)); dr = ImageDraw.Draw(im)
    for y in range(H):
        t = y / (H - 1); dr.line([(0, y), (W, y)], fill=(int(11 + 19 * t), int(15 + 27 * t), int(29 + 67 * t)))
    g = Image.new('L', (W, H), 0); ImageDraw.Draw(g).ellipse((-300, -350, 900, 700), fill=70); g = g.filter(ImageFilter.GaussianBlur(220))
    return Image.composite(Image.new('RGB', (W, H), (60, 110, 40)), im, g)


def rounded(img, rad):
    m = Image.new('L', img.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), rad, fill=255); return m


def ctext(im, txt, y, font, fill, shadow=True):
    dr = ImageDraw.Draw(im)
    while font.size > 30 and dr.textlength(txt, font=font) > 980:
        font = (F if 'Lilita' in font.path else G)(font.size - 4)
    x = (W - dr.textlength(txt, font=font)) / 2
    if shadow: dr.text((x + 4, y + 5), txt, font=font, fill=(0, 0, 0))
    dr.text((x, y), txt, font=font, fill=fill); return y + int(font.size * 1.12)


appi = Image.open(f'{ASSETS}/app-icon.png').convert('RGBA')
art = Image.open(art_path).convert('RGBA')
if art.width >= 190 and art.width <= 210:
    art = art.crop((8, 8, art.width - 8, art.height - 8))  # a profile icon's own black border
art_rgb = Image.new('RGB', art.size, (40, 60, 70)); art_rgb.paste(art, (0, 0), art)


def portrait(im, size, y, border=GREEN):
    f = art_rgb.resize((size, size), Image.LANCZOS)
    frame = Image.new('RGB', (size + 24, size + 24), border); frame.paste(f, (12, 12), rounded(f, size // 7))
    sh = Image.new('L', frame.size, 0); ImageDraw.Draw(sh).rounded_rectangle((0, 0, frame.width - 1, frame.height - 1), size // 6, fill=170); sh = sh.filter(ImageFilter.GaussianBlur(24))
    x = (W - frame.width) // 2
    im.paste((0, 0, 0), (x + 10, y + 24), sh); im.paste(frame, (x, y), rounded(frame, size // 6))


def logo(im, y=100):
    s = appi.resize((80, 80)); im.paste(s, (W // 2 - 170, y), rounded(s, 20))
    ImageDraw.Draw(im).text((W // 2 - 74, y + 14), 'BrawlZone', font=F(52), fill=WHITE)


def mark(im):
    dr = ImageDraw.Draw(im); f = F(46); t = 'brawlzone.net'; tw = dr.textlength(t, font=f)
    dr.rounded_rectangle(((W - tw) / 2 - 30, H - 170, (W + tw) / 2 + 30, H - 100), 35, fill=(0, 0, 0)); dr.text(((W - tw) / 2, H - 166), t, font=f, fill=YEL)
    ctext(im, 'Unofficial fan project, not affiliated with Supercell.', H - 80, G(30), MUTED, shadow=False)


def pill(im, txt, y, size=46, fill=YEL, fg=NAVY):
    dr = ImageDraw.Draw(im); f = F(size); tw = dr.textlength(txt, font=f); x = (W - tw) / 2
    dr.rounded_rectangle((x - 34, y - 12, x + tw + 34, y + size + 16), 40, fill=fill); dr.text((x, y), txt, font=f, fill=fg)


def pct(v):
    return f'{v * 100:.1f}%'


battles = f"{r['battles']:,}"
slides = []

# 1 hook
im = bg(); logo(im)
ctext(im, VERDICT[0], 240, F(170), WHITE); ctext(im, VERDICT[1], 420, F(200), YEL)
portrait(im, 600, 680)
pill(im, f'First stats from {battles} battles', 1420, size=50)
mark(im); slides.append(im)

# 2 verdict
im = bg(); logo(im)
ctext(im, VERDICT[2], 230, F(200), VERDICT[3])
d = ImageDraw.Draw(im); d.rounded_rectangle((390, 520, 690, 820), 50, fill=TIER_COLOR.get(tier, MUTED))
f = F(260); d.text((540 - d.textlength(tier, font=f) / 2, 530), tier, font=f, fill=NAVY)
ctext(im, f"#{r['rank']} OF {r['of']} BRAWLERS", 880, F(100), WHITE)
ctext(im, 'in trophy matches this week', 1010, G(50), MUTED, shadow=False)
ctext(im, f"{pct(r['winRate'])} WIN RATE", 1120, F(110), YEL)
ctext(im, f"vs {pct(r['baseline'])} for the average brawler", 1250, G(50), WHITE, shadow=False)
if not r.get('inRanked'):
    ctext(im, 'Not in competitive Ranked yet.', 1400, G(46), MUTED, shadow=False)
mark(im); slides.append(im)

# 3 best maps
im = bg(); logo(im)
ctext(im, 'BEST MAPS', 240, F(130), YEL)
ctext(im, 'Win rate vs every brawler on that map', 390, G(46), WHITE, shadow=False)
y = 480
for m in r['maps'][:5]:
    d = ImageDraw.Draw(im); d.rounded_rectangle((60, y, 1020, y + 190), 32, fill=CARD)
    f = F(62)
    while f.size > 36 and d.textlength(m['map'], font=f) > 640: f = F(f.size - 4)
    d.text((100, y + 28), m['map'], font=f, fill=WHITE); d.text((100, y + 110), MODES.get(m['mode'], m['mode']), font=G(40), fill=MUTED)
    t = pct(m['wr']); f = F(66); d.text((980 - d.textlength(t, font=f), y + 28), t, font=f, fill=GREEN if m['wr'] >= m['base'] else RED)
    t = f"{(m['wr'] - m['base']) * 100:+.1f} vs map"; f = G(36); d.text((980 - d.textlength(t, font=f), y + 118), t, font=f, fill=MUTED)
    y += 215
mark(im); slides.append(im)

# 4 build
b = r['build']
sp = (b.get('starPower') or [{}])[0]; ga = (b.get('gadget') or [{}])[0]; gears = b.get('gears') or []
gear_label = ' + '.join((gear_names.get(g['id']) or 'Gear').title() for g in gears) or 'Not enough data'
gear_share = ' and '.join(f"{round(g['share'] * 100)}%" for g in gears)
rows = [('STAR POWER', sp.get('name') or 'Not enough data', f"{round(sp.get('share', 0) * 100)}% of owners" if sp else ''),
        ('GADGET', ga.get('name') or 'Not enough data', f"{round(ga.get('share', 0) * 100)}% of owners" if ga else ''),
        ('GEARS', gear_label, f'{gear_share} of owners' if gears else '')]
im = bg(); logo(im)
ctext(im, 'THE BUILD', 240, F(140), YEL)
ctext(im, f'What {name} owners run', 400, G(50), WHITE, shadow=False)
y = 520
for k, v, p in rows:
    d = ImageDraw.Draw(im); d.rounded_rectangle((60, y, 1020, y + 260), 36, fill=CARD, outline=(70, 85, 160), width=3)
    f = F(86)
    while f.size > 40 and d.textlength(v, font=f) > 880: f = F(f.size - 4)
    d.text((100, y + 30), k, font=F(46), fill=YEL); d.text((100, y + 95), v, font=f, fill=WHITE); d.text((100, y + 195), p, font=G(40), fill=MUTED)
    y += 290
mark(im); slides.append(im)

# 5 follow
im = bg(); logo(im)
ctext(im, 'FOLLOW', 330, F(190), YEL)
ctext(im, 'FOR EVERY NEW BRAWLER', 540, F(90), WHITE)
ctext(im, 'First stats, best maps and builds', 720, G(52), WHITE, shadow=False)
ctext(im, 'the moment they come out.', 785, G(52), WHITE, shadow=False)
portrait(im, 380, 900)
pill(im, f'Full {name} stats: link in bio', 1380, size=56)
mark(im); slides.append(im)

for i, s in enumerate(slides, 1):
    s.save(f'{OUT}/{i}.jpg', quality=92)

slug = name.lower().replace(' ', '-').replace('.', '').replace("'", '')
best = ', '.join(m['map'] for m in r['maps'][:5])
answer = {'S': 'Yes 😳', 'A': 'Yes', 'B': 'Pretty good', 'C': 'Not really'}.get(tier, 'Right now, no')
question = 'broken' if tier == 'S' else 'good'
title = f"Is {name} {question}? First stats: {tier} tier, #{r['rank']} of {r['of']} brawlers"[:90]
description = (
    f"Is {name} {question}? {answer}. After the first days {name} is {tier} tier, #{r['rank']} of {r['of']} brawlers in trophy matches: "
    f"{pct(r['winRate'])} win rate vs {pct(r['baseline'])} for the average brawler, from {battles} battles."
    + ('' if r.get('inRanked') else ' Not in competitive Ranked yet.') + "\n\n"
    + (f"Best maps: {best}.\n" if best else '')
    + f"Build most owners run: {sp.get('name') or '?'}, {ga.get('name') or '?'}, {gear_label} gears.\n\n"
    f"Full {name} stats, counters and builds: https://brawlzone.net/brawlers/{slug}\n"
    "Follow for every new brawler's first stats.\n"
    "Unofficial fan project, not affiliated with Supercell.\n"
    f"#brawlstars #{slug.replace('-', '')} #brawlstars{slug.replace('-', '')} #newbrawler #brawlstarstips #brawlzone"
)
json.dump({'count': len(slides), 'title': title, 'description': description, 'brawler': name},
          open(f'{OUT}/meta.json', 'w'), indent=1, ensure_ascii=False)
print(len(slides))
