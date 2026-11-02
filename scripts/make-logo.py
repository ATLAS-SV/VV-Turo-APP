"""Generate the VV app icon, home-screen icons, splash and in-app logo from src/ui/logoColors.ts.

The logo is a gold VV (with a thin gold frame) on the logo gradient: bright violet in the
bottom-left corner to deep purple in the top-right.

Usage: python3 scripts/make-logo.py [outDir]   (defaults to ./assets; home-screen icons go to ./public)
"""
import math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'src/ui/logoColors.ts')).read()
hexcol = lambda name: tuple(int(re.search(name + r": '#(\w{6})'", src).group(1)[i:i + 2], 16) for i in (0, 2, 4))
FROM, MID, TO, GOLD = hexcol('from'), hexcol('mid'), hexcol('to'), hexcol('gold') + (255,)
ANGLE = float(re.search(r'LOGO_ANGLE = (\d+)', src).group(1))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets')
public = os.path.join(ROOT, 'public')
FONT = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'


def gradient(px):
    """Same as CSS linear-gradient(ANGLE deg, FROM 0%, MID 48%, TO 100%) on a px x px square."""
    a = math.radians(ANGLE)
    dx, dy = math.sin(a), -math.cos(a)  # CSS: 0deg points up, 90deg right
    length = abs(px * dx) + abs(px * dy)
    ys, xs = np.mgrid[0:px, 0:px].astype(np.float64) + 0.5
    t = ((xs - px / 2) * dx + (ys - px / 2) * dy) / length + 0.5
    t = np.clip(t, 0, 1)[..., None]
    f, m, e = (np.array(c, dtype=np.float64) for c in (FROM, MID, TO))
    lo = f + (m - f) * np.clip(t / 0.48, 0, 1)
    hi = m + (e - m) * np.clip((t - 0.48) / 0.52, 0, 1)
    rgb = np.where(t <= 0.48, lo, hi)
    alpha = np.full((px, px, 1), 255.0)
    return Image.fromarray(np.concatenate([rgb, alpha], axis=2).round().astype(np.uint8), 'RGBA')


def mark(px, bg=True, fg=GOLD, rounded=True, ring=True, scale=0.42):
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    if bg:
        g = gradient(px)
        if rounded:
            mask = Image.new('L', (px, px), 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, px - 1, px - 1], radius=int(px * 0.22), fill=255)
            im.paste(g, (0, 0), mask)
        else:
            im = g
    d = ImageDraw.Draw(im)
    if ring:
        m = int(px * 0.16)
        d.rounded_rectangle([m, m, px - m, px - m], radius=int(px * 0.12), outline=fg, width=max(2, px // 90))
    f = ImageFont.truetype(FONT, int(px * scale))
    b = d.textbbox((0, 0), 'VV', font=f)
    d.text((px / 2 - (b[2] - b[0]) / 2 - b[0], px / 2 - (b[3] - b[1]) / 2 - b[1]), 'VV', font=f, fill=fg)
    return im


os.makedirs(out, exist_ok=True)
icon = mark(1024, rounded=False)  # iOS rounds the corners itself
icon.save(f'{out}/icon.png')
mark(1024, bg=False, ring=False, scale=0.3).save(f'{out}/android-icon-foreground.png')  # fits Android's round mask
gradient(1024).save(f'{out}/android-icon-background.png')
mark(1024, bg=False, ring=False, scale=0.3, fg=(255, 255, 255, 255)).save(f'{out}/android-icon-monochrome.png')
mark(400).save(f'{out}/splash-icon.png')
mark(196).save(f'{out}/favicon.png')
mark(512).save(f'{out}/logo-mark.png')
# Home-screen web app icons (square; iPhone rounds them).
square = icon.convert('RGB')
for name, size in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
    square.resize((size, size), Image.LANCZOS).save(os.path.join(public, name))
print(f'Logo generated -> {out} and {public}')
