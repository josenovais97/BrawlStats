"""
Renders public/brand/signature.gif -- the animated wordmark for the email
signature.

A GIF because Gmail strips <style> blocks and CSS animation, so a raster loop
is the only thing that actually moves in an inbox. Deliberately slow and
low-contrast: a signature sits beside a message, and anything fast or loud
there reads as an advert.

Hosted on brawlzone.net rather than an image host so the signature has no
third-party dependency and cannot break when someone else's free tier ends.

Regenerate with:  python3 scripts/gen-signature-gif.py
"""
from PIL import Image, ImageDraw, ImageFont
import math, os

W, H = 760, 104          # 2x; displayed at 380x52
BG = (11, 15, 29)
GOLD = (255, 197, 61)
TEXT = "BRAWLZONE"
TRACK = 7                 # letter spacing, px
FRAMES = 28
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 46)

def draw_tracked(d, x, y, s, fill):
    for ch in s:
        d.text((x, y), ch, font=FONT, fill=fill)
        x += d.textlength(ch, font=FONT) + TRACK
    return x

# measure
probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
width = sum(probe.textlength(c, font=FONT) + TRACK for c in TEXT) - TRACK
x0 = (W - width) / 2
y0 = (H - 52) / 2

# A mask of just the glyphs, so the sweep only lights the letters.
mask = Image.new("L", (W, H), 0)
draw_tracked(ImageDraw.Draw(mask), x0, y0, TEXT, 255)

frames = []
for i in range(FRAMES):
    base = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(base)

    # Hairline rule under the wordmark, in brand gold at low opacity.
    d.rectangle([0, H - 4, W, H], fill=(58, 45, 12))

    draw_tracked(d, x0, y0, TEXT, GOLD)

    # The sweep: a soft vertical band of near-white travelling left to right,
    # applied only where the glyph mask is set. Eased so it lingers off-screen
    # rather than strobing on a short loop.
    t = i / FRAMES
    centre = -0.35 * W + t * (W * 1.7)
    sweep = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(sweep)
    band = 150
    for dx in range(-band, band):
        a = int(230 * math.exp(-(dx / (band * 0.34)) ** 2))
        if a > 0:
            sd.line([(centre + dx, 0), (centre + dx, H)], fill=a)
    sweep = Image.composite(sweep, Image.new("L", (W, H), 0), mask)

    highlight = Image.new("RGB", (W, H), (255, 252, 240))
    base = Image.composite(highlight, base, sweep)
    frames.append(base.convert("P", palette=Image.ADAPTIVE, colors=64))

out = "public/brand/signature.gif"
frames[0].save(out, save_all=True, append_images=frames[1:],
               duration=70, loop=0, optimize=True, disposal=2)
print(f"wrote {out} — {os.path.getsize(out)/1024:.0f} KB, {FRAMES} frames, {W}x{H}")
