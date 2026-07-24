#!/usr/bin/env python3
"""
Slice multi-icon 2x2 grid images with green screen backgrounds into
individual transparent RGBA PNGs in art/source/ (e.g. icon-fire-bolt.png).

Removes both green-screen background and white/light-grey outer grid divider frames.

Usage:
  python art/slice_icons.py <sheet_image_path> id1 id2 id3 id4

The 4 ids correspond to the 2x2 grid positions:
  Top-Left: id1
  Top-Right: id2
  Bottom-Left: id3
  Bottom-Right: id4
"""
import sys
import os
from PIL import Image

SRC_DIR = os.path.join(os.path.dirname(__file__), "source")
os.makedirs(SRC_DIR, exist_ok=True)

def is_green_screen_pixel(r, g, b):
    # Chroma key green detection
    return g > 110 and g > r * 1.15 and g > b * 1.15

def is_white_border_pixel(r, g, b):
    # Outer white/light-grey border/frame lines generated around AI quadrants
    return r > 180 and g > 180 and b > 180

def remove_background(img: Image.Image) -> Image.Image:
    """
    Convert a green screen RGB image into an RGBA image with transparent background.
    Removes green screen background and outer white/grey grid divider frames.
    """
    img = img.convert("RGBA")
    width, height = img.size
    pixels = img.load()

    is_bg = [[False] * height for _ in range(width)]
    from collections import deque
    queue = deque()

    # 1. Seed ALL green screen pixels anywhere in the image
    for y in range(height):
        for x in range(width):
            r, g, b, _ = pixels[x, y]
            if is_green_screen_pixel(r, g, b):
                is_bg[x][y] = True
                queue.append((x, y))

    # 2. Seed white/grey border pixels along the outer image edges
    for x in range(width):
        for y in (0, height - 1):
            r, g, b, _ = pixels[x, y]
            if (is_white_border_pixel(r, g, b) or is_green_screen_pixel(r, g, b)) and not is_bg[x][y]:
                is_bg[x][y] = True
                queue.append((x, y))

    for y in range(height):
        for x in (0, width - 1):
            r, g, b, _ = pixels[x, y]
            if (is_white_border_pixel(r, g, b) or is_green_screen_pixel(r, g, b)) and not is_bg[x][y]:
                is_bg[x][y] = True
                queue.append((x, y))

    # 3. Flood-fill from seeds to clear green screen and connected outer white frames
    neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        cx, cy = queue.popleft()
        for dx, dy in neighbors:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height and not is_bg[nx][ny]:
                r, g, b, _ = pixels[nx, ny]
                if is_green_screen_pixel(r, g, b) or is_white_border_pixel(r, g, b):
                    is_bg[nx][ny] = True
                    queue.append((nx, ny))

    # 4. Apply alpha transparency & soft anti-aliasing on edges
    for y in range(height):
        for x in range(width):
            if is_bg[x][y]:
                r, g, b, a = pixels[x, y]
                diff = g - max(r, b)
                if diff > 30 or (r > 180 and g > 180 and b > 180):
                    pixels[x, y] = (0, 0, 0, 0)
                else:
                    alpha = max(0, min(255, int(255 * (1.0 - (diff - 10) / 20.0))))
                    new_g = int((r + b) / 2)
                    pixels[x, y] = (r, new_g, b, alpha)
            else:
                # Suppress minor green edge fringe if any
                r, g, b, a = pixels[x, y]
                if g > 150 and g > r * 1.3 and g > b * 1.3:
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

    quadrants = [
        (margin, margin, w_half - margin, h_half - margin),                 # Top-Left (id1)
        (w_half + margin, margin, width - margin, h_half - margin),         # Top-Right (id2)
        (margin, h_half + margin, w_half - margin, height - margin),        # Bottom-Left (id3)
        (w_half + margin, h_half + margin, width - margin, height - margin),# Bottom-Right (id4)
    ]

    print(f"Loaded {sheet_path} ({width}x{height}), slicing 2x2 grid & keying green screen + white borders...")

    for i, ((left, top, right, bottom), icon_id) in enumerate(zip(quadrants, ids)):
        crop = im.crop((left, top, right, bottom))
        crop = crop.resize((512, 512), Image.LANCZOS)
        rgba_crop = remove_background(crop)

        out_path = os.path.join(SRC_DIR, f"icon-{icon_id}.png")
        rgba_crop.save(out_path, "PNG")
        print(f"  Saved quadrant {i+1} -> {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Usage: python art/slice_icons.py <sheet_image_path> <id1> <id2> <id3> <id4>")
        sys.exit(1)

    sheet = sys.argv[1]
    icon_ids = sys.argv[2:6]
    slice_grid_2x2(sheet, icon_ids)
