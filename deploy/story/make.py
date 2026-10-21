"""The daily Instagram Story (2026-10-21), drawn by brawlzone-ig-story.

    python make.py <tier-story.png> <prompt> <out.jpg> <assets dir>

Takes the site's own tier-list story image (/tier-list/ranked/story/<rank>/en)
and fills the empty strip under it with the ask: a question to reply to, and
a pill pointing at the bio link. Stories from the API cannot carry a link
sticker, so the picture has to say where the link is.

Drawn in the gap between the last tier and the site footer, or under the
footer when the list leaves no gap; never lower, where Instagram lays its
reply bar over a Story.
"""
import sys

from PIL import Image, ImageDraw, ImageFont

src, prompt, out, assets = sys.argv[1:5]
W, H = 1080, 1920
YEL = (255, 199, 44); WHITE = (245, 247, 255); MUTED = (176, 186, 222); NAVY = (11, 15, 29)
F = lambda s: ImageFont.truetype(f'{assets}/LilitaOne-Regular.ttf', s)
G = lambda s: ImageFont.truetype(f'{assets}/Geist-Regular.ttf', s)

im = Image.open(src).convert('RGB').resize((W, H))
d = ImageDraw.Draw(im)


def centre(txt, y, font, fill, shadow=True):
    while font.size > 30 and d.textlength(txt, font=font) > 960:
        font = (F if 'Lilita' in font.path else G)(font.size - 4)
    x = (W - d.textlength(txt, font=font)) / 2
    if shadow:
        d.text((x + 3, y + 4), txt, font=font, fill=(0, 0, 0))
    d.text((x, y), txt, font=font, fill=fill)


# Where the tiers end: the lowest row above the footer (which starts near
# y=1490) with anything drawn on it. A list with full A and B tiers runs to
# about 1280; a thin one stops near 1170.
FOOTER = 1480
px = im.load()
bg = px[W - 10, FOOTER - 20]
end = 300
for y in range(FOOTER - 30, 300, -2):
    if any(sum(abs(a - b) for a, b in zip(px[x, y], bg)) > 60 for x in range(80, 1000, 6)):
        end = y
        break
BLOCK = 190  # question (100) + pill (90)
top = end + 30 + max(0, (FOOTER - end - 30 - BLOCK) // 2)
if top + BLOCK > FOOTER:
    top = 1620  # no room in the gap: under the footer, still above the reply bar

centre(prompt, top, F(64), WHITE)
f = F(54); txt = "YOUR RANK'S FULL LIST: LINK IN BIO"
tw = d.textlength(txt, font=f)
while tw > 900:
    f = F(f.size - 2); tw = d.textlength(txt, font=f)
x = (W - tw) / 2
d.rounded_rectangle((x - 40, top + 100, x + tw + 40, top + 100 + f.size + 36), 46, fill=YEL)
d.text((x, top + 114), txt, font=f, fill=NAVY)
im.save(out, quality=92)
print('ok')
