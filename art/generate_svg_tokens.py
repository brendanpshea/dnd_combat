"""Abstract token silhouettes: one per creature type, one per class.

    python3 art/generate_svg_tokens.py            # write them
    python3 art/generate_svg_tokens.py --check    # fail if any is stale

WHY

Measured on the built app at 430x900 with the art blocked: a board cell is
49x49 and the emoji standing in for a missing token is 20x19 — about a sixth of
the cell, where real art fills it. The board reads as empty tiles with specks
on them, and you cannot tell a creature is standing there at all.

Three more things compound it. The size tier vanishes (`tokenScale` gives an
ogre 1.3 and a kobold 0.82; the emoji path ignores it, so a Huge remorhaz and a
Tiny sprite are the same 20px). Semantics collapse (three fire monsters are
three different flame emoji, indistinguishable at that size). And emoji are
platform fonts, so the goblin hexer's hamsa and the gray ooze's bubbles render
as tofu boxes on older Android — the one case where a fallback is worse than
nothing.

It is also the LOADING state, not just the missing state: since ArtImage began
holding the glyph while art streams in, a slow first load shows the whole board
as specks.

WHAT THESE ARE

Silhouettes. Shape carries the creature's body plan, and that is all — no
faces, no detail, nothing that needs to survive being 34px wide, because the
whole failure of the emoji is that it does not. Colour is applied by CSS from
the team, not baked in, so one file serves both sides.

Drawn in a 64x64 box with a 4px margin so the shape fills its cell the way real
token art does. Sized by the caller from the creature's size tier, which is the
signal the emoji path threw away.

NOT ONE PER MONSTER. 143 monsters, 13 creature types, 8 classes: 21 files. The
point is a token that says "something large and many-limbed is standing here",
which is exactly what a player needs while the picture loads and exactly what a
type can say.
"""
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "art" / "tokens"

# Every shape is drawn inside this box and fills it, edge to edge.
BOX = 64

#: A silhouette per creature type. Body plan only — the question a player asks
#: at token size is "what shape of thing is that", never "which one is it".
TYPES = {
    # A hunched mass of tentacles: the thing that is not built like anything.
    "aberration":
        "M32 6c9 0 15 6 16 14 1 6-2 10-2 14 0 5 6 6 9 11 2 4 1 8-3 9-4 1-6-3-8-6"
        "-2-3-4-4-5-1-1 4 2 8 0 11-2 3-8 3-10 0-2-3 1-7 0-11-1-3-3-2-5 1-2 3-4 7-8 6"
        "-4-1-5-5-3-9 3-5 9-6 9-11 0-4-3-8-2-14C17 12 23 6 32 6z",
    # Four legs, a low back, a head thrust forward.
    "beast":
        "M8 40c0-8 4-13 11-15 5-1 11-1 17 0 4 1 7 0 10-3 3-3 8-4 10-1 2 3 0 6-3 8"
        "-2 1-3 3-3 6 0 7-3 12-9 14l1 8h-6l-1-7H25l-1 7h-6l1-8c-6-2-11-4-11-9z",
    # Winged and upright, arms open.
    "celestial":
        "M32 8c4 0 7 3 7 7 0 3-1 5-3 6 6 1 11 3 15 7 3 3 5 7 4 9-1 2-4 1-7-1"
        "-3-2-6-3-8-3l2 25h-8l-2-18-2 18h-8l2-25c-2 0-5 1-8 3-3 2-6 3-7 1-1-2 1-6 4-9"
        "4-4 9-6 15-7-2-1-3-3-3-6 0-4 3-7 7-7z",
    # Blocky, symmetrical, no neck: something built rather than born.
    "construct":
        "M22 8h20v10h8v22h-6v18h-9V44h-6v14h-9V40h-6V18h8V8z",
    # A long neck, a heavy body, one great wing.
    "dragon":
        "M10 34c2-8 8-12 16-13 3-6 8-11 14-13 3-1 5 1 4 4-1 4-4 7-6 10 6 2 11 6 14 12"
        "3 6 3 12 0 14-3 2-6-1-9-4-3-3-6-4-9-3l3 17h-8l-3-14-6 2-2 12h-8l2-14"
        "c-4-2-6-6-2-10z",
    # A rising column, wide at the base, breaking up as it goes.
    "elemental":
        "M32 6c3 6 2 11 0 16 4-2 8-1 9 3 1 4-2 7-1 11 1 4 6 6 6 11 0 6-6 11-14 11"
        "s-14-5-14-11c0-5 5-7 6-11 1-4-2-7-1-11 1-4 5-5 9-3-2-5-3-10 0-16z",
    # Small, winged, off-centre: something that does not stand still.
    "fey":
        "M32 14c3 0 6 3 6 6 0 2-1 4-2 5 4 2 7 6 7 11 0 3-1 6-3 8l4 14h-7l-3-12h-4"
        "l-3 12h-7l4-14c-2-2-3-5-3-8 0-5 3-9 7-11-1-1-2-3-2-5 0-3 3-6 6-6z"
        "M14 20c6 2 10 6 12 11-6 1-11-2-12-11zM50 20c-1 9-6 12-12 11 2-5 6-9 12-11z",
    # Horned, broad-shouldered, planted.
    "fiend":
        "M18 8c4 3 6 7 7 11 4-2 10-2 14 0 1-4 3-8 7-11 1 5 0 10-3 14 5 3 8 8 8 14"
        "0 4-2 8-5 10l3 12h-8l-2-9h-6l-2 9h-8l3-12c-3-2-5-6-5-10 0-6 3-11 8-14"
        "-3-4-4-9-3-14z",
    # Enormous shoulders, a small head, a wide stance.
    "giant":
        "M32 8c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7zM14 26c4-3 11-4 18-4s14 1 18 4"
        "c3 2 4 8 2 10-2 2-5 0-7-2l-1 14 3 16h-9l-2-14h-8l-2 14h-9l3-16-1-14"
        "c-2 2-5 4-7 2-2-2-1-8 2-10z",
    # Two arms, two legs, upright. The baseline everything else departs from.
    "humanoid":
        "M32 8c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7zM20 26c3-2 8-3 12-3s9 1 12 3"
        "c3 2 4 7 3 9-1 2-4 1-6-1l-1 12 3 18h-8l-2-15-2 15h-8l3-18-1-12"
        "c-2 2-5 3-6 1-1-2 0-7 3-9z",
    # Too many limbs and a heavy front: built wrong, but built.
    "monstrosity":
        "M12 30c3-7 9-11 17-11h6c8 0 14 4 17 11 2 4 1 8-2 9-3 1-5-2-7-4l1 9"
        "c4 2 7 5 7 8 0 2-2 3-4 2-2-1-4-3-6-4l-2 8h-8l-2-8c-2 1-4 3-6 4-2 1-4 0-4-2"
        "0-3 3-6 7-8l1-9c-2 2-4 5-7 4-3-1-4-5-2-9z",
    # A settling puddle: wider than it is tall, with one slumping edge.
    "ooze":
        "M10 42c0-9 9-16 22-16s22 7 22 16c0 8-9 12-22 12S10 50 10 42z"
        "M20 24c0-4 3-7 7-7s7 3 7 7c0 3-3 5-7 5s-7-2-7-5z",
    # A cowled shape with nothing inside it.
    "undead":
        "M32 8c9 0 15 7 15 16 0 5-2 9-5 12l4 22H18l4-22c-3-3-5-7-5-12 0-9 6-16 15-16z"
        "M26 22c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z"
        "M34 22c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z",
}

#: A silhouette per class, for the party's own tokens. Same body, different
#: burden: what a hero is carrying is the only thing that distinguishes them at
#: this size, so each is the humanoid shape plus one unmistakable object.
BODY = ("M32 10c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7z"
        "M22 28c3-2 7-3 10-3s7 1 10 3c3 2 4 6 3 8-1 2-3 1-5-1l-1 11 3 18h-7l-2-14"
        "-2 14h-7l3-18-1-11c-2 2-4 3-5 1-1-2 0-6 3-8z")
CLASSES = {
    "fighter":  BODY + "M48 12l4 4-18 18-4-4z M46 34l8 8-4 4-8-8z",      # sword, low
    "cleric":   BODY + "M50 10h5v9h9v5h-9v9h-5v-9h-9v-5h9z",              # a raised cross
    "wizard":   BODY + "M32 2l7 10H25zM50 30a5 5 0 1 1-10 0 5 5 0 0 1 10 0z",  # hat + orb
    "rogue":    BODY + "M50 14l3 3-14 14-3-3z M12 44c4-3 9-3 12 0l-3 3c-2-2-5-2-7 0z",
    "ranger":   BODY + "M52 12a22 22 0 0 1 0 30l-4-2a18 18 0 0 0 0-26z M50 14v26",
    "paladin":  BODY + "M50 12l10 4v10c0 7-5 12-10 14-5-2-10-7-10-14V16z",   # shield
    "bard":     BODY + "M50 18a10 10 0 1 1-10 12l-6-14 3-2 6 13a10 10 0 0 1 7-9z",
    "druid":    BODY + "M50 12c6 6 6 16 0 22-6-6-6-16 0-22z M50 20v18",     # leaf
}


def svg(path: str, name: str) -> str:
    """One silhouette. `currentColor` so the team tint is CSS's job, not ours."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BOX} {BOX}" '
        f'role="img" aria-label="{name}">'
        f'<path d="{path}" fill="currentColor"/>'
        f'</svg>\n'
    )


def files() -> dict[str, str]:
    out = {}
    for key, path in TYPES.items():
        out[f"type-{key}.svg"] = svg(path, key)
    for key, path in CLASSES.items():
        out[f"class-{key}.svg"] = svg(path, key)
    return out


def main() -> int:
    check = "--check" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    want = files()
    stale = []
    for name, body in want.items():
        dst = OUT / name
        if dst.exists() and dst.read_text() == body:
            continue
        if check:
            stale.append(name)
        else:
            dst.write_text(body)
    orphans = [p.name for p in OUT.glob("*.svg") if p.name not in want]
    if check:
        if stale or orphans:
            print("art/tokens is stale; run: python3 art/generate_svg_tokens.py")
            for n in [*stale, *orphans]:
                print("  " + n)
            return 1
        print("token silhouettes are up to date.")
        return 0
    for n in orphans:
        (OUT / n).unlink()
    total = sum(len(b) for b in want.values())
    print(f"{len(want)} silhouettes, {total} bytes ({total // len(want)} avg)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
