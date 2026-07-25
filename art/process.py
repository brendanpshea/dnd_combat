#!/usr/bin/env python3
"""
Process generated source art (art/source/*.png, 512px RGBA) into web assets:
downscale to 256px and convert to WebP with alpha.

Framing is preserved (no per-image trim) for monsters, because how much of the
frame a creature fills is exactly what encodes its size tier — an ogre must
tower over a kobold on the board.

The hero/species roster is different: every one of them is a Medium humanoid,
so they should all be framed alike, and a generation session that zooms in
tighter than the last one silently makes those heroes look bigger than the ones
drawn before. That happened: the ten species x role portraits came back ~50%
wider (portraits) and ~70% wider (tokens) than the established set, several
touching the canvas edge. `normalize_framing` rescales any roster asset whose
ink falls outside the tolerance band back to the house target. It is a no-op
for art already in band, so existing files stay byte-identical.

Only ids the engine actually references are emitted; unreferenced source art
(e.g. class/species variants not yet wired) stays in source for later.

Usage: python art/process.py
"""
import os
import sys
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "source")
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "art")
SIZE = 256
QUALITY = 82

# --- framing normalization (hero/species roster only) ------------------------
# Every id here is a Medium humanoid hero, so they share one framing target.
# Monsters are deliberately absent: their framing carries their size tier.
ROSTER = {
    "fighter", "wizard", "cleric", "rogue", "ranger", "paladin",
    "orc-barbarian", "dragonborn-paladin", "gnome-bard", "halfling-rogue",
    "tiefling-warlock", "dwarf-berserker", "elf-archer", "human-bard",
    "dwarf-cleric", "elf-wizard", "orc-shaman", "dragonborn-sorcerer",
    "tiefling-knight", "gnome-warden", "halfling-warrior", "halfling-priest",
}

# A *ceiling* on "ink area" — the alpha bounding box as a fraction of the
# canvas — not a target. Two reasons it must be a ceiling:
#
#  - The established set deliberately varies: the gnome bard's token fills 36%
#    and the fighter's 51%, which is how Small species read as smaller than
#    Medium ones on the board. Normalising everything to one value would flatten
#    that distinction and make halflings human-sized.
#  - What actually went wrong is a shifted distribution, not a few outliers: the
#    ten new assets average 71% ink where the old set averages 58% (portraits)
#    and 49% (tokens). Capping pulls the overscaled ones down without touching
#    anything already framed like the rest of the game.
#
# Set near the established set's 75th percentile, so the existing art is almost
# entirely untouched and only genuine frame-fillers move.
MAX_AREA = {"portrait": 0.62, "token": 0.55}
# Nothing may touch the canvas edge — the style bible asks for padding all
# round, and a bust cropped at the frame reads as bursting out of it.
MIN_PAD = 0.03


# What counts as a leftover rather than art. Measured from the sources: the
# greenscreen edge lines are tall thin blobs *touching the canvas border*
# (3x512, 64x470), while a spell's floating rune or a sorcerer's lightning arc
# sits in the interior at 400-900 px. Dust is a handful of pixels anywhere.
DUST_MAX_PX = 32            # smaller than 6x6 — never meaningful art
EDGE_ARTIFACT_MAX_SHARE = 0.10   # a border blob this small is a keying leftover
CAPTION_BAND = 0.20         # a caption lives in the bottom fifth of the canvas
CAPTION_MAX_HEIGHT = 0.09   # …and is a line of text, not a picture
CAPTION_MIN_HEIGHT = 0.02   # …tall enough to be type: a 3px band is a shadow
CAPTION_MIN_GAP = 6         # …with clear space between it and the figure
# "Clear space" has to tolerate a keying hairline: several sources carry a
# few opaque pixels on every row down the full height, which would otherwise
# mean no row is ever empty and no caption is ever found.
CAPTION_NOISE_ROW = 0.02    # a row this sparse counts as empty


def ink_bbox(im, thresh=40):
    """Bounding box of solid ink, ignoring the anti-aliased fringe.

    `Image.getbbox()` counts any non-zero alpha, and downscaling to 256 spreads
    a soft edge a pixel or two outward — enough to read 58% where the asset was
    scaled to 55%. Thresholding keeps the measurement stable across sizes, so
    the pipeline and its --check agree.
    """
    a = im.split()[3]
    return a.point(lambda v: 255 if v > thresh else 0).getbbox()


def strip_edge_curtains(im, max_width=8, tall=0.70, isolated=0.25):
    """Erase a hairline "curtain" fused to the subject along a canvas edge.

    Keying sometimes leaves a near-full-height stroke hugging the border, and
    where it happens to touch the figure it becomes part of the same connected
    blob — so `strip_specks` cannot see it. Measured on token-tiefling-knight:
    columns 0-3 opaque for 465 of 512 rows, column 4 for only 34.

    A curtain is a short run of edge columns (or rows) that are nearly
    full-length, ending abruptly at something that is not. The isolation check
    is what keeps a character legitimately drawn to the frame edge safe: its
    body stays thick as you move inward, a curtain does not.
    """
    w, h = im.size
    a = im.split()[3]
    px = a.load()
    colh = [sum(1 for y in range(h) if px[x, y] > 40) for x in range(w)]
    roww = [sum(1 for x in range(w) if px[x, y] > 40) for y in range(h)]
    doomed_cols, doomed_rows = [], []

    def scan(profile, length, limit):
        """Return indices of a curtain run anchored at either end."""
        hits = []
        for anchor, step in ((0, 1), (len(profile) - 1, -1)):
            run = []
            i = anchor
            while 0 <= i < len(profile) and len(run) < max_width and profile[i] >= length * tall:
                run.append(i)
                i += step
            # It is only a curtain if the next line in is clearly thinner.
            if run and 0 <= i < len(profile) and profile[i] <= length * isolated:
                hits.extend(run)
        return hits

    doomed_cols = scan(colh, h, w)
    doomed_rows = scan(roww, w, h)
    if not doomed_cols and not doomed_rows:
        return im, 0
    out = im.copy()
    o = out.load()
    for x in doomed_cols:
        for y in range(h):
            o[x, y] = (0, 0, 0, 0)
    for y in doomed_rows:
        for x in range(w):
            o[x, y] = (0, 0, 0, 0)
    return out, len(doomed_cols) + len(doomed_rows)


def strip_specks(im):
    """Drop keying leftovers without touching deliberately detached art.

    Several sources carry greenscreen residue — a hairline stroke down one
    edge, scattered dust. It is invisible against the original framing but sits
    inside the alpha bounding box, inflating the area measurement and pulling
    the centring off.

    The distinction that matters: an edge line touches the canvas border, a
    floating rune does not. Removing every small blob instead (the obvious
    first implementation) deleted the elf wizard's rune — the iconic feature
    the prompt asked for — so the rule is deliberately narrow.
    """
    w, h = im.size
    a = im.split()[3].load()
    label = [[0] * w for _ in range(h)]
    blobs = []
    cur = 0
    for sy in range(h):
        for sx in range(w):
            if a[sx, sy] <= 40 or label[sy][sx]:
                continue
            cur += 1
            stack = [(sx, sy)]
            label[sy][sx] = cur
            pixels = []
            while stack:
                x, y = stack.pop()
                pixels.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not label[ny][nx] and a[nx, ny] > 40:
                        label[ny][nx] = cur
                        stack.append((nx, ny))
            blobs.append(pixels)
    if not blobs:
        return im, 0
    biggest = max(len(b) for b in blobs)

    def is_leftover(blob):
        if len(blob) == biggest:
            return False
        if len(blob) <= DUST_MAX_PX:
            return True
        xs = [p[0] for p in blob]
        ys = [p[1] for p in blob]
        touches_edge = min(xs) <= 1 or max(xs) >= w - 2 or min(ys) <= 1 or max(ys) >= h - 2
        return touches_edge and len(blob) < biggest * EDGE_ARTIFACT_MAX_SHARE

    doomed = [b for b in blobs if is_leftover(b)]
    if not doomed:
        return im, 0
    out = im.copy()
    px = out.load()
    for blob in doomed:
        for x, y in blob:
            px[x, y] = (0, 0, 0, 0)
    return out, len(doomed)


def strip_caption(im):
    """Remove a baked-in caption row ("TOKEN" / "PORTRAIT") left by slicing.

    The generation sheets label each tile, and a slice that takes a few pixels
    too many carries the label into the asset. It survives strip_specks: the
    letters are far bigger than dust and, being centred, touch no edge.

    Deliberately narrow, for the same reason strip_specks is. The rule is the
    *shape* of a caption, not "small thing near the bottom": every blob must
    sit inside the bottom fifth, the whole band must be short enough to be a
    line of type, and there must be clear space between it and the figure. A
    creature standing on detached ground, or a dropped weapon at its feet,
    fails the gap test and is left alone.
    """
    w, h = im.size
    a = im.split()[3].load()
    noise = max(2, int(w * CAPTION_NOISE_ROW))
    rows = [sum(1 for x in range(w) if a[x, y] > 40) > noise for y in range(h)]
    if not any(rows):
        return im, 0
    band_top = int(h * (1 - CAPTION_BAND))
    # Walk up from the bottom: the caption is the last run of ink, and what
    # marks it as a caption rather than the figure's feet is the gap above it.
    last = max(y for y in range(h) if rows[y])
    y = last
    while y > 0 and rows[y]:
        y -= 1
    run_top = y + 1
    if run_top < band_top:
        return im, 0                      # the ink reaches up out of the band
    band_h = last - run_top + 1
    if band_h > h * CAPTION_MAX_HEIGHT:
        return im, 0                      # too tall to be a line of type
    if band_h < h * CAPTION_MIN_HEIGHT:
        return im, 0                      # a hairline: a shadow or a base, not type
    gap = 0
    while y > 0 and not rows[y]:
        gap += 1
        y -= 1
    if gap < CAPTION_MIN_GAP:
        return im, 0                      # attached to the figure
    out = im.copy()
    px = out.load()
    for yy in range(run_top, last + 1):
        for xx in range(w):
            px[xx, yy] = (0, 0, 0, 0)
    return out, last - run_top + 1


def normalize_framing(im, kind):
    """Scale a roster asset down if it fills more of its frame than the house
    ceiling allows. Never scales up — an asset drawn small is drawn small on
    purpose (see MAX_AREA). Returns (image, scale); 1.0 means untouched.
    """
    bbox = ink_bbox(im)
    if not bbox:
        return im, 1.0
    w, h = im.size
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0
    area = (bw / w) * (bh / h)
    ceiling = MAX_AREA[kind]
    if area <= ceiling:
        return im, 1.0
    scale = (ceiling / area) ** 0.5
    # Never let the result touch the edge, whatever the area maths says.
    cap = min((1 - 2 * MIN_PAD) * w / bw, (1 - 2 * MIN_PAD) * h / bh)
    scale = min(scale, cap)
    subject = im.crop(bbox).resize((max(1, round(bw * scale)), max(1, round(bh * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(subject, ((w - subject.width) // 2, (h - subject.height) // 2), subject)
    return out, scale


# Engine ids that have a token/portrait slot (classIds + monster ids).
IDS = [
    "fighter", "wizard", "cleric", "rogue",
    "goblin-warrior", "goblin-boss", "skeleton", "wolf", "zombie", "ogre",
    "bandit", "dire-wolf", "ghoul", "giant-spider", "acolyte",
    "kobold", "scout", "orc", "brown-bear", "cult-fanatic", "animated-armor",
    "orc-barbarian", "dragonborn-paladin", "gnome-bard", "halfling-rogue", "tiefling-warlock",
    "dwarf-berserker", "elf-archer", "human-bard", "bandit-captain",
    "ranger", "paladin", "dwarf-cleric", "elf-wizard", "orc-shaman",
    "dragonborn-sorcerer", "tiefling-knight", "gnome-warden", "halfling-warrior", "halfling-priest",
    "knight", "minotaur", "ettin", "priest", "ogre-mage",
    "guard", "bugbear", "lizardfolk", "gnoll", "spy",
    "giant-badger", "giant-toad", "giant-hyena", "giant-boar", "giant-constrictor-snake",
    "gargoyle", "fire-elemental", "water-elemental", "earth-elemental", "air-elemental",
    "sprite", "satyr", "dryad", "green-hag", "unicorn",
    "cockatrice", "harpy", "manticore", "owlbear", "gorgon",
    "shadow", "specter", "will-o-wisp", "wight", "mummy",
    "red-wyrmling", "white-wyrmling", "green-wyrmling", "blue-wyrmling", "black-wyrmling",
    # Remaining monsters
    "berserker", "veteran", "gladiator", "mage", "assassin",
    "tyrannosaurus", "giant-scorpion", "elephant", "giant-crocodile", "mammoth", "giant-ape",
    "worg",
    "ghast", "banshee", "ghost", "wraith", "vampire-spawn",
    "shadow-demon", "succubus", "bearded-devil", "night-hag", "chain-devil", "hezrou", "glabrezu", "horned-devil", "imp", "quasit", "dretch", "hell-hound", "barbed-devil", "vrock",
    "azer", "dust-mephit", "ice-mephit", "invisible-stalker", "magma-mephit", "magmin", "mud-mephit", "salamander", "smoke-mephit", "steam-mephit",
    "hill-giant", "stone-giant", "frost-giant", "fire-giant", "troll",
    "wyvern", "young-black", "young-blue", "young-green", "young-red", "young-white",
    "basilisk", "bulette", "chimera", "ettercap", "griffon", "hydra", "remorhaz", "rust-monster", "winter-wolf",
    "aboleth", "otyugh", "roper",
    "flying-sword", "rug-of-smothering", "flesh-golem", "scarecrow", "shield-guardian", "stone-golem",
    "black-pudding", "gelatinous-cube", "gray-ooze", "ochre-jelly",
    # Adventure NPC archetypes
    "npc-innkeeper", "npc-elder", "npc-merchant", "npc-guard",
    "npc-scout", "npc-commoner", "npc-child", "npc-noble",
    "npc-priest", "npc-sage", "npc-stranger", "npc-wounded",
    "npc-bandit", "npc-captain", "npc-cultist", "npc-barbarian",
    # Adventure map-node tokens
    "tok-tavern", "tok-market", "tok-notice", "tok-gate",
    "tok-well", "tok-house", "tok-temple", "tok-camp",
    "tok-cave", "tok-ruin", "tok-crossing", "tok-tracks",
    "tok-tree", "tok-person", "tok-figure", "tok-danger",
    "tok-treasure", "tok-fire", "tok-boss", "tok-mystery",
    "tok-bridge", "tok-lookout",
]

# `python art/process.py --check` re-measures the emitted WebP instead of
# rewriting it: a guard that committed assets really are within the house
# framing, in case one is ever hand-edited or dropped in by another route.
CHECK_ONLY = "--check" in sys.argv

os.makedirs(OUT, exist_ok=True)
total = 0
have_token, have_portrait = [], []
reframed = []
despeckled = []
captioned = []

for kind, bucket in (("token", have_token), ("portrait", have_portrait)):
    for cid in IDS:
        src = os.path.join(SRC, f"{kind}-{cid}.png")
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert("RGBA")
        im, caption = strip_caption(im)
        if caption:
            captioned.append(f"{kind}-{cid} ({caption}px)")
        if cid in ROSTER:
            im, curtains = strip_edge_curtains(im)
            im, specks = strip_specks(im)
            if specks or curtains:
                despeckled.append(f"{kind}-{cid} ({specks}b/{curtains}px)")
            im, scale = normalize_framing(im, kind)
            if scale != 1.0:
                reframed.append(f"{kind}-{cid} x{scale:.2f}")
        if im.size != (SIZE, SIZE):
            im = im.resize((SIZE, SIZE), Image.LANCZOS)
        dst = os.path.join(OUT, f"{kind}-{cid}.webp")
        im.save(dst, "WEBP", quality=QUALITY, method=4)
        total += os.path.getsize(dst)
        bucket.append(cid)

print(f"tokens:    {len(have_token)} -> {sorted(have_token)}")
print(f"portraits: {len(have_portrait)} -> {sorted(have_portrait)}")
if despeckled:
    print(f"stray marks cleared: {len(despeckled)} -> {despeckled}")
if captioned:
    print(f"baked-in captions removed: {len(captioned)} -> {captioned}")
if reframed:
    print(f"scaled down to the framing ceiling: {len(reframed)} -> {reframed}")
if CHECK_ONLY:
    bad = []
    for kind in ("token", "portrait"):
        for cid in sorted(ROSTER):
            dst = os.path.join(OUT, f"{kind}-{cid}.webp")
            if not os.path.exists(dst):
                continue
            im = Image.open(dst).convert("RGBA")
            w, h = im.size
            bb = ink_bbox(im)
            if not bb:
                continue
            area = ((bb[2] - bb[0]) / w) * ((bb[3] - bb[1]) / h)
            if area > MAX_AREA[kind] * 1.02:   # 2% slack for resampling
                bad.append(f"{kind}-{cid}: fills {area*100:.0f}% (ceiling {MAX_AREA[kind]*100:.0f}%)")
    if bad:
        print("FRAMING CHECK FAILED:")
        for b in bad:
            print("  " + b)
        sys.exit(1)
    print("framing check: all roster assets within the ceiling")

print(f"total WebP size: {total/1024:.0f} KB")
