/**
 * How big a token draws in its cell.
 *
 * Split out of `art.ts` because that module reads `import.meta.env`, which
 * means it cannot be imported outside Vite — and this is the part with a rule
 * in it worth testing. `art-registry.ts` was split off for the same reason.
 */
import type { CreatureSize } from '../../src/engine/types.js';
import { canonicalScale } from '../../src/data/token-size.js';
import { TOKEN_FILL } from './token-fill.js';

/**
 * The ink AREA every token is corrected toward, and how far a correction may go.
 *
 * AREA, not the longest axis, and that change is the point.
 *
 * Pinning the longest axis was the original rule and it quietly became the
 * wrong quantity, because `process.py` normalises framing to an area target per
 * size tier. Correcting a different quantity at render time re-introduced
 * exactly what the pipeline had removed: two Medium creatures with equal area
 * but different aspect ratios got different corrections, and the wide one drew
 * visibly fatter. Reported twice — "some medium tokens are fatter than others",
 * then "later ones look fat" — and measured at 2.56x area spread across the
 * medium roster.
 *
 * It is also the only one that fits under a sane clamp. On the corrected art,
 * holding the longest axis equal needs +/-29%; area needs 15%, because it is the
 * quantity the pipeline already controls.
 *
 * The target is the measured median across the roster, so most art is already at
 * it and does not move. The clamp keeps this a correction rather than a second
 * scale system.
 */
const FILL_TARGET = 0.579;
const FILL_CLAMP = 0.15;

export function tokenScale(id: string, size?: CreatureSize): number {
  // SIZE DECIDES HOW BIG A CREATURE DRAWS. Nothing else does.
  //
  // There used to be a hand-tuned per-monster table here, from when framing was
  // the only size signal. Banding fixed the ordering between sizes but left the
  // spread inside each band, and that spread had stopped meaning anything:
  // Medium ran 1.00 to 1.14, so a barbed devil drew 41% wider than the party's
  // fighter — same size in the rules, visibly not on the board. Every monster
  // declares a size and every hero is given one, so there is nothing the table
  // could still be for. See `canonicalScale`.
  //
  // THE CORRECTION MULTIPLIES THE SCALE — it must never be fed into whatever
  // picks the scale. That was the original bug: the correction went in as an
  // input and the band clamped it straight back out, so all four mephits came
  // out bit-identical to before. `canonicalScale` ignores its input entirely
  // now, which makes the mistake impossible rather than merely documented.
  //
  // The size is really a statement about APPARENT size, and apparent size is
  // `scale x area`. Dividing by the token's own ink area is what makes the size
  // mean what it says: every Medium creature now covers the same fraction of its
  // cell, whichever session drew it and whichever shape it is.
  // The square root because `scale` is linear and the quantity is an area.
  const fill = TOKEN_FILL[id];
  const correction = fill
    ? Math.min(1 + FILL_CLAMP, Math.max(1 - FILL_CLAMP, Math.sqrt(FILL_TARGET / fill)))
    : 1;
  return canonicalScale(size) * correction;
}
