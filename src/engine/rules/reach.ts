/**
 * How far a creature can hit without moving, and what that means for the square
 * next to it.
 *
 * WHY THIS IS ITS OWN FILE
 *
 * Reach already existed, twice, as `attacker.featureIds.includes('long-limbed')
 * ? 2 : 1` — once in `canAttackWith` and once in `resolveAttack`. Two copies of
 * a rule is how they drift, and they had already half-drifted: neither
 * OPPORTUNITY ATTACKS nor SHOVE consulted either of them. A bugbear could strike
 * from ten feet but could not threaten from ten feet, so walking out of its
 * reach was free — the one thing reach is supposed to prevent.
 *
 * One function now answers "can this creature touch that one", and everything
 * that means it asks here.
 *
 * WHAT COUNTS AS REACH, AND WHAT DOES NOT
 *
 * Deliberately narrow. Three questions in this engine look like adjacency and
 * are not the same question:
 *
 *   - "is the target inside MY reach?"  — melee attacks, shove, opportunity
 *     attacks. These scale with the attacker. They are what this file is for.
 *   - "is an ally crowding the TARGET?" — Pack Tactics, and the rogue's
 *     Sneak Attack enabler. The SRD says "within 5 feet" for both, so a
 *     long-armed ally standing back does NOT enable them, and these stay on
 *     plain `adjacent`.
 *   - "am I touching this body?" — shaking a sleeping ally awake. A touch is a
 *     touch at any size.
 *
 * Getting that split wrong would have silently changed flanking for every rogue
 * in the game, which is why it is written down rather than assumed.
 */
import type { GameState, Combatant, Id, Position } from '../types.js';
import { distanceCells } from '../grid.js';

/**
 * How many cells this creature threatens.
 *
 * Huge and Gargantuan creatures reach ten feet because they are physically that
 * big: a hill giant's arm crosses the square in front of it whether or not the
 * stat block calls it out. That is the SRD's own reasoning for giving nearly
 * every Huge stat block a 10-foot melee attack, and doing it by size rather than
 * per-monster means the twelve Huge creatures in this bestiary get it without
 * twelve edits — and the thirteenth gets it for free.
 *
 * Large is deliberately NOT included. An ogre is Large and reaches 5 feet in the
 * SRD; so do most Large creatures. Size and reach are correlated, not equal, and
 * the line the SRD actually draws is above Large.
 */
export function reachCells(c: Combatant): number {
  if (c.featureIds.includes('long-limbed')) return 2;
  return c.size === 'huge' || c.size === 'gargantuan' ? 2 : 1;
}

/** Feet, for the log and anything that talks in the SRD's units. */
export function reachFeet(c: Combatant): number {
  return reachCells(c) * 5;
}

/** Can `attacker` reach `target` where they both stand? */
export function withinReach(attacker: Combatant, target: Combatant): boolean {
  return distanceCells(attacker.position, target.position) <= reachCells(attacker);
}

/** Can `attacker` reach a square, from where it stands? */
export function reachesCell(attacker: Combatant, pos: Position): boolean {
  return distanceCells(attacker.position, pos) <= reachCells(attacker);
}

/**
 * Every conscious enemy of `mover` that threatens `pos`.
 *
 * The question opportunity attacks actually ask, and the reason this is not
 * `adjacent`: leaving a giant's reach has to provoke from two cells away, or
 * reach is only half a rule — good for hitting, useless for holding ground.
 */
export function threatsAt(state: GameState, mover: Combatant, pos: Position): Combatant[] {
  return Object.values(state.combatants).filter(
    (c) => c.alive && c.team !== mover.team && reachesCell(c, pos),
  );
}

/** Does stepping from `from` to `to` leave anybody's reach? */
export function provokesFrom(state: GameState, mover: Combatant, from: Position, to: Position): Id[] {
  return threatsAt(state, mover, from)
    .filter((c) => !reachesCell(c, to))
    .map((c) => c.id);
}
