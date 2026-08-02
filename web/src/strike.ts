/**
 * Making a weapon attack look like something happened.
 *
 * THE PROBLEM
 *
 * A spell and a sword produced almost the same picture. `spellCast` gave the
 * caster a pulse, flew a bolt to the blast point and bloomed the area; then
 * `damageDealt` put a number and a burst on the target. A weapon attack emitted
 * only the second half — `attackRolled` played a SOUND and nothing else. So
 * everything a sword showed happened on the person being hit, in exactly the
 * presentation a spell already used, and the attacker never visibly acted. On a
 * miss the whole event was one word of floating text.
 *
 * The codebase had already found this once and fixed it for conjurations:
 * `.summon-token.striking` exists because "a summon acts on its caster's turn
 * without the caster moving, so the hammer swings with nothing on screen
 * changing". Heroes never got the same treatment. This is that treatment.
 *
 * WHY A MODULE OF ITS OWN
 *
 * The geometry and the timings are needed in three places that must agree:
 * `effects.ts` builds the lunge and delays the damage number behind it,
 * `pacing.ts` must hold the board still long enough for a number that now lands
 * later, and `Board.tsx` draws it. Split across those, the lead time drifts and
 * the symptom is a damage number that appears mid-swing or gets cut off — both
 * invisible in a screenshot.
 *
 * Kept free of DOM and audio on purpose, exactly as `pacing.ts` is: those are
 * the only two front-end modules a Node test can import.
 */
import type { Id, Position } from '../../src/engine/types.js';

/** How long the lunge itself runs. */
export const LUNGE_MS = 300;
/**
 * When the blow lands, measured from the start of the animation — the apex of
 * the lunge, not its end. The damage number is held until this, so the number
 * appears as the swing connects rather than while the arm is still moving.
 */
export const MELEE_LEAD_MS = 150;
/**
 * Arrow flight. Matches the spell bolt's 220ms, because they are the same
 * gesture and two different travel speeds on one board read as a bug.
 */
export const SHOT_LEAD_MS = 200;

/** One token lunging or loosing a shot. */
export interface StrikeEffect {
  id: number;
  attackerId: Id;
  /**
   * Where to lunge, in SCREEN space and as a fraction of a cell — already
   * flipped for the board's inverted y, so `Board` can use it directly. The
   * flip is here rather than at the call site because a lunge in the wrong
   * direction looks deliberate; a test can catch it, an eye often will not.
   */
  dx: number;
  dy: number;
  delayMs: number;
}

/** How far into the next cell a lunge reaches. Enough to read, not so far that
 *  the token appears to have moved. */
const LUNGE_REACH = 0.34;

/**
 * A shot, or a swing?
 *
 * NOT `WEAPONS[id].melee === false`, which is what `effects.ts` used to pick a
 * sound with. That flag means "cannot be used in melee" — a thrown dagger has
 * `melee: true` AND a range, so hurling one across the board would have lunged
 * at thin air. Distance is what actually decides it, with the flag kept for a
 * longbow used point-blank: that is still a shot.
 */
export function isShot(
  { canMelee, reach, distance }: { canMelee: boolean; reach: number; distance: number },
): boolean {
  return !canMelee || distance > reach;
}

/** Chebyshev distance in cells — the grid's own metric, where a diagonal is one step. */
export function cellDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The lunge vector: a step of `LUNGE_REACH` cells toward the target, in screen
 * space. Zero when the two share a cell, which should not happen but must not
 * produce `NaN` and freeze the token mid-animation if it does.
 */
export function lungeVector(from: Position, to: Position): { dx: number; dy: number } {
  const ax = to.x - from.x;
  // The board draws y upward-positive but CSS grows downward, so a target to
  // the north is a NEGATIVE screen offset.
  const ay = -(to.y - from.y);
  const len = Math.hypot(ax, ay);
  if (len === 0) return { dx: 0, dy: 0 };
  return { dx: (ax / len) * LUNGE_REACH, dy: (ay / len) * LUNGE_REACH };
}

/**
 * Which way an arrow points, in CSS degrees (0 = pointing right, growing
 * clockwise, because that is how `rotate()` turns).
 *
 * A glowing orb needs no facing, which is why the spell bolt never had one. A
 * shaft does: an arrow travelling north-east while lying flat is the kind of
 * wrong that a screenshot at rest cannot show.
 */
export function shotAngleDeg(from: Position, to: Position): number {
  // Apply the same y flip as `lungeVector` and the answer is already in CSS's
  // terms: in screen space y grows downward, which is the direction `rotate()`
  // turns, so `atan2` of the flipped vector needs no further correction. (It is
  // tempting to also negate for "atan2 grows anticlockwise" — that is the flip
  // being counted twice, and it points every arrow backwards.)
  return Math.atan2(-(to.y - from.y), to.x - from.x) * (180 / Math.PI);
}

/**
 * How long to hold the damage number back so it lands on the blow.
 *
 * The single number `effects.ts` adds to its stagger and `pacing.ts` adds to
 * its beat. If only one of them used it, either the number would draw during
 * the swing or the board would stop holding still before the number was read.
 */
export function attackLeadMs(shot: boolean): number {
  return shot ? SHOT_LEAD_MS : MELEE_LEAD_MS;
}
