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
 * The framing every token is corrected TOWARD, and how far a correction may go.
 *
 * A token's ink fills somewhere between 0.69 and 0.92 of its canvas depending on
 * which generation session drew it, and nothing downstream knew — so two
 * creatures of the same declared size rendered at visibly different sizes. The
 * four mephits are the clearest case: one declared size, one hand-tuned scale,
 * and fills of 0.78, 0.79, 0.88 and 0.90.
 *
 * The target is the measured median across the roster, so most art is already
 * at it and does not move. The clamp is what keeps this a correction rather than
 * a second scale system: art within ~12% of the house framing is left exactly
 * alone, and nothing is ever pushed further than that.
 */
const FILL_TARGET = 0.87;
const FILL_CLAMP = 0.12;

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
  // `scale x fill`. Dividing by the token's own fill is what makes the size mean
  // what it says: every Medium creature now occupies the same fraction of its
  // cell, whichever session drew it and whichever shape it is.
  const fill = TOKEN_FILL[id];
  const correction = fill
    ? Math.min(1 + FILL_CLAMP, Math.max(1 - FILL_CLAMP, FILL_TARGET / fill))
    : 1;
  return canonicalScale(size) * correction;
}
