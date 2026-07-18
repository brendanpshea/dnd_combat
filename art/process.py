#!/usr/bin/env python3
"""
Process generated source art (art/source/*.png, 512px RGBA) into web assets:
downscale to 256px and convert to WebP with alpha. Framing is preserved (no
per-image trim) so the intended relative size tiers survive.

Only ids the engine actually references are emitted; unreferenced source art
(e.g. class/species variants not yet wired) stays in source for later.

Usage: python art/process.py
"""
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "source")
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "art")
SIZE = 256
QUALITY = 82

# Engine ids that have a token/portrait slot (classIds + monster ids).
IDS = [
    "fighter", "wizard", "cleric", "rogue",
    "goblin-warrior", "goblin-boss", "skeleton", "wolf", "zombie", "ogre",
    "bandit", "dire-wolf", "ghoul", "giant-spider", "acolyte",
    "kobold", "scout", "orc", "brown-bear", "cult-fanatic", "animated-armor",
    "orc-barbarian", "dragonborn-paladin", "gnome-bard", "halfling-rogue", "tiefling-warlock",
    "dwarf-berserker", "elf-archer", "human-bard", "bandit-captain",
    "knight", "minotaur", "ettin", "priest", "ogre-mage",
]

os.makedirs(OUT, exist_ok=True)
total = 0
have_token, have_portrait = [], []

for kind, bucket in (("token", have_token), ("portrait", have_portrait)):
    for cid in IDS:
        src = os.path.join(SRC, f"{kind}-{cid}.png")
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert("RGBA")
        if im.size != (SIZE, SIZE):
            im = im.resize((SIZE, SIZE), Image.LANCZOS)
        dst = os.path.join(OUT, f"{kind}-{cid}.webp")
        im.save(dst, "WEBP", quality=QUALITY, method=6)
        total += os.path.getsize(dst)
        bucket.append(cid)

print(f"tokens:    {len(have_token)} -> {sorted(have_token)}")
print(f"portraits: {len(have_portrait)} -> {sorted(have_portrait)}")
print(f"total WebP size: {total/1024:.0f} KB")
