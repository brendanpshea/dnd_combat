#!/usr/bin/env python3
"""
Process generated adventure *location* art (art/source/scene-*.png) into web
assets: downscale to a web-appropriate landscape size and convert to opaque
WebP. Sibling to process_backgrounds.py (top-down combat backdrops) and
process.py (token/portrait character art) — kept separate because location
scenes are landscape, opaque, and keyed to the reusable location ids in
src/data/adventure-art.ts rather than the four combat themes.

NPC portraits are NOT handled here — they are transparent character busts and
go through process.py alongside the hero/monster portraits.

See art/adventure-prompts.md for the generation brief and integration plan.

Usage: python art/process_scenes.py
"""
import os
import glob
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "source")
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "art")
# Landscape 16:9, a bit larger than a token since it fills a banner / map.
WIDTH, HEIGHT = 1280, 720
QUALITY = 80

os.makedirs(OUT, exist_ok=True)
total = 0
have = []

for src in sorted(glob.glob(os.path.join(SRC, "scene-*.png"))):
    name = os.path.splitext(os.path.basename(src))[0]  # e.g. "scene-loc-tavern"
    im = Image.open(src).convert("RGB")  # opaque backdrop, no alpha needed
    if im.size != (WIDTH, HEIGHT):
        im = im.resize((WIDTH, HEIGHT), Image.LANCZOS)
    dst = os.path.join(OUT, f"{name}.webp")
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    total += os.path.getsize(dst)
    have.append(name)

print(f"scenes: {len(have)} processed -> {have}")
if not have:
    print("no source art found (expected art/source/scene-loc-*.png)")
print(f"total WebP size: {total/1024:.0f} KB")
