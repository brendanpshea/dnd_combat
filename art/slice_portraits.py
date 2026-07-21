#!/usr/bin/env python3
"""
Slice multi-portrait 2x2 grid images with green screen backgrounds into
individual transparent RGBA PNGs in art/source/ (e.g. portrait-npc-innkeeper.png).

Usage:
  python art/slice_portraits.py <sheet_image_path> id1 id2 id3 id4

The 4 ids correspond to the 2x2 grid positions:
  Top-Left: id1
  Top-Right: id2
  Bottom-Left: id3
  Bottom-Right: id4

Example:
  python art/slice_portraits.py art/raw/npc-batch-1.png npc-innkeeper npc-elder npc-merchant npc-guard
"""
import sys
import os
from PIL import Image

SRC_DIR = os.path.join(os.path.dirname(__file__), "source")
os.makedirs(SRC_DIR, exist_ok=True)

def remove_greenscreen(img: Image.Image) -> Image.Image:
    """
    Convert a green screen RGB image into an RGBA image using flood-fill from the corners
    so green clothing or items inside the character silhouette are never keyed out.
    """
    img = img.convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # Track background pixels identified by flood fill
    is_bg = [[False] * height for _ in range(width)]

    def is_green_screen_pixel(r, g, b):
        # Bright chroma key green detection
        return g > 110 and g > r * 1.15 and g > b * 1.15

    # BFS Flood fill from image borders/corners
    from collections import deque
    queue = deque()

    # Seed all 4 outer edges
    for x in range(width):
        for y in (0, height - 1):
            r, g, b, _ = pixels[x, y]
            if is_green_screen_pixel(r, g, b) and not is_bg[x][y]:
                is_bg[x][y] = True
                queue.append((x, y))

    for y in range(height):
        for x in (0, width - 1):
            r, g, b, _ = pixels[x, y]
            if is_green_screen_pixel(r, g, b) and not is_bg[x][y]:
                is_bg[x][y] = True
                queue.append((x, y))

    # 4-directional flood fill
    neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        cx, cy = queue.popleft()
        for dx, dy in neighbors:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height and not is_bg[nx][ny]:
                r, g, b, _ = pixels[nx, ny]
                if is_green_screen_pixel(r, g, b):
                    is_bg[nx][ny] = True
                    queue.append((nx, ny))

    # Apply transparency to flood-filled background pixels & soft anti-aliasing on edges
    for y in range(height):
        for x in range(width):
            if is_bg[x][y]:
                r, g, b, a = pixels[x, y]
                diff = g - max(r, b)
                if diff > 30:
                    pixels[x, y] = (0, 0, 0, 0)
                else:
                    alpha = max(0, min(255, int(255 * (1.0 - (diff - 10) / 20.0))))
                    new_g = int((r + b) / 2)
                    pixels[x, y] = (r, new_g, b, alpha)
            else:
                # Character interior pixel: preserve completely, only suppress minor green fringe spill if any
                r, g, b, a = pixels[x, y]
                if g > 150 and g > r * 1.3 and g > b * 1.3:
                    # Minor edge fringe spill
                    new_g = int((r + b) / 2)
                    pixels[x, y] = (r, new_g, b, a)

    return img

def slice_grid_2x2(sheet_path: str, ids: list[str], margin: int = 6):
    if not os.path.exists(sheet_path):
        print(f"Error: file not found: {sheet_path}")
        sys.exit(1)

    if len(ids) != 4:
        print("Error: exactly 4 ids required for 2x2 grid (TL, TR, BL, BR)")
        sys.exit(1)

    im = Image.open(sheet_path).convert("RGB")
    width, height = im.size
    w_half, h_half = width // 2, height // 2

    # Apply margin cropping to prevent grid divider line artifacts
    quadrants = [
        (margin, margin, w_half - margin, h_half - margin),                # Top-Left (id1)
        (w_half + margin, margin, width - margin, h_half - margin),         # Top-Right (id2)
        (margin, h_half + margin, w_half - margin, height - margin),        # Bottom-Left (id3)
        (w_half + margin, h_half + margin, width - margin, height - margin),# Bottom-Right (id4)
    ]

    print(f"Loaded {sheet_path} ({width}x{height}), slicing 2x2 grid (margin={margin}px) & keying green screen...")

    for i, ((left, top, right, bottom), npc_id) in enumerate(zip(quadrants, ids)):
        crop = im.crop((left, top, right, bottom))
        
        # Resize to standard 512x512
        crop = crop.resize((512, 512), Image.LANCZOS)

        rgba_crop = remove_greenscreen(crop)

        prefix = "token" if npc_id.startswith("tok-") else "portrait"
        out_path = os.path.join(SRC_DIR, f"{prefix}-{npc_id}.png")
        rgba_crop.save(out_path, "PNG")
        print(f"  Saved quadrant {i+1} -> {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Usage: python art/slice_portraits.py <sheet_image_path> <id1> <id2> <id3> <id4>")
        sys.exit(1)

    sheet = sys.argv[1]
    npc_ids = sys.argv[2:6]
    slice_grid_2x2(sheet, npc_ids)
