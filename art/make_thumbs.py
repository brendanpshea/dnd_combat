"""Small derivatives of the backdrop art: menu thumbnails, and blur-up
placeholders that stand in until the full-size image arrives.

    python3 art/make_thumbs.py            # write them
    python3 art/make_thumbs.py --check    # fail if any is missing or stale

WHY THIS EXISTS

The launch screen draws one cover per mode: three scene backdrops for the story
chapters and a board backdrop behind the arena line-up. They are painted at
`height: 150px` in a card no wider than a phone — and they were being served at
full size, 1280x720 and 1024x1024.

Measured on an emulated Regular 3G connection, cold cache: the very first screen
of the app pulls 364 KB of cover art, which is more than the 250 KB of tokens
and portraits the *fight* needs. Two-thirds of the pipe went to four thumbnails,
ahead of everything that is actually the game, and the party's own tokens landed
twenty-three seconds in.

So the covers get their own derivatives. Nothing about the full-size art
changes: the scene backdrop still fills the screen when you are standing in that
location, and the board backdrop is still the board's. This is only the menu.

WHY 480 WIDE

The band is 150 px tall and at most ~500 px wide; 480x270 covers it at 1x and is
close enough at 2x that the difference does not survive the panel gradient laid
over it. The arena cover is pushed further back still, behind a near-opaque
scrim, so it could take even less — but one size for both keeps this readable.

THE OTHER HALF: BLUR-UP PLACEHOLDERS

The full-size backdrops are still full-size where they belong — behind the board
and behind an adventure scene — and `bg-graveyard` alone is 212 KB. On a slow
connection that is a flat dark panel for twenty seconds where a painting should
be.

So every backdrop also gets a 32px-wide version, which comes out at around 200
bytes. At that size it is cheaper to inline as a data URI in the bundle than to
request: 30 of them add roughly 7 KB to a 244 KB download and cost zero round
trips, so the placeholder is on screen the instant the element is, with no
network involved at all.

They go into `web/src/art-lqip.ts` as a generated map. The stack is then two CSS
background layers on one element — full-size on top, placeholder beneath — and
the browser paints each as it arrives with no JavaScript, no load handler and no
second element. Scaled up 30x, the small one reads as an out-of-focus version of
the painting that is coming, which is the point: the frame is never empty and
never wrong about what will fill it.

DERIVED, NOT HAND-KEPT

Same rule as the art registry and the SVG terrain: these are a function of the
source files, this is the function, and `--check` is what stops the two
drifting. `test/art-thumbs.test.ts` runs the coverage half of that check.
"""
import base64
import io
import sys
from pathlib import Path

from PIL import Image

ART = Path(__file__).resolve().parent.parent / "web" / "public" / "art"
OUT = ART / "thumb"
LQIP_TS = Path(__file__).resolve().parent.parent / "web" / "src" / "art-lqip.ts"

#: Cover band geometry. Height is the CSS box; width is a generous card.
WIDTH = 480
HEIGHT = 270
QUALITY = 72

#: Blur-up placeholder. Aspect ratio is preserved — unlike the thumb, this one
#: is stretched over the same box as the full image, so a crop here would shift
#: the picture at the moment the real one arrives.
LQIP_WIDTH = 32
LQIP_QUALITY = 40

#: The covers the launch screen actually draws. Board backdrops are square and
#: get centre-cropped to the band; scenes are already 16:9.
PATTERNS = ("scene-*.webp", "bg-*.webp")


def sources():
    for pattern in PATTERNS:
        yield from sorted(ART.glob(pattern))


def thumb_path(src: Path) -> Path:
    return OUT / f"thumb-{src.name}"


def render(src: Path) -> bytes:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    # Cover-fit: scale so the band is filled, then crop the overflow centrally.
    # `background-position: center 35%` in the CSS biases upward, and a square
    # board backdrop cropped from the middle loses the same amount either way,
    # so centre is the honest crop for both.
    scale = max(WIDTH / w, HEIGHT / h)
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    w, h = im.size
    left, top = (w - WIDTH) // 2, (h - HEIGHT) // 2
    im = im.crop((left, top, left + WIDTH, top + HEIGHT))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITY, method=6)
    return buf.getvalue()


def lqip(src: Path) -> str:
    """The blur-up placeholder for one backdrop, as a data URI."""
    im = Image.open(src).convert("RGB")
    h = max(1, round(im.height * LQIP_WIDTH / im.width))
    buf = io.BytesIO()
    im.resize((LQIP_WIDTH, h), Image.LANCZOS).save(
        buf, "WEBP", quality=LQIP_QUALITY, method=6
    )
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def lqip_module() -> str:
    entries = "".join(f"  '{src.name}': '{lqip(src)}',\n" for src in sources())
    total = sum(len(lqip(src)) for src in sources())
    return f'''/**
 * Blur-up placeholders for the backdrops, generated by `art/make_thumbs.py`.
 * Do not edit by hand: change the source art and regenerate.
 *
 * Each is a {LQIP_WIDTH}px-wide WebP of the full backdrop, inlined rather than
 * served because at roughly 200 bytes a request costs more than the bytes do.
 * Together they add about {total // 1024} KB to the bundle and remove {len(list(sources()))}
 * round trips.
 *
 * Keyed by the filename of the image they stand in for, so the lookup works for
 * both families of backdrop (`bg-<theme>.webp`, `scene-<id>.webp`) without
 * either having to know which it is.
 */
export const LQIP: Record<string, string> = {{
{entries}}};
'''


def main() -> int:
    check = "--check" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)

    stale, saved, total = [], 0, 0
    seen = set()
    for src in sources():
        dst = thumb_path(src)
        seen.add(dst.name)
        data = render(src)
        total += len(data)
        saved += src.stat().st_size - len(data)
        if dst.exists() and dst.read_bytes() == data:
            continue
        if check:
            stale.append(dst.name)
        else:
            dst.write_bytes(data)

    # A thumb whose source has gone is dead weight that nothing will ever ask
    # for, and exactly the kind of thing a hand-kept directory accumulates.
    orphans = [p.name for p in OUT.glob("thumb-*.webp") if p.name not in seen]
    if check and orphans:
        stale.extend(orphans)

    module = lqip_module()
    # Explicit UTF-8, and a corrupt file counts as absent so that running the
    # generator REPAIRS it. `write_text` defaulted to the platform encoding,
    # which silently wrote cp1252 on Windows and broke every later run on Linux
    # — see the same fix in art/generate_svg_tokens.py.
    try:
        current = LQIP_TS.read_text(encoding="utf-8") if LQIP_TS.exists() else None
    except UnicodeDecodeError:
        current = None
    if current != module:
        if check:
            stale.append("web/src/art-lqip.ts")
        else:
            LQIP_TS.write_text(module, encoding="utf-8")

    if check and stale:
        print("art/thumb is stale; run: python3 art/make_thumbs.py")
        for name in stale:
            print("  " + name)
        return 1

    print(
        f"{len(seen)} thumbs, {total / 1024:.0f}KB total "
        f"(was {(total + saved) / 1024:.0f}KB — saves {saved / 1024:.0f}KB)"
    )
    if orphans:
        for name in orphans:
            (OUT / name).unlink()
        print(f"removed {len(orphans)} orphan(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
