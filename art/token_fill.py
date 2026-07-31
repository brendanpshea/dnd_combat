#!/usr/bin/env python3
"""
Measure how much of its canvas each token's art actually fills, and write the
result as a derived table the board reads.

WHY THIS EXISTS

`process.py` deliberately does NOT trim monster art, on the reasoning that "how
much of the frame a creature fills is exactly what encodes its size tier — an
ogre must tower over a kobold". That was true when framing was the only signal.
It is not any more: `data/token-size.ts` now assigns every creature a size band
and `bandedScale` holds the rendered token inside it, so the size tier is
declared rather than drawn.

Which leaves framing as pure noise — and it is measurably noisy, because it
comes from whichever generation session drew the art. Four mephits share one
declared size and one hand-tuned scale, and their ink fills 0.78, 0.79, 0.88 and
0.90 of the frame: on the board two of the four are visibly bigger than their
own siblings for no reason a player could ever discover. `process.py` already
solved this for the hero roster (`normalize_framing`) for exactly this reason;
this is the same fix for monsters, applied at render time so no art is rewritten.

Usage:
  python art/token_fill.py            # rewrite the table
  python art/token_fill.py --check    # exit 1 if it is stale
"""
import glob
import os
import sys

from PIL import Image

HERE = os.path.dirname(__file__)
ART = os.path.join(HERE, "..", "web", "public", "art")
OUT = os.path.join(HERE, "..", "web", "src", "token-fill.ts")


def fills() -> dict[str, float]:
    """Per token id, the fraction of the canvas its ink AREA covers.

    This measured the longest axis, which quietly became the wrong quantity.
    `process.py` normalises framing to an area target per size tier, so pinning
    the longest axis at render time re-introduced exactly what the pipeline had
    just removed: two Medium creatures with the same area but different aspect
    ratios got different corrections, and the wide one drew visibly fatter.

    Measured on the corrected art, holding the longest axis equal needs a +/-29%
    correction — against a +/-12% clamp that exists to keep this a correction
    rather than a second scale system. Area needs about half that, because it is
    the quantity the pipeline already controls.
    """
    out: dict[str, float] = {}
    for path in sorted(glob.glob(os.path.join(ART, "token-*.webp"))):
        tid = os.path.basename(path)[len("token-"):-len(".webp")]
        with Image.open(path) as im:
            box = im.convert("RGBA").getbbox()
            if not box:
                continue
            w, h = im.size
            out[tid] = round(((box[2] - box[0]) / w) * ((box[3] - box[1]) / h), 4)
    return out


def render(table: dict[str, float]) -> str:
    lines = [
        "/**",
        " * What fraction of its canvas each token's ink AREA covers, measured",
        " * from the art itself.",
        " *",
        " * DERIVED — do not edit. Regenerate with `python art/token_fill.py`.",
        " * See that script for why framing has to be corrected for at all.",
        " */",
        "export const TOKEN_FILL: Record<string, number> = {",
    ]
    for tid, f in sorted(table.items()):
        key = tid if tid.replace("-", "").isalnum() and "-" not in tid else f"'{tid}'"
        lines.append(f"  {key}: {f},")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    text = render(fills())
    if "--check" in sys.argv:
        current = open(OUT).read() if os.path.exists(OUT) else ""
        if current != text:
            print("web/src/token-fill.ts is stale; run: python art/token_fill.py")
            return 1
        return 0
    with open(OUT, "w") as fh:
        fh.write(text)
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
