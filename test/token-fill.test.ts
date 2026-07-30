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

/** What a player actually sees: the CSS scale times the ink in the frame. */
const apparent = (id: string, size: CreatureSize) => tokenScale(id, size) * (TOKEN_FILL[id] ?? 1);

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
    expect(fill, 'no token is far enough off the house framing to test with').toBeGreaterThan(0.89);
    const size = MONSTERS[id]!.size;
    expect(
      tokenScale(id, size),
      'the framing correction never reaches the rendered scale',
    ).not.toBeCloseTo(bandedScale(1, size), 5);
  });

  it('leaves well-framed art alone', () => {
    // A correction that moved everything would be a second scale system.
    const near = Object.entries(TOKEN_FILL).find(([id, f]) => MONSTERS[id] && Math.abs(f - 0.87) < 0.005);
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
