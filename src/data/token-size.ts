/**
 * How big a token is allowed to look, per SRD size.
 *
 * NON-OVERLAPPING BANDS, and that is the whole point.
 *
 * Token scale was a hand-kept table of a hundred monster ids in `web/src/art.ts`,
 * and it had drifted until Large ranged 0.85–1.50 and Huge 1.30–1.50 — so
 * several Large creatures drew BIGGER than several Huge ones. That table's own
 * comment said scale was "the only thing telling a player a fire giant isn't an
 * ogre", and it had quietly stopped doing that.
 *
 * Clamping into bands keeps every hand-tuned value that was already sensible,
 * fixes the ones that were not, and means a new Huge monster reads as Huge
 * without anybody remembering to add a row.
 *
 * Lives in `data/` rather than `web/` because it is a fact about creatures, not
 * about the renderer — and because a test outside the web build has to be able
 * to check it. (`art.ts` imports `import.meta.env`, which only exists under
 * Vite, so anything reaching into it from a root test breaks the typecheck.)
 */
import type { CreatureSize } from '../engine/types.js';

const SIZE_BAND: Record<CreatureSize, [number, number]> = {
  tiny: [0.70, 0.84],
  small: [0.85, 0.94],
  medium: [0.95, 1.14],
  large: [1.15, 1.32],
  huge: [1.38, 1.58],
  // Nothing in the bestiary is Gargantuan yet. Banded anyway, so the first one
  // is not silently drawn at the same size as a hill giant.
  gargantuan: [1.62, 1.80],
};

export function sizeBand(size: CreatureSize | undefined): [number, number] {
  return SIZE_BAND[size ?? 'medium'];
}

/** A hand-tuned scale, clamped into its size's band. */
export function bandedScale(raw: number, size: CreatureSize | undefined): number {
  // No size given (a hero, a summon, a prop) keeps the raw value exactly.
  if (!size) return raw;
  const [lo, hi] = sizeBand(size);
  return Math.min(hi, Math.max(lo, raw));
}

/**
 * The one scale every creature of a given size draws at: the middle of its band.
 *
 * Clamping into a band fixed the ordering — no Large creature outdraws a Huge
 * one any more — but it left the spread INSIDE each band intact, and that
 * spread had no meaning left. Once `tokenScale` corrects each token's framing
 * toward a common target, apparent size is exactly `scale x FILL_TARGET`, so a
 * leftover hand tweak is a straight multiplier on how big a creature looks.
 *
 * Measured: Medium ran from 1.00 (every hero, and any monster with no hand
 * entry) to 1.14 (the devils, the wraith), which on the board is a barbed devil
 * 41% wider and 56% larger in area than the party's fighter — two creatures the
 * rules call the same size. Reported as "newish tokens look fat in comparison
 * to the PCs", and that is exactly what it was.
 *
 * So size alone decides it. This is the mephit argument one level up: the four
 * mephits were one declared size drawn at four framings, and this was one
 * declared size drawn at a dozen hand tweaks.
 *
 * The cost, stated plainly: a fire giant and a hill giant are now the same size
 * on the board. They are both Huge, so that is the rules' answer too — but it
 * is a real loss of flavour, and the place to put it back is a size, not a
 * multiplier.
 */
export function canonicalScale(size: CreatureSize | undefined): number {
  const [lo, hi] = sizeBand(size);
  return (lo + hi) / 2;
}
