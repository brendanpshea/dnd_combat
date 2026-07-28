"""Small derivatives of the cover art the launch screen shows.

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

DERIVED, NOT HAND-KEPT

Same rule as the art registry and the SVG terrain: the thumbs are a function of
the source files, this is the function, and `--check` is what stops the two
drifting. `test/art-thumbs.test.ts` runs the coverage half of that check.
"""
import sys
from pathlib import Path

from PIL import Image

ART = Path(__file__).resolve().parent.parent / "web" / "public" / "art"
OUT = ART / "thumb"

#: Cover band geometry. Height is the CSS box; width is a generous card.
WIDTH = 480
HEIGHT = 270
QUALITY = 72

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
    import io

    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITY, method=6)
    return buf.getvalue()


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
