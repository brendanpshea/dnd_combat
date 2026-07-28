"""Abstract token silhouettes: one per creature type, class and body plan.

    python3 art/generate_svg_tokens.py            # write them
    python3 art/generate_svg_tokens.py --check    # fail if stale

WHY

Measured on the built app at 430x900 with the art blocked: a board cell is
49x49 and the emoji standing in for a missing token is 20x19 — about a sixth of
the cell, where real art fills it. The board reads as empty tiles with specks
on them, and you cannot tell a creature is standing there at all.

The emoji was not badly chosen; it was badly sized. `.token.emoji .glyph` set
`font-size: clamp(14px, 4.2vmin, 26px)` — off the VIEWPORT, not off the cell —
so it looked fine on a desktop and became a speck on a phone, which is where
the slow connections are. That is why it went unnoticed: it only failed where
nobody was measuring.

Three more things compound it. The size tier vanishes (`tokenScale` gives an
ogre 1.3 and a kobold 0.82; the emoji path ignored it, so a Huge remorhaz and a
Tiny sprite were the same 20px). Semantics collapse (three fire monsters are
three different flame emoji, indistinguishable at that size). And emoji are
platform fonts, so the goblin hexer's hamsa and the gray ooze's bubbles render
as tofu boxes on older Android — the one case where a fallback is worse than
nothing.

It is also the LOADING state, not just the missing state: since ArtImage began
holding the glyph while art streams in, a slow first load showed the whole board
as specks.

WHAT THESE ARE

Silhouettes. Shape carries the creature's body plan, and that is all — no
faces, no detail, nothing that has to survive being 34px wide, because the whole
failure of the emoji is that it did not. Colour comes from CSS via the team, not
baked in, so one shape serves both sides. An SVG stretched to its box cannot
have the emoji's bug: it fills whatever cell it is given, at any board size.

WHY A TS MODULE AND NOT .svg FILES

This is the fallback for a slow connection. A fallback that must itself be
fetched has not helped anybody: on the 3G profile where tokens arrive
twenty-three seconds late, 25 more requests would arrive late too. So the paths
are emitted as a TypeScript module and inlined into the bundle — 4 KB of path
data, no requests — and `fill="currentColor"` still works, because the SVG is in
the DOM rather than behind an `<img>` that cannot be tinted.

HOW THESE WERE DRAWN, WHICH IS THE ONLY WAY THEY COULD BE

Rendered, looked at, redrawn. `scripts/token-sheet.ts` puts every shape at
34/49/96px in the real `.token` markup; whether an abstract outline reads is not
a thing anyone can settle by describing it. Six of the first thirteen types
failed that test and every one failed the same way: interior detail inside a
shape that only has an outline, so the outline collapsed. The redraws each
commit to one exaggerated profile — the dragon is mostly wing, the celestial is
mostly wingspan, the fiend is mostly horns.

NOT ONE PER MONSTER. 143 monsters, 13 types, 8 classes, 4 body plans: 25 shapes.
The point is a token that says "something large and many-limbed is standing
here", which is what a player needs while the picture loads. The body plans
exist because type alone is too coarse in the families that vary most: 14
monstrosities sharing one outline made a giant spider, a constrictor and a
griffon the same object, and those three threaten completely different squares.
"""
import sys
from pathlib import Path

TS_OUT = Path(__file__).resolve().parent.parent / "web" / "src" / "silhouettes.ts"

# Every shape is drawn inside this box and fills it, edge to edge.
BOX = 64

#: A silhouette per creature type. Body plan only — the question a player asks
#: at token size is "what shape of thing is that", never "which one is it".
TYPES = {
    # A bulbous head over a fringe of tentacles. The tentacles are what keep it
    # from being a third blob next to ooze and monstrosity: they break the
    # bottom edge, and a broken bottom edge is visible at 34px when an interior
    # squiggle is not.
    "aberration":
        "M32 4c12 0 21 9 21 20 0 5-2 9-4 12"
        "l3 6-5-2-2 8-4-6-3 10-3-10-4 8-3-8-5 3 3-7c-2-3-4-7-4-12C11 13 20 4 32 4z"
        "M16 42l-6 18 4 1 5-16zM48 42l6 18-4 1-5-16z",
    # Four legs with daylight between them, a barrel body, a head slung forward.
    # The first draft merged the legs into the body and became a lump; the gaps
    # are the whole signal, so the legs are separate bars rather than notches.
    "beast":
        "M14 24h32c6 0 10 5 10 11s-4 11-10 11H14C8 46 4 41 4 35s4-11 10-11zM50 12"
        "c6 0 10 4 10 9s-4 9-10 9-9-4-9-9 3-9 9-9zM14 44h6v16h-6zM28 44h6v16h-6z"
        "M40 44h6v15h-6zM50 44h6v15h-6zM6 28L0 18l4-3 8 11z",
    # Wings raised in a V, halo clear above. Drawn against `plan-winged`, not
    # just against the other types: the first draft and the winged plan were
    # both horizontal bowties and were the same object at 34px. This one goes
    # up, that one sweeps back.
    "celestial":
        "M32 0a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM32 13c4 0 7 3 7 7"
        "s-3 7-7 7-7-3-7-7 3-7 7-7zM27 28h10l3 33h-7l-1-15-1 15h-7zM28 32L3 4l4 30z"
        "M36 32L61 4l-4 30z",
    # Blocky, symmetrical, no neck: something built rather than born.
    "construct":
        "M22 6h20v10h9v24h-7v18h-9V44h-6v14h-9V40h-7V16h9V6z",
    # A winged quadruped with a neck: body, legs, one great sail, a long neck
    # and a tail. Two drafts failed before this one — all-sail read as an
    # arrowhead, and sail-plus-head read as a shark fin. What a dragon needs is
    # the two long thin things a bird does not have.
    "dragon":
        "M14 35c0-6 6-10 15-10h8c8 0 13 5 13 11s-5 11-13 11H26c-8 0-12-5-12-12z"
        "M22 46h6v12h-6zM36 46h6v12h-6zM26 35L13 3l31 27zM44 33c1-8 5-15 12-19l4 6"
        "c-5 3-8 8-9 15zM52 7l12 2-3 10-11-4zM18 45C12 50 6 55 2 62l5 3"
        "c5-7 10-12 15-16z",
    # A rising column with a forked top and a wide base: tall where ooze is
    # squat, jagged where construct is straight.
    "elemental":
        "M32 1l7 15 6-8-2 16 11-6-7 15c11 6 11 24-3 29H20C6 57 6 39 17 33"
        "l-7-15 11 6-2-16 6 8z",
    # Small, winged, off-centre: something that does not stand still.
    "fey":
        "M32 14c3 0 6 3 6 6 0 2-1 4-2 5 4 2 7 6 7 11 0 3-1 6-3 8l4 14h-7l-3-12h-4"
        "l-3 12h-7l4-14c-2-2-3-5-3-8 0-5 3-9 7-11-1-1-2-3-2-5 0-3 3-6 6-6zM14 20"
        "c6 2 10 6 12 11-6 1-11-2-12-11zM50 20c-1 9-6 12-12 11 2-5 6-9 12-11z",
    # Short thick horns swept out from the head, over a broad-shouldered
    # figure. Length is what decides between horns and ears: the first two
    # drafts gave it long ones and it read, unmistakably, as a rabbit.
    "fiend":
        "M22 12L4 2l6 16zM42 12L60 2l-6 16zM32 5c5 0 9 4 9 9"
        "s-4 10-9 10-9-5-9-10 4-9 9-9zM18 29c4-3 9-5 14-5s10 2 14 5l4 33h-9l-2-16"
        "h-1l-1 16h-9l-1-16h-1l-2 16h-9z",
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
    # A heavy front dragged along on a fringe of too many legs. The legs are
    # spikes on the bottom edge rather than shapes inside the body, for the same
    # reason the aberration's tentacles are.
    "monstrosity":
        "M4 38c3-12 13-20 28-20s25 8 28 20"
        "l-5 20-3-11-4 13-4-12-4 12-4-13-4 12-4-12-4 13-4-13-3 11zM10 26"
        "C6 22 4 16 5 10c6 2 10 7 12 13z",
    # A settling puddle: wider than it is tall, with one slumping edge.
    "ooze":
        "M6 44c0-11 11-19 26-19s26 8 26 19c0 9-11 14-26 14S6 53 6 44zM20 22"
        "c0-5 4-9 9-9s9 4 9 9c0 4-4 7-9 7s-9-3-9-7z",
    # A cowled shape with nothing inside it.
    "undead":
        "M32 6c10 0 17 8 17 18 0 6-2 10-6 14l5 24H16l5-24"
        "c-4-4-6-8-6-14 0-10 7-18 17-18zM25 22c0-3 2-5 5-5s5 2 5 5-2 5-5 5-5-2-5-5z"
        "M34 22c0-3 2-5 5-5s5 2 5 5-2 5-5 5-5-2-5-5z",
}

#: Body plans, chosen per monster in `web/src/silhouette.ts` where the creature
#: type is too coarse. A griffon, a giant spider and a constrictor are all
#: "monstrosity" or "beast", and all three read differently in one glance —
#: which is the glance a player gets while deciding where to move.
PLANS = {
    # A bird seen from above: spindle body, wings swept back, tail behind. Not
    # a figure with wings — that is `type-celestial`, and the two were the same
    # object until this one stopped standing upright.
    "winged":
        "M32 2l6 12v28l-6 16-6-16V14zM27 22L1 34l11 5-7 10 23-13zM37 22"
        "l26 12-11 5 7 10-23-13z",
    # One long coiling band. No limbs at all is the whole signal.
    "serpent":
        "M8 8c18-6 40 0 45 15 3 12-6 21-19 24-9 2-15 4-15 8 0 5 8 8 22 8v7"
        "C21 70 12 61 12 53c0-10 10-15 22-18 8-2 12-7 11-12C43 14 26 8 8 15z",
    # A fat body with legs jutting past it on every side.
    "manylegs":
        "M22 30c0-7 5-12 10-12s10 5 10 12-5 13-10 13-10-6-10-13zM20 40"
        "c0-6 5-11 12-11s12 5 12 11-5 12-12 12-12-6-12-12zM22 26L4 10l-2 3 17 18z"
        "M42 26L60 10l2 3-17 18zM20 36L2 32v4l18 5zM44 36l18-4v4l-18 5zM22 46L6 58"
        "l3 3 15-12zM42 46l16 12-3 3-15-12z",
    # Off the ground and coming apart at the bottom: nothing solid to hit.
    "drifting":
        "M32 3c11 0 19 9 19 21 0 7-2 12-5 17l3 20-6-7-4 9-4-11-4 11-4-9-6 7 3-20"
        "c-3-5-5-10-5-17C13 12 21 3 32 3z",
}

#: A silhouette per class, for the party's own tokens. Same body, different
#: burden: what a hero is carrying is the only thing that distinguishes them at
#: this size, so each is the humanoid shape plus one unmistakable object.
BODY = ("M32 10c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7zM22 28c3-2 7-3 10-3s7 1 10 3"
        "c3 2 4 6 3 8-1 2-3 1-5-1l-1 11 3 18h-7l-2-14-2 14h-7l3-18-1-11"
        "c-2 2-4 3-5 1-1-2 0-6 3-8z")
CLASSES = {
    "fighter": BODY + "M48 12l4 4-18 18-4-4z M46 34l8 8-4 4-8-8z",                   # sword, held low
    "cleric":  BODY + "M50 10h5v9h9v5h-9v9h-5v-9h-9v-5h9z",                          # a raised cross
    "wizard":  BODY + "M32 2l7 10H25zM50 30a5 5 0 1 1-10 0 5 5 0 0 1 10 0z",         # pointed hat and an orb
    "rogue":   BODY + "M50 14l3 3-14 14-3-3z M12 44c4-3 9-3 12 0l-3 3c-2-2-5-2-7 0z", # dagger and a crouch
    "ranger":  BODY + "M52 12a22 22 0 0 1 0 30l-4-2a18 18 0 0 0 0-26z M50 14v26",    # a drawn bow
    "paladin": BODY + "M50 12l10 4v10c0 7-5 12-10 14-5-2-10-7-10-14V16z",            # shield
    "bard":    BODY + "M50 18a10 10 0 1 1-10 12l-6-14 3-2 6 13a10 10 0 0 1 7-9z",    # lute
    "druid":   BODY + "M50 12c6 6 6 16 0 22-6-6-6-16 0-22z M50 20v18",               # leaf
    # A great axe, raised. The only class shape whose object is ABOVE the head:
    # every other burden hangs at the side, and at 34px the barbarian has to be
    # tellable from the fighter, whose sword is a thin diagonal at the hip.
    "barbarian": BODY + "M50 3h5v37h-5z M40 1c10-3 19-1 24 6-8 4-17 4-24 0z",
}


def shapes() -> dict[str, str]:
    """Every silhouette, by the key the app looks it up under."""
    out = {}
    for key, path in TYPES.items():
        out[f"type-{key}"] = path
    for key, path in PLANS.items():
        out[f"plan-{key}"] = path
    for key, path in CLASSES.items():
        out[f"class-{key}"] = path
    return out


HEADER = '''// GENERATED by art/generate_svg_tokens.py — do not edit.
//
// Abstract token silhouettes, inlined rather than fetched: this is the fallback
// for a slow connection, and a fallback that must itself be downloaded has not
// helped anybody. Paths are drawn in a {box}x{box} box and filled with
// `currentColor`, so the team tint is CSS's business.
//
// Run `python3 art/generate_svg_tokens.py` to regenerate; a test runs it with
// --check.

/** The viewBox every path is drawn in. */
export const SILHOUETTE_BOX = {box};

/** Path data by silhouette key: `type-*`, `plan-*` or `class-*`. */
export const SILHOUETTE_PATH: Record<string, string> = {{
'''


def module() -> str:
    body = "".join(
        f"  '{key}':\n    '{path}',\n" for key, path in shapes().items()
    )
    return HEADER.format(box=BOX) + body + "};\n"


def main() -> int:
    check = "--check" in sys.argv
    want = module()
    current = TS_OUT.read_text() if TS_OUT.exists() else None
    if check:
        if current != want:
            print("web/src/silhouettes.ts is stale; run: python3 art/generate_svg_tokens.py")
            return 1
        print(f"{len(shapes())} token silhouettes are up to date.")
        return 0
    TS_OUT.write_text(want)
    total = sum(len(p) for p in shapes().values())
    n = len(shapes())
    print(f"{n} silhouettes, {total} bytes of path data ({total // n} avg) -> {TS_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
