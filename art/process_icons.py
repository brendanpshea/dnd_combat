#!/usr/bin/env python3
"""
Process generated spell/condition icon source art (art/source/icon-*.png,
512px RGBA) into web assets: downscale to WebP with alpha.

Two size tiers:
  - spell bar/tray icons render small, so 96px is plenty (~4-6 KB each).
  - board-facing icons (a summon token, the web cell) can render larger, so
    those get 128px.

Only ids the game references are emitted; the source stays the master. Matches
the id ↔ file convention the frontend expects: `icon-<spellId>.webp`.

Usage: python art/process_icons.py
"""
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "source")
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "art")
QUALITY = 82

# Spell ids with an icon (file: icon-<id>.png). These render in the action bar,
# the spell tray, and the prepare lists at small size.
SPELL_ICONS = [
    "acid-splash", "fire-bolt", "guidance", "minor-illusion", "poison-spray",
    "ray-of-frost", "sacred-flame", "shocking-grasp", "true-strike",
    "animal-friendship", "bane", "bless", "burning-hands", "color-spray",
    "command", "cure-wounds", "faerie-fire", "false-life", "guiding-bolt",
    "healing-word", "hunters-mark", "inflict-wounds", "mage-armor",
    "magic-missile", "ray-of-sickness", "shield", "shield-of-faith", "sleep",
    "aid", "blindness", "hold-person", "invisibility", "lesser-restoration",
    "misty-step", "scorching-ray", "spiritual-weapon", "suggestion", "web",
    "dispel-magic", "fear", "fireball", "haste", "lightning-bolt",
    "mass-healing-word", "spiritual-guardians", "find-familiar", "thunderwave",
    "breath-weapon",
]

# Icons that also render on the board (bigger): a roaming summon, the web cell.
BOARD_ICONS = {"spiritual-weapon", "web", "fireball"}

# Larger for the board-facing ones, small for the rest.
SIZE_SMALL = 96
SIZE_BOARD = 128

os.makedirs(OUT, exist_ok=True)
total = 0
emitted = []

for sid in SPELL_ICONS:
    src = os.path.join(SRC, f"icon-{sid}.png")
    if not os.path.exists(src):
        print(f"  (skip, no source) icon-{sid}.png")
        continue
    size = SIZE_BOARD if sid in BOARD_ICONS else SIZE_SMALL
    im = Image.open(src).convert("RGBA")
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    dst = os.path.join(OUT, f"icon-{sid}.webp")
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    total += os.path.getsize(dst)
    emitted.append(sid)

print(f"icons: {len(emitted)} -> {sorted(emitted)}")
print(f"total WebP size: {total/1024:.0f} KB")
