#!/usr/bin/env python3
"""
Slice multi-scene sheet images (4 horizontal landscape rows stacked vertically)
into individual scene PNGs in art/source/ (e.g. scene-loc-village.png).

Usage:
  python art/slice_scenes.py <sheet_image_path> id1 id2 id3 id4

Example:
  python art/slice_scenes.py art/raw/scenes-batch-1.png loc-village loc-town loc-tavern loc-market
"""
import sys
import os
from PIL import Image

SRC_DIR = os.path.join(os.path.dirname(__file__), "source")
os.makedirs(SRC_DIR, exist_ok=True)

def slice_sheet(sheet_path: str, ids: list[str], margin: int = 4):
    if not os.path.exists(sheet_path):
        print(f"Error: file not found: {sheet_path}")
        sys.exit(1)

    im = Image.open(sheet_path).convert("RGB")
    width, height = im.size
    num_rows = len(ids)
    row_height = height / num_rows

    print(f"Loaded {sheet_path} ({width}x{height}), slicing into {num_rows} rows (margin={margin}px)...")

    for i, scene_id in enumerate(ids):
        top = int(round(i * row_height)) + margin
        bottom = int(round((i + 1) * row_height)) - margin
        if bottom <= top:
            top = int(round(i * row_height))
            bottom = int(round((i + 1) * row_height))

        # Crop row strip
        strip = im.crop((0, top, width, bottom))

        out_path = os.path.join(SRC_DIR, f"scene-{scene_id}.png")
        strip.save(out_path, "PNG")
        print(f"  Saved row {i+1} ({strip.width}x{strip.height}) -> {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python art/slice_scenes.py <sheet_image_path> <id1> <id2> ...")
        sys.exit(1)

    sheet = sys.argv[1]
    scene_ids = sys.argv[2:]
    slice_sheet(sheet, scene_ids)
