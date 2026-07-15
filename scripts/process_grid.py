import os
import sys
import json
from PIL import Image

def find_bounding_box(img_quad, threshold=15, min_line_pixels=5, gap_tolerance=15):
    """
    Finds the bounding box of the main character in the 512x512 quadrant.
    Groups active rows into contiguous intervals and picks the tallest one.
    Then finds the horizontal boundaries within that vertical range.
    """
    w, h = img_quad.size
    pixels = img_quad.load()
    
    # 1. Calculate foreground pixel count per row
    row_counts = [0] * h
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y][:3]
            greenness = g - max(r, b)
            is_green = (greenness > threshold) or (g > 1.2 * r and g > 1.2 * b and g > 80)
            if not is_green:
                row_counts[y] += 1
                
    # 2. Find row indices meeting the threshold
    active_rows = [y for y, count in enumerate(row_counts) if count >= min_line_pixels]
    if not active_rows:
        print("Warning: No active rows found, falling back to full height.")
        min_y, max_y = 0, h - 1
    else:
        # Group active rows into contiguous intervals
        intervals = []
        start = active_rows[0]
        prev = active_rows[0]
        
        for y in active_rows[1:]:
            if y - prev > gap_tolerance:
                intervals.append((start, prev))
                start = y
            prev = y
        intervals.append((start, prev))
        
        # Pick the longest interval (the character)
        longest_interval = max(intervals, key=lambda iv: iv[1] - iv[0])
        min_y, max_y = longest_interval

    # 3. Calculate foreground pixel count per column ONLY within the detected Y range
    col_counts = [0] * w
    for x in range(w):
        for y in range(min_y, max_y + 1):
            r, g, b = pixels[x, y][:3]
            greenness = g - max(r, b)
            is_green = (greenness > threshold) or (g > 1.2 * r and g > 1.2 * b and g > 80)
            if not is_green:
                col_counts[x] += 1
                
    active_cols = [x for x, count in enumerate(col_counts) if count >= min_line_pixels]
    if not active_cols:
        print("Warning: No active columns found, falling back to full width.")
        min_x, max_x = 0, w - 1
    else:
        # Group active columns into contiguous intervals
        intervals_x = []
        start_x = active_cols[0]
        prev_x = active_cols[0]
        
        for x in active_cols[1:]:
            if x - prev_x > gap_tolerance:
                intervals_x.append((start_x, prev_x))
                start_x = x
            prev_x = x
        intervals_x.append((start_x, prev_x))
        
        # Pick the longest horizontal interval
        longest_interval_x = max(intervals_x, key=lambda iv: iv[1] - iv[0])
        min_x, max_x = longest_interval_x

    # Add a small padding of 2 pixels around the bounding box
    min_x = max(0, min_x - 2)
    max_x = min(w - 1, max_x + 2)
    min_y = max(0, min_y - 2)
    max_y = min(h - 1, max_y + 2)
    
    return min_x, min_y, max_x, max_y

def process_grid(image_path, output_dir, config_json):
    """
    Splits a 1024x1024 2x2 grid image against a green background,
    removes the green screen, scales each quadrant to its spec, and saves them.
    config_json contains:
      [
        {"name": "token-goblin-warrior.png", "type": "token", "target_pct": 0.70},
        {"name": "token-goblin-boss.png", "type": "token", "target_pct": 0.85},
        {"name": "token-kobold.png", "type": "token", "target_pct": 0.55},
        {"name": "token-wolf.png", "type": "token", "target_pct": 0.70}
      ]
    """
    if not os.path.exists(image_path):
        print(f"Error: Source image not found at {image_path}")
        return False

    # Open image and convert to RGBA
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    if w != 1024 or h != 1024:
        print(f"Warning: Image size is {w}x{h}, expected 1024x1024.")

    os.makedirs(output_dir, exist_ok=True)
    if os.path.exists(config_json):
        with open(config_json, "r") as f:
            configs = json.load(f)
    else:
        configs = json.loads(config_json)

    # Split into 4 quadrants
    quads = [
        img.crop((0, 0, 512, 512)),        # Top-Left (0)
        img.crop((512, 0, 1024, 512)),     # Top-Right (1)
        img.crop((0, 512, 512, 1024)),     # Bottom-Left (2)
        img.crop((512, 512, 1024, 1024))   # Bottom-Right (3)
    ]

    for idx, item in enumerate(configs):
        if idx >= len(quads):
            break
            
        quad_img = quads[idx]
        filename = item["name"]
        asset_type = item["type"]
        target_pct = item["target_pct"]
        
        print(f"\nProcessing Quadrant {idx} -> {filename} ({asset_type}, target_pct={target_pct})")
        
        # 1. Find bounding box of foreground character in the quadrant
        min_x, min_y, max_x, max_y = find_bounding_box(quad_img, threshold=15, min_line_pixels=5)
        char_w = max_x - min_x + 1
        char_h = max_y - min_y + 1
        print(f"Found character bounds: X=[{min_x}, {max_x}] ({char_w}px), Y=[{min_y}, {max_y}] ({char_h}px)")

        # Crop the character bounding box
        char_crop = quad_img.crop((min_x, min_y, max_x + 1, max_y + 1))
        
        # 2. Apply chroma-key (transparency) and spill suppression on the cropped character
        c_pixels = char_crop.load()
        key_img = Image.new("RGBA", (char_w, char_h))
        key_pixels = key_img.load()
        
        for y in range(char_h):
            for x in range(char_w):
                r, g, b, a = c_pixels[x, y]
                
                greenness = g - max(r, b)
                t_low = 10
                t_high = 35
                
                # Check greenness
                if greenness >= t_high:
                    alpha = 0
                elif greenness <= t_low:
                    alpha = a
                else:
                    ratio = (greenness - t_low) / (t_high - t_low)
                    alpha = int(a * (1.0 - ratio))
                
                # Green spill suppression
                if alpha > 0 and g > max(r, b):
                    blend = min(1.0, max(0.0, greenness / t_high))
                    target_g = int(max(r, b))
                    new_g = int(g * (1.0 - blend) + target_g * blend)
                else:
                    new_g = g
                
                key_pixels[x, y] = (r, new_g, b, alpha)

        # 3. Scale the transparent character to fit target specifications
        target_h = int(512 * target_pct)
        scale = target_h / char_h
        
        # Prevent horizontal overflow
        max_allowed_w = int(512 * 0.90)
        if char_w * scale > max_allowed_w:
            scale = max_allowed_w / char_w
            
        scaled_w = int(char_w * scale)
        scaled_h = int(char_h * scale)
        
        scaled_char = key_img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        print(f"Resized from {char_w}x{char_h} to {scaled_w}x{scaled_h} (scale={scale:.3f})")

        # 4. Center and position on a new 512x512 transparent canvas
        final_canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        
        # Horizontal center
        dx = (512 - scaled_w) // 2
        
        # Vertical placement
        if asset_type == "portrait":
            dy = 15 # Top padding for portraits
        else:
            # For tokens: leave 15px padding at the bottom for M/L/XL, maybe a bit more for S to keep them floating/centered nicely
            padding_bottom = 15
            dy = 512 - scaled_h - padding_bottom
            
        # Paste scaled character onto canvas
        final_canvas.alpha_composite(scaled_char, (dx, dy))
        
        # Save output file
        out_path = os.path.join(output_dir, filename)
        final_canvas.save(out_path, "PNG")
        print(f"Saved processed asset: {out_path}")

    return True

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python process_grid.py <image_path> <output_dir> <config_json>")
        sys.exit(1)
        
    src_img = sys.argv[1]
    out_dir = sys.argv[2]
    cfg = sys.argv[3]
    
    process_grid(src_img, out_dir, cfg)
