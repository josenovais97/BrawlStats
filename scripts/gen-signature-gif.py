"""
Renders public/brand/signature.gif -- the animated rule for the email signature.

A GIF because Gmail strips <style> blocks and CSS animation, so a raster loop is
the only thing that moves in an inbox.

It is a *rule*, not a banner. The app icon above it already carries the mark, so
an earlier version that repeated the wordmark underneath was branding the same
thing twice -- the commonest way a signature stops looking professional. What is
left is the readout itself: three gold bars that fill, hold and drain, the same
shape the Skill Score panel draws on a player page.

Ground is sampled from apple-icon.png (11,16,32), so the rule and the mark share
a background and read as one object rather than two pasted images. That also
means it holds up in a dark-mode inbox, where a white strip would glare.

Square ends, not rounded: this is a data readout, and at 17px tall a radius is
noise. Regenerate with:  python3 scripts/gen-signature-gif.py
"""
import os

from PIL import Image, ImageDraw

W, H = 780, 68                  # 2x; displayed at 390x34
BG = (11, 16, 32)               # sampled from apple-icon.png
GOLD = (255, 197, 61)
GOLD_DEEP = (255, 171, 0)
TRACK = (28, 35, 60)

PAD_X, BAR_H, BAR_GAP = 16, 12, 10
# Uneven, because a real readout is. Even bars look like a loading spinner.
BAR_FILL = [0.94, 0.61, 0.79]

FILL, HOLD, DRAIN, PAUSE = 9, 6, 9, 4
FRAMES = FILL + HOLD + DRAIN + PAUSE


def ease(t: float) -> float:
    """Ease-in-out. Linear looks mechanical; this looks deliberate."""
    return 3 * t * t - 2 * t * t * t


def progress(i: int) -> float:
    if i < FILL:
        return ease(i / FILL)
    if i < FILL + HOLD:
        return 1.0
    if i < FILL + HOLD + DRAIN:
        return 1.0 - ease((i - FILL - HOLD) / DRAIN)
    return 0.0


def build():
    bar_w = W - PAD_X * 2
    top = (H - (BAR_H * 3 + BAR_GAP * 2)) // 2
    frames = []

    for i in range(FRAMES):
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, W, 2], fill=GOLD_DEEP)   # the only chrome

        p = progress(i)
        for n, target in enumerate(BAR_FILL):
            y = top + n * (BAR_H + BAR_GAP)
            local = max(0.0, min(1.0, p * 1.25 - n * 0.12))
            d.rectangle([PAD_X, y, PAD_X + bar_w, y + BAR_H], fill=TRACK)
            w = bar_w * target * local
            if w >= 1:
                d.rectangle([PAD_X, y, PAD_X + w, y + BAR_H], fill=GOLD)

        frames.append(img.convert("P", palette=Image.ADAPTIVE, colors=8))

    out = "public/brand/signature.gif"
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=85, loop=0, optimize=True, disposal=2)
    print(f"wrote {out} - {os.path.getsize(out)/1024:.1f} KB, {W}x{H}")


build()
