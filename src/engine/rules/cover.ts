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
 * Two conditions there, and both are mirrored here rather than approximated,
 * because a badge that promises protection the dice do not deliver is worse
 * than no badge:
 *
 *   - cover applies to RANGED attacks (and Dexterity saves); a melee attacker
 *     reaches over it
 *   - it is worth +2 AC at half, +5 at three-quarters (`COVER_BONUS`)
 *
 * It used to have a third, a size gate — a Large or bigger creature took no
 * cover from anything. SRD 5.2.1 has no such gate (Cover, line 713), so it is
 * gone: an ogre behind a barricade has half cover like anyone.
 *
 * WHAT GIVES COVER (SRD 5.2.1, line 713)
 *
 * Half: a barricade (`cover` terrain), or another creature — "whether that
 * creature is an enemy or a friend" — standing in a square the line passes
 * through. Three-quarters: high cover (`high-cover` terrain: an arrow slit, a
 * portcullis). Total: a wall, which also means no line of sight at all, so the
 * target cannot be attacked or targeted directly. Only the most protective one
 * counts; they do not add. A creature that is down or prone is lying flat and
 * shelters nobody.
 */
import type { GameState, Id, Position, TeamId } from '../types.js';
import { isDown, cellAt, posEq } from '../types.js';
import { hasLineOfSight, distanceCells, lineTrace } from '../grid.js';

/** The SRD's three degrees of cover, and none. */
export type CoverLevel = 'none' | 'half' | 'three-quarters' | 'total';

/**
 * What each degree adds to AC and to Dexterity saving throws, and the only
 * place those numbers are written down. Total cover adds nothing because
 * nothing can be aimed at the target at all.
 */
export const COVER_BONUS: Readonly<Record<CoverLevel, number>> = {
  none: 0, half: 2, 'three-quarters': 5, total: 0,
};

/** Half cover's worth in AC, the number the badge has always shown. */
export const COVER_AC = COVER_BONUS.half;

const RANK: Record<CoverLevel, number> = { none: 0, half: 1, 'three-quarters': 2, total: 3 };

/** The more protective of two degrees of cover. */
export function betterCover(a: CoverLevel, b: CoverLevel): CoverLevel {
  return RANK[b] > RANK[a] ? b : a;
}

/**
 * The cover a target at `to` has against an attack or effect from `from`.
 *
 * Every square strictly between the two on the traced line counts — the
 * endpoints never do, so standing beside a barricade is not standing behind it
 * unless the line crosses it. `ignore` names creatures that are not really
 * there for this question (a mover asking about a square it is about to leave).
 *
 * `creatures: false` counts the terrain only. That is the reading for a save
 * against an area — a breath, a Fireball, a Lightning Bolt — where everyone in
 * the area is caught and the front rank shielding the back would make the
 * effect weaker the more it catches; creatures are cover against attacks.
 */
export function coverLevel(
  state: GameState, from: Position, to: Position, ignore: readonly Id[] = [],
  opts: { creatures?: boolean } = {},
): CoverLevel {
  if (!hasLineOfSight(state.grid, from, to)) return 'total';
  let best: CoverLevel = 'none';
  for (const p of lineTrace(from, to)) {
    if (posEq(p, from) || posEq(p, to)) continue;
    const cell = cellAt(state.grid, p);
    if (!cell) continue;
    if (cell.terrain === 'high-cover') return 'three-quarters';
    if (cell.terrain === 'cover') { best = 'half'; continue; }
    if (opts.creatures === false) continue;
    const occ = cell.occupantId !== undefined && !ignore.includes(cell.occupantId)
      ? state.combatants[cell.occupantId] : undefined;
    if (occ && occ.alive && !isDown(occ) && !occ.conditions.some((k) => k.id === 'prone')) best = 'half';
  }
  return best;
}

/**
 * The cover a target has against an attacker (or against an effect from a
 * point): none, half, three-quarters or total. The question a front end asks
 * when it shows what a shot is up against, and what `resolveAttack` adds to a
 * ranged attack's AC.
 */
export function coverOf(state: GameState, attacker: Id | Position, targetId: Id): CoverLevel {
  const target = state.combatants[targetId];
  const from = typeof attacker === 'string' ? state.combatants[attacker]?.position : attacker;
  if (!target || !from) return 'none';
  return coverLevel(state, from, target.position);
}

export interface CoverRead {
  /** Would the nearest watching enemy be shooting across cover? */
  covered: boolean;
  /** AC this is worth against a ranged attack — 0 when not covered. */
  ac: number;
  /** Which degree it is, when there is some. */
  level?: Exclude<CoverLevel, 'none' | 'total'>;
  /** The enemy it is cover *from*. Absent when nobody can see the cell. */
  fromId?: Id;
  /** Nothing on the far side can see this cell at all. */
  unseen?: boolean;
}

const NO_COVER: CoverRead = { covered: false, ac: 0 };

/**
 * What cover a creature on `team` would have standing at `pos`.
 *
 * Deliberately takes a position rather than a combatant, because the question
 * the interface most needs answered is about a cell the player has not moved
 * to yet. `moverId` is that creature, if it is on the board: the square it is
 * leaving is no obstacle to where it is going.
 */
export function coverReadAt(
  state: GameState, pos: Position, team: TeamId, moverId?: Id,
): CoverRead {
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
  const level = coverLevel(state, from.position, pos, moverId !== undefined ? [moverId] : []);
  if (level === 'none' || level === 'total') return { covered: false, ac: 0, fromId: nearest.id };
  return { covered: true, ac: COVER_BONUS[level], level, fromId: nearest.id };
}

/** What cover a combatant has where it is standing right now. */
export function coverReadFor(state: GameState, id: Id): CoverRead {
  const c = state.combatants[id];
  if (!c || !c.alive) return NO_COVER;
  return coverReadAt(state, c.position, c.team, c.id);
}
