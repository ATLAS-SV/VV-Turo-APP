"""Generate the VV app icon, splash and in-app logo from a theme in src/ui/theme.ts.

Usage: python3 scripts/make-logo.py [themeKey] [outDir]
Defaults to ACTIVE_THEME and ./assets.
"""
import re, sys, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'src/ui/theme.ts')).read()
key = sys.argv[1] if len(sys.argv) > 1 else re.search(r"ACTIVE_THEME: ThemeKey = '(\w+)'", src).group(1)
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets')
block = re.search(key + r": \{(.*?)\}", src, re.S).group(1)
col = lambda name: tuple(int(re.search(name + r": '#(\w{6})'", block).group(1)[i:i+2], 16) for i in (0, 2, 4)) + (255,)
BG, FG = col('primaryDark'), col('accent')
FONT = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'

def mark(px, bg=BG, fg=FG, rounded=True, ring=True, scale=0.42):
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if bg:
        if rounded: d.rounded_rectangle([0, 0, px - 1, px - 1], radius=int(px * 0.22), fill=bg)
        else: d.rectangle([0, 0, px, px], fill=bg)
    if ring:
        m = int(px * 0.16); d.rounded_rectangle([m, m, px - m, px - m], radius=int(px * 0.12), outline=fg, width=max(2, px // 90))
    f = ImageFont.truetype(FONT, int(px * scale)); b = d.textbbox((0, 0), 'VV', font=f)
    d.text((px / 2 - (b[2] - b[0]) / 2 - b[0], px / 2 - (b[3] - b[1]) / 2 - b[1]), 'VV', font=f, fill=fg)
    return im

os.makedirs(out, exist_ok=True)
mark(1024, rounded=False).save(f'{out}/icon.png')  # iOS rounds the corners itself
mark(1024, bg=None, ring=False, scale=0.3).save(f'{out}/android-icon-foreground.png')  # fits Android's round mask
Image.new('RGBA', (1024, 1024), BG).save(f'{out}/android-icon-background.png')
mark(1024, bg=None, ring=False, scale=0.3, fg=(255, 255, 255, 255)).save(f'{out}/android-icon-monochrome.png')
mark(400).save(f'{out}/splash-icon.png')
mark(196).save(f'{out}/favicon.png')
mark(512).save(f'{out}/logo-mark.png')
print(f'Logo generated for theme {key} -> {out}')
