"""
Renders public/brand/signature.gif -- the animated mark for the email signature.

A GIF because Gmail strips <style> blocks and CSS animation, so a raster loop is
the only thing that moves in an inbox.

The animation is the product, not an effect: three gold bars fill, hold, and
drain, which is the same readout the Skill Score panel uses on a player page. A
shimmer sweep would have looked identical on any brand; bars filling say "this
is a stats site" before the reader has finished the wordmark.

Symmetric loop -- fill, hold, drain, pause -- so it never snaps back to the
start. Slow and low-contrast on purpose: a signature sits beside a message, and
anything fast there reads as an advert.

Hosted on brawlzone.net rather than an image host, so the signature has no
third-party dependency to outlive.

Regenerate with:  python3 scripts/gen-signature-gif.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 780, 124                 # 2x; displayed at 390x62
BG = (11, 15, 29)               # --ink
GOLD = (255, 197, 61)           # --brand
GOLD_DEEP = (255, 171, 0)       # --brand-strong
TRACK = (30, 37, 64)
MUTED = (122, 133, 166)

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
F_MARK = ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 42)
F_SUB = ImageFont.truetype(f"{FONT_DIR}/DejaVuSans.ttf", 19)

MARK, SPACING = "BRAWLZONE", 6
SUB = "Brawl Stars stats, tier lists & draft tools"

# Bar geometry. Three, because that is what the Skill Score panel shows:
# Ranked, Trophy push, Mastery -- and their relative lengths echo a real
# readout rather than three identical stripes.
BAR_X, BAR_W, BAR_H, BAR_GAP = 470, 268, 12, 20
BAR_FILL = [0.92, 0.58, 0.76]

# Fewer, slower frames: the loop reads the same and the file is a third
# smaller, which matters for something attached to every message sent.
FILL, HOLD, DRAIN, PAUSE = 9, 6, 9, 4
FRAMES = FILL + HOLD + DRAIN + PAUSE


def ease(t: float) -> float:
    """Ease-in-out. A linear bar looks mechanical; this looks deliberate."""
    return 3 * t * t - 2 * t * t * t


def tracked(draw, x, y, text, font, fill):
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + SPACING
    return x


def mark_width(draw):
    return sum(draw.textlength(c, font=F_MARK) + SPACING for c in MARK) - SPACING


def progress(i: int) -> float:
    if i < FILL:
        return ease(i / FILL)
    if i < FILL + HOLD:
        return 1.0
    if i < FILL + HOLD + DRAIN:
        return 1.0 - ease((i - FILL - HOLD) / DRAIN)
    return 0.0


def rounded_bar(draw, x, y, w, h, colour):
    if w <= 0:
        return
    r = h / 2
    if w <= h:
        draw.ellipse([x, y, x + w, y + h], fill=colour)
        return
    draw.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=colour)


def build():
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    mw = mark_width(probe)
    frames = []

    for i in range(FRAMES):
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)

        # A gold hairline along the top edge, the only chrome on the strip.
        d.rectangle([0, 0, W, 3], fill=GOLD_DEEP)

        tracked(d, 28, 26, MARK, F_MARK, GOLD)
        d.text((30, 82), SUB, font=F_SUB, fill=MUTED)

        p = progress(i)
        for n, target in enumerate(BAR_FILL):
            y = 28 + n * (BAR_H + BAR_GAP)
            # Staggered, so they read as a cascade rather than one control.
            local = max(0.0, min(1.0, p * 1.25 - n * 0.12))
            rounded_bar(d, BAR_X, y, BAR_W, BAR_H, TRACK)
            rounded_bar(d, BAR_X, y, BAR_W * target * local, BAR_H, GOLD)

        frames.append(img.convert("P", palette=Image.ADAPTIVE, colors=16))

    out = "public/brand/signature.gif"
    frames[0].save(
        out,
        save_all=True,
        append_images=frames[1:],
        duration=85,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"wrote {out} - {os.path.getsize(out)/1024:.0f} KB, {FRAMES} frames, {W}x{H}")


build()
