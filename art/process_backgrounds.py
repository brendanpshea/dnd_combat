#!/usr/bin/env python3
"""
Process generated arena background art (art/source/bg-*.png) into web assets:
downscale to a web-appropriate size and convert to opaque WebP. Sibling to
process.py, which handles token/portrait character art — kept separate
because backgrounds have a different source size, no alpha channel, and a
fixed, small id set (the four MapTheme values in src/data/maps.ts).

See art/arena-prompts.md for the generation brief and integration plan.

Usage: python art/process_backgrounds.py
"""
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "source")
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "art")
SIZE = 1024
QUALITY = 78

# MapTheme values (src/data/maps.ts) — one background per theme, reused
# across every map that shares it.
THEMES = ["stone", "forest", "graveyard", "ember"]

os.makedirs(OUT, exist_ok=True)
total = 0
have = []

for theme in THEMES:
    src = os.path.join(SRC, f"bg-{theme}.png")
    if not os.path.exists(src):
        continue
    im = Image.open(src).convert("RGB")  # opaque backdrop, no alpha needed
    if im.size != (SIZE, SIZE):
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
    dst = os.path.join(OUT, f"bg-{theme}.webp")
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    total += os.path.getsize(dst)
    have.append(theme)

print(f"backgrounds: {len(have)}/{len(THEMES)} -> {sorted(have)}")
missing = sorted(set(THEMES) - set(have))
if missing:
    print(f"missing source art for: {missing} (expected art/source/bg-<theme>.png)")
print(f"total WebP size: {total/1024:.0f} KB")
