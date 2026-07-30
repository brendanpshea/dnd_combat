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
