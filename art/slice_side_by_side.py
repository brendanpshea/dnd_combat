#!/usr/bin/env python3
"""
Slice side-by-side 1:1 image sheets (left=PORTRAIT, right=TOKEN) with green screen
backgrounds into individual transparent RGBA PNGs in art/source/:
  portrait-<id>.png and token-<id>.png

Usage:
  python art/slice_side_by_side.py <sheet_image_path> <id>
"""
import sys
import os
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from slice_portraits import remove_greenscreen

SRC_DIR = os.path.join(os.path.dirname(__file__), "source")
os.makedirs(SRC_DIR, exist_ok=True)

def slice_side_by_side(sheet_path: str, item_id: str):
    if not os.path.exists(sheet_path):
        print(f"Error: file not found: {sheet_path}")
        sys.exit(1)

    im = Image.open(sheet_path).convert("RGB")
    width, height = im.size
    w_half = width // 2

    # Crop left (portrait) and right (token)
    p_crop = im.crop((0, 0, w_half, height)).resize((512, 512), Image.LANCZOS)
    t_crop = im.crop((w_half, 0, width, height)).resize((512, 512), Image.LANCZOS)

    p_rgba = remove_greenscreen(p_crop)
    t_rgba = remove_greenscreen(t_crop)

    p_out = os.path.join(SRC_DIR, f"portrait-{item_id}.png")
    t_out = os.path.join(SRC_DIR, f"token-{item_id}.png")

    p_rgba.save(p_out, "PNG")
    t_rgba.save(t_out, "PNG")

    print(f"Processed {item_id}:")
    print(f"  Portrait -> {p_out}")
    print(f"  Token    -> {t_out}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python art/slice_side_by_side.py <sheet_image_path> <id>")
        sys.exit(1)

    slice_side_by_side(sys.argv[1], sys.argv[2])
