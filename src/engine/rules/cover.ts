/**
 * Reading cover off the board, so the interface can show it.
 *
 * Barricades have granted +2 AC since they were added, and a player had no way
 * to know it except by noticing that some attacks missed more often. The tile
 * looked different; nothing ever said what the difference *did*. Terrain you
 * have to decode is a puzzle; terrain that tells you what it does at the moment
 * you are deciding is a mechanic — which is XCOM's insight, and the reason it
 * puts a shield on your soldier at the destination rather than trusting you to
 * read the scenery.
 *
 * COVER IS DIRECTIONAL, SO "AM I IN COVER" HAS NO ANSWER.
 *
 * `coverBetween` is computed per attacker-and-target pair: a barricade to your
 * north does nothing about the archer to your south. There is therefore no such
 * thing as a cell's cover value, only its cover *from something*. XCOM has the
 * same problem and answers it the same way this does — pick the enemy that
 * matters most and report the truth about that one.
 *
 * The enemy that matters is the NEAREST one that can actually see the cell.
 * Nearest because it is the likeliest to shoot you and the easiest to verify by
 * eye; can-see because an enemy with a wall in the way is not a threat to
 * report on, and counting it would make the badge flicker as blocked enemies
 * shuffled about behind the scenery.
 *
 * WHAT IT PROMISES HAS TO MATCH WHAT `resolveAttack` DOES
 *
 * Three conditions there, and all three are mirrored here rather than
 * approximated, because a badge that promises protection the dice do not
 * deliver is worse than no badge:
 *
 *   - cover applies to RANGED attacks only; a melee attacker reaches over it
 *   - a Large or bigger creature does not benefit — an ogre does not duck
 *   - it is worth +2 AC
 */
import type { GameState, Id, Position, TeamId, CreatureSize } from '../types.js';
import { isDown, ignoresHalfCover } from '../types.js';
import { coverBetween, hasLineOfSight, distanceCells } from '../grid.js';

/** What cover is worth in AC, and the only place that number is written down. */
export const COVER_AC = 2;

export interface CoverRead {
  /** Would the nearest watching enemy be shooting across cover? */
  covered: boolean;
  /** AC this is worth against a ranged attack — 0 when not covered. */
  ac: number;
  /** The enemy it is cover *from*. Absent when nobody can see the cell. */
  fromId?: Id;
  /**
   * True when the creature is too big to use cover at all (Large and up).
   * Reported separately from `covered: false` because the reasons are
   * different and a player deserves to be told which one applies: standing
   * somewhere useless is a mistake, being an ogre is not.
   */
  tooBig?: boolean;
  /** Nothing on the far side can see this cell at all. */
  unseen?: boolean;
}

const NO_COVER: CoverRead = { covered: false, ac: 0 };

/**
 * What cover a creature of `size` on `team` would have standing at `pos`.
 *
 * Deliberately takes a position rather than a combatant, because the question
 * the interface most needs answered is about a cell the player has not moved
 * to yet.
 */
export function coverReadAt(
  state: GameState, pos: Position, team: TeamId, size: CreatureSize = 'medium',
): CoverRead {
  if (ignoresHalfCover(size)) return { covered: false, ac: 0, tooBig: true };

  let nearest: { id: Id; d: number } | undefined;
  for (const other of Object.values(state.combatants)) {
    if (other.team === team || !other.alive || isDown(other)) continue;
    // An enemy that cannot see the cell is not a threat to report on. Blinded
    // is the same case as a wall in the way: it will not be shooting at this.
    if (other.conditions.some((c) => c.id === 'blinded' || c.id === 'unconscious')) continue;
    if (!hasLineOfSight(state.grid, other.position, pos)) continue;
    const d = distanceCells(other.position, pos);
    if (!nearest || d < nearest.d) nearest = { id: other.id, d };
  }
  if (!nearest) return { ...NO_COVER, unseen: true };

  const from = state.combatants[nearest.id]!;
  const covered = coverBetween(state.grid, from.position, pos);
  return { covered, ac: covered ? COVER_AC : 0, fromId: nearest.id };
}

/** What cover a combatant has where it is standing right now. */
export function coverReadFor(state: GameState, id: Id): CoverRead {
  const c = state.combatants[id];
  if (!c || !c.alive) return NO_COVER;
  return coverReadAt(state, c.position, c.team, c.size ?? 'medium');
}
