/**
 * Two creatures of the same declared size must draw the same size.
 *
 * WHAT WAS WRONG. `art/process.py` deliberately does not trim monster art, on
 * the reasoning that "how much of the frame a creature fills is exactly what
 * encodes its size tier". That was true once. It stopped being true when
 * `data/token-size.ts` gave every creature a declared size band — after which
 * framing is not a signal, it is noise from whichever session drew the art.
 *
 * And it is measurably noisy. The four mephits share one declared size and one
 * hand-tuned scale, and their ink fills 0.77, 0.84, 0.88 and 0.90 of the canvas:
 * on the board two of the four are visibly bigger than their own siblings, for a
 * reason no player could ever discover. `process.py` already solved this for the
 * hero roster, with `normalize_framing`, citing exactly this failure.
 *
 * The fix corrects at render time rather than rewriting art: `tokenScale`
 * divides by the token's measured fill. What this file holds is the ORDERING —
 * the correction must come after the band, not before — because before it does
 * precisely nothing and looks like it works.
 */
import { describe, it, expect } from 'vitest';
import { TOKEN_FILL } from '../web/src/token-fill.js';
import { tokenScale } from '../web/src/token-scale.js';
import { bandedScale } from '../src/data/token-size.js';
import { MONSTERS } from '../src/data/monsters.js';
import type { CreatureSize } from '../src/engine/types.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * What a player actually sees, as an AREA: the CSS scale squared times the ink
 * area in the frame.
 *
 * This used to be `scale x fill` when `fill` was the longest axis — a linear
 * measure. `TOKEN_FILL` is now an ink AREA, so the same expression mixes units
 * and reads as neither one thing nor the other. Scale is linear, so an area
 * scales with its square.
 */
const apparent = (id: string, size: CreatureSize) => {
  const s = tokenScale(id, size);
  return s * s * (TOKEN_FILL[id] ?? 1);
};

const byBand = () => {
  const out = new Map<CreatureSize, Array<{ id: string; seen: number }>>();
  for (const m of Object.values(MONSTERS)) {
    if (!TOKEN_FILL[m.id]) continue;
    const list = out.get(m.size) ?? [];
    list.push({ id: m.id, seen: apparent(m.id, m.size) });
    out.set(m.size, list);
  }
  return out;
};

describe('the fill table is real', () => {
  it('measured most of the roster', () => {
    // Guards the guard: an empty or stale table would make everything below
    // pass by having nothing to check.
    expect(Object.keys(TOKEN_FILL).length).toBeGreaterThan(120);
    for (const f of Object.values(TOKEN_FILL)) {
      expect(f).toBeGreaterThan(0.3);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('the correction is applied where it does something', () => {
  it('changes the scale of a badly framed token', () => {
    /**
     * The ordering bug, pinned. Correcting BEFORE the band is a no-op: the band
     * clamps the CSS scale into a narrow range (small is 0.85-0.94), so the
     * correction is flattened straight back out. All four mephits came out
     * bit-identical to their uncorrected values, which is how it was caught.
     */
    const off = Object.entries(TOKEN_FILL)
      .filter(([id]) => MONSTERS[id])
      .sort((a, b) => b[1] - a[1])[0]!;
    const [id, fill] = off;
    // The AREA target, not the old longest-axis 0.87 — the widest-framed
    // monster still has to be far enough off it for the correction to bite.
    expect(fill, 'no token is far enough off the house framing to test with').toBeGreaterThan(0.70);
    const size = MONSTERS[id]!.size;
    expect(
      tokenScale(id, size),
      'the framing correction never reaches the rendered scale',
    ).not.toBeCloseTo(bandedScale(1, size), 5);
  });

  it('leaves well-framed art alone', () => {
    // A correction that moved everything would be a second scale system.
    const near = Object.entries(TOKEN_FILL).find(([id, f]) => MONSTERS[id] && Math.abs(f - 0.579) < 0.006);
    expect(near, 'nothing is at the house framing').toBeDefined();
    const [id] = near!;
    const size = MONSTERS[id]!.size;
    expect(tokenScale(id, size)).toBeCloseTo(bandedScale(tokenScale(id, size), size), 2);
  });
});

describe('siblings draw alike', () => {
  it('renders all four mephits at the same size', () => {
    // The reported case, and the tightest one available: same creature family,
    // same declared size, same hand scale, four different framings.
    const seen = ['dust-mephit', 'ice-mephit', 'magma-mephit', 'steam-mephit']
      .map((id) => apparent(id, MONSTERS[id]!.size));
    const spread = Math.max(...seen) - Math.min(...seen);
    expect(spread, `mephits still render at different sizes: ${seen.map((s) => s.toFixed(2)).join(', ')}`)
      .toBeLessThan(0.06);
  });

  it('keeps every size band tighter than the framing noise it started with', () => {
    /**
     * Not "perfectly uniform" — the hand-tuned SCALE table deliberately varies
     * within a band, so an ogre and a troll are not obliged to match. What is
     * asserted is that the *framing* is no longer adding spread on top of that.
     */
    const LIMIT: Record<string, number> = { tiny: 0.06, small: 0.14, medium: 0.17, large: 0.15, huge: 0.11 };
    for (const [size, rows] of byBand()) {
      const seen = rows.map((r) => r.seen);
      const spread = Math.max(...seen) - Math.min(...seen);
      expect(spread, `${size} band spread ${spread.toFixed(3)} (n=${rows.length})`)
        .toBeLessThanOrEqual(LIMIT[size] ?? 0.2);
    }
  });
});

describe('the bands still mean something once framing is corrected', () => {
  /**
   * The correction is applied AFTER the band, so a token's CSS scale can now
   * step outside the range its size was assigned — a goblin's scale went from
   * 0.94 to 1.05. That is fine and is the point: the band is a statement about
   * APPARENT size, and apparent size is what this checks.
   *
   * Measured ranges, drawn tokens only:
   *   tiny   0.652 .. 0.696      small  0.684 .. 0.818
   *   medium 0.826 .. 0.992      large  1.000 .. 1.148
   *   huge   1.201 .. 1.305
   */
  const range = (size: CreatureSize) => {
    const v = Object.values(MONSTERS)
      .filter((m) => m.size === size && TOKEN_FILL[m.id] !== undefined)
      .map((m) => apparent(m.id, m.size))
      .sort((a, b) => a - b);
    return { lo: v[0]!, hi: v[v.length - 1]!, n: v.length };
  };

  it('never lets a medium, large or huge creature draw into the band below it', () => {
    const order: CreatureSize[] = ['small', 'medium', 'large', 'huge'];
    for (let i = 1; i < order.length; i++) {
      const below = range(order[i - 1]!);
      const here = range(order[i]!);
      expect(here.lo, `smallest ${order[i]} (${here.lo.toFixed(3)}) draws inside ${order[i - 1]} (up to ${below.hi.toFixed(3)})`)
        .toBeGreaterThan(below.hi);
    }
  });

  it('records the one pair that still brushes', () => {
    /**
     * Tiny and small overlap by about 0.012 — the largest tiny draws a hair
     * bigger than the smallest small. Four tiny tokens exist, the clamp is what
     * leaves it, and nobody is going to mistake a bat for a kobold on that
     * margin. Written down rather than papered over; if it widens, this fails.
     */
    const tiny = range('tiny');
    const small = range('small');
    expect(tiny.n).toBeLessThan(6);
    expect(tiny.hi - small.lo, 'the tiny/small overlap has grown').toBeLessThan(0.03);
  });
});

/**
 * The party is Medium. So are most of the things trying to kill it.
 *
 * Everything above compares monsters to monsters, and all of it passed while a
 * barbed devil drew 41% wider and 56% larger in area than the party's fighter.
 * Nothing ever put a hero next to a monster, so nothing caught it — reported
 * from a board, not from a test: "newish tokens still look fat in comparison to
 * the PCs, take up much more of width than the PCs do."
 *
 * The cause was the per-monster hand-tuned scale table that predated size
 * bands. Banding fixed the ordering BETWEEN sizes and left the spread INSIDE
 * each one: Medium ran 1.00 (every hero, since none had an entry) to 1.14 (the
 * devils, the wraith). Once framing is corrected toward a common target,
 * apparent size is just `scale x target`, so that leftover tweak was a straight
 * multiplier on how big a creature looked. Size decides it now, and alone.
 */
describe('heroes and monsters of the same size', () => {
  const HEROES = ['fighter', 'wizard', 'cleric', 'rogue', 'ranger', 'paladin',
    'druid', 'elf-wizard', 'elf-archer', 'dwarf-cleric', 'human-bard'];

  it('draw at the same size', () => {
    const heroes = HEROES.filter((h) => TOKEN_FILL[h]).map((h) => apparent(h, 'medium'));
    expect(heroes.length, 'no hero art to compare against').toBeGreaterThan(6);
    const monsters = (byBand().get('medium') ?? []).map((r) => r.seen);
    expect(monsters.length).toBeGreaterThan(20);

    // One population, not two. The bar is near-equality, not a tolerance band:
    // size alone decides the scale, so every Medium creature lands on the same
    // number (0.909 measured) unless its art is framed badly enough to hit the
    // correction's clamp — and that clamp can only make a token SMALLER. So the
    // MAXIMUM is the canonical size for heroes and monsters alike, and any
    // per-id tweak creeping back shows up immediately.
    //
    // An earlier draft allowed 10%, which is most of the bug this describes:
    // planting a single 1.14 tweak back on the barbed devil sailed through it.
    const gap = Math.max(...monsters) / Math.max(...heroes);
    expect(gap, `widest Medium monster is ${((gap - 1) * 100).toFixed(1)}% bigger than the widest Medium hero`)
      .toBeLessThan(1.005);
    // Nothing may exceed the canonical size either — the clamp only shrinks.
    expect(Math.max(...monsters)).toBeLessThan(Math.max(...heroes) * 1.005);
  });

  it('are sized by their size and nothing else', () => {
    // The specific regression: a per-id table creeping back in. Two Medium
    // creatures with equally well-framed art must land on the same number, so
    // any id-keyed multiplier shows up here.
    const wellFramed = (id: string) => Math.abs((TOKEN_FILL[id] ?? 0) - 0.579) < 0.02;
    const ids = Object.values(MONSTERS)
      .filter((m) => m.size === 'medium' && wellFramed(m.id))
      .map((m) => m.id);
    expect(ids.length, 'no well-framed Medium art to compare').toBeGreaterThan(2);
    const seen = ids.map((id) => apparent(id, 'medium'));
    expect(Math.max(...seen) - Math.min(...seen),
      `well-framed Medium art still draws at different sizes: ${ids.join(', ')}`)
      .toBeLessThan(0.02);
  });
});

/**
 * The framing pipeline normalises in BOTH directions.
 *
 * `normalize_framing` used to enforce an area CEILING, applied downward only,
 * so any asset already under it passed through at whatever framing its
 * generation session gave. The roster ended up as two populations — nine heroes
 * drawn tall and narrow (ink 0.49x0.91) and the rest drawn wide (0.84x0.69) —
 * and since `tokenScale` corrects on the longest axis, that is height for one
 * group and width for the other. The wide ones rendered both fatter AND
 * shorter, which is what got reported.
 *
 * Measured after the change, ink area spread within a size tier: medium
 * monsters 1.76x -> 1.20x. Heroes only 1.54x -> 1.50x, because the tall-narrow
 * ones are already against the edge-padding cap and cannot grow — a 0.45x0.92
 * figure would have to be taller than the canvas to cover the same area as a
 * 0.84x0.69 one. That part needs redrawing, not reframing.
 *
 * Pinned as a source read because the alternative is committing 100 webp files
 * to a fixture. Reverting the `if area > target` guard was the plant that found
 * this file had no guard at all.
 */
describe('the art pipeline normalises framing', () => {
  const py = readFileSync(fileURLToPath(new URL('../art/process.py', import.meta.url)), 'utf8');

  it('scales up as well as down', () => {
    expect(py, 'the ceiling is back — art under it passes through unframed')
      .not.toMatch(/scale = \(target \/ area\) \*\* 0\.5 if area > target/);
    expect(py).toMatch(/scale = \(target \/ area\) \*\* 0\.5/);
  });

  it('still refuses to blow up a speck', () => {
    // Scaling up is only safe because the sources are 512px against a 256px
    // output. A mis-keyed fragment must not be enlarged to fill the frame.
    expect(py).toContain('UPSCALE_MAX');
    expect(py).toMatch(/scale = min\(scale, UPSCALE_MAX\)/);
  });

  it('still keeps everything clear of the canvas edge', () => {
    // The cap that stops a wide pose being cropped — and the reason the
    // tall-narrow heroes cannot reach the target.
    expect(py).toContain('MIN_PAD');
    expect(py).toMatch(/scale = min\(scale, cap\)/);
  });

  it('names the target per size tier, not one number for everything', () => {
    expect(py).toContain('SIZE_TARGETS');
    expect(py, 'the old ceiling name should be gone with the old behaviour')
      .not.toContain('SIZE_CEILINGS');
  });
});

/**
 * Every token stands on the same line.
 *
 * Reported as two things — "some heroes float above the floor while others are
 * anchored" and "the floating ones are also the fat ones" — which is one bug
 * seen twice. `normalize_framing` CENTRED tokens vertically, and a square
 * canvas gives a short figure equal space above and below. Short means wide
 * once area is normalised, so the wide-posed heroes floated above the cell
 * floor by exactly the amount they were fat:
 *
 *   gnome-warden  ink 0.840 wide -> floated 0.156
 *   gnome-bard    ink 0.422 wide -> floated 0.039
 *
 * Scaling the artist's original gap was the first attempt and only halved it
 * (wide-hero mean 0.135 -> 0.067), because the source gaps differ to begin
 * with. There is no floating to preserve either: flight is the renderer's job
 * and `.token.flying` already lifts and bobs its figure in CSS. So the art's
 * contract is "feet at the bottom", and hovering is applied from there.
 *
 * Measured after: every one of 169 tokens sits at 0.039-0.047, the spread being
 * rounding on a 256px canvas.
 */
describe('tokens share a baseline', () => {
  const py = readFileSync(fileURLToPath(new URL('../art/process.py', import.meta.url)), 'utf8');

  it('anchors a token to the bottom rather than centring it', () => {
    expect(py, 'tokens are centred again — short figures will float')
      .toMatch(/elif kind == "token":[\s\S]{0,900}?pos_y = h - target_h - round\(h \* MIN_PAD\)/);
  });

  it('does not let the no-op shortcut skip the baseline', () => {
    // Without this the early return skipped the re-paste for anything already
    // at target area, so 169 tokens kept whatever gap the source had (0.039 to
    // 0.141) while everything rescaled was grounded.
    expect(py, 'the early return no longer checks the baseline').toContain('grounded');
    expect(py).toMatch(/grounded = kind != "token"/);
  });

  it('leaves flight to the renderer, which already does it', () => {
    const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');
    // The BINDING, not just the selector. Deleting the transform-origin line
    // left `.token.flying .art` present in the animation rule below it and this
    // assertion green — while a plant that removed the lift itself would not
    // have been caught.
    expect(css, 'nothing lifts a flyer, so grounding the art would strand them')
      .toMatch(/\.token\.flying \.art,\s*\n\s*\.token\.flying \.sil \{ animation: hover-bob/);
    expect(css, 'the lift has no keyframes to run').toContain('@keyframes hover-bob');
  });
});

/**
 * A keying remnant one stripper leaves and the other declines.
 *
 * Reported from the hero sheet: "elf wizard has an artifact" — a 425px wedge of
 * greenscreen at the lower left, which reframing had scaled up into plain view.
 *
 * Two passes, and one defeated the other. `strip_edge_curtains` removes only the
 * columns it recognises; on that source it took 5 of a 64-wide strip, stranding
 * the remainder at x=5. `strip_specks` then declined it, because its edge test
 * was `min(xs) <= 1` and the remnant no longer touched the border. Neither pass
 * owned it, and nothing failed.
 *
 * The margin stays deliberately small. The elf wizard's floating rune — which an
 * earlier, blunter rule deleted, and which its prompt exists to produce — sits at
 * x=75 of 512, five times outside it.
 */
describe('edge remnants', () => {
  const py = readFileSync(fileURLToPath(new URL('../art/process.py', import.meta.url)), 'utf8');

  it('counts as an edge artefact when merely near the border', () => {
    expect(py, 'back to a two-pixel test, which the curtain pass steps over')
      .not.toMatch(/touches_edge = min\(xs\) <= 1 or/);
    expect(py).toContain('EDGE_MARGIN');
    expect(py).toMatch(/margin = max\(2, round\(EDGE_MARGIN \* min\(w, h\)\)\)/);
  });

  it('keeps that margin narrow enough to spare detached art', () => {
    const m = py.match(/EDGE_MARGIN = ([\d.]+)/);
    expect(m, 'no margin defined').toBeTruthy();
    const v = Number(m![1]);
    // Both ends matter. Zero collapses straight back to the two-pixel test the
    // curtain pass steps over — a plant that set it to 0.0 passed an
    // upper-bound-only check while restoring the exact bug.
    expect(v, 'a zero margin is the old behaviour under a new name').toBeGreaterThan(0.005);
    // ...and 3% of 512 is 15px, against the rune at 75.
    expect(v, 'wide enough to start eating detached art').toBeLessThanOrEqual(0.05);
  });
});

/**
 * Every monster is framed for the size it actually is.
 *
 * `load_monster_sizes` used one regex with `[^}]*?` between the id and `size:`,
 * and that stops at the first closing brace — so any monster with a nested
 * object ahead of its size was invisible. It missed 80 of 146, and nothing
 * failed: the `.get(cid, "medium")` default quietly framed a mammoth, a hydra,
 * a tyrannosaurus and an ogre to the MEDIUM target, so each was drawn small in
 * its own file and scaled back up by CSS, throwing away the resolution the
 * 512px source had to give. The newer monsters carry the richer stat blocks,
 * which is exactly why they were the ones reported as looking wrong.
 *
 * Found by planting the old regex back and watching the whole suite stay green.
 */
describe('framing follows the declared size', () => {
  const py = readFileSync(fileURLToPath(new URL('../art/process.py', import.meta.url)), 'utf8');

  it('scans each entry rather than stopping at the first brace', () => {
    expect(py, 'the brace-truncating regex is back — 80 monsters go silently Medium')
      .not.toMatch(/\[\^\}\]\*\?size:/);
    expect(py, 'no per-entry scan').toMatch(/starts = \[\(m\.start\(\), m\.group\(1\)\)/);
  });

  it('shows up in the art: a Huge creature is framed larger than a Medium one', () => {
    // Behavioural, on the shipped table. If the parser regresses, these fall
    // back to the Medium target and the gap closes.
    const med = ['orc', 'skeleton', 'zombie'].map((m) => TOKEN_FILL[m]).filter((v): v is number => v !== undefined);
    const huge = ['tyrannosaurus', 'mammoth'].map((m) => TOKEN_FILL[m]).filter((v): v is number => v !== undefined);
    expect(med.length, 'no medium art to compare').toBeGreaterThan(1);
    expect(huge.length, 'no huge art to compare').toBeGreaterThan(1);
    expect(Math.max(...huge), 'a Huge creature is framed no bigger than a Medium one')
      .toBeGreaterThan(Math.max(...med) * 1.15);
  });

  it('and a Small one is framed smaller', () => {
    expect(TOKEN_FILL['kobold']!, 'kobold is framed as if it were Medium')
      .toBeLessThan(TOKEN_FILL['orc']! * 0.92);
  });
});
