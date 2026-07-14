/**
 * Movement execution with opportunity attacks.
 */
import type { GameState, Combatant, Id, Position } from '../types.js';
import { cellAt } from '../types.js';
import { reachable, pathTo, adjacent } from '../grid.js';
import { WEAPONS } from '../../data/weapons.js';
import { resolveAttack, applyDamage } from './attack.js';
import { rollDice } from '../dice.js';
import type { GameEvent } from '../events.js';

/** Damage for entering a hazard cell (fire pit, spikes...). */
export const HAZARD_DAMAGE = '1d4';

export function hostileIds(state: GameState, mover: Combatant): Set<Id> {
  return new Set(
    Object.values(state.combatants)
      .filter((c) => c.alive && c.team !== mover.team)
      .map((c) => c.id),
  );
}

/** Destinations the mover can legally end on with remaining movement. */
export function moveDestinations(state: GameState, mover: Combatant): Position[] {
  const budget = mover.turn.movementMax - mover.turn.movementUsed;
  if (budget <= 0) return [];
  const r = reachable(state.grid, mover.position, budget, hostileIds(state, mover));
  const out: Position[] = [];
  for (const k of r.costs.keys()) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const pos = { x, y };
    if (x === mover.position.x && y === mover.position.y) continue;
    const cell = cellAt(state.grid, pos)!;
    if (cell.occupantId !== undefined) continue; // can pass allies, not end on them
    out.push(pos);
  }
  return out;
}

/** A creature's first usable melee weapon, for opportunity attacks. */
function meleeWeaponOf(c: Combatant): Id | undefined {
  return c.weaponIds.find((w) => WEAPONS[w]?.melee);
}

function canTakeReaction(c: Combatant): boolean {
  return (
    c.alive &&
    !c.turn.reactionUsed &&
    !c.conditions.some((k) => k.id === 'incapacitated' || k.id === 'unconscious' || k.id === 'noReactions')
  );
}

/**
 * Execute a move to `to`, stepping cell by cell. Each step that leaves a
 * hostile's reach (without Disengage) provokes one opportunity attack from
 * that hostile. If the mover dies mid-path, movement stops.
 */
export function executeMove(state: GameState, moverId: Id, to: Position): GameEvent[] {
  const events: GameEvent[] = [];
  const mover = state.combatants[moverId]!;
  const budget = mover.turn.movementMax - mover.turn.movementUsed;
  const r = reachable(state.grid, mover.position, budget, hostileIds(state, mover));
  const path = pathTo(r, mover.position, to);
  if (!path) throw new Error(`Illegal move for ${moverId} to ${to.x},${to.y}`);
  const cost = r.costs.get(`${to.x},${to.y}`)!;

  const walked: Position[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const step = path[i]!;

    if (!mover.turn.disengaged) {
      for (const hid of hostileIds(state, mover)) {
        const h = state.combatants[hid]!;
        if (!canTakeReaction(h)) continue;
        const weapon = meleeWeaponOf(h);
        if (!weapon) continue;
        if (adjacent(h.position, from) && !adjacent(h.position, step)) {
          h.turn.reactionUsed = true;
          events.push(...resolveAttack(state, hid, moverId, weapon, { opportunity: true }));
          if (!mover.alive) {
            events.unshift({ type: 'moved', combatantId: moverId, path: walked });
            return events;
          }
        }
      }
    }

    // Commit the step.
    const fromCell = cellAt(state.grid, mover.position)!;
    if (fromCell.occupantId === moverId) delete fromCell.occupantId;
    mover.position = step;
    const toCell = cellAt(state.grid, step)!;
    toCell.occupantId = moverId;
    walked.push(step);

    if (toCell.terrain === 'hazard') {
      const dmg = rollDice(state.rng, HAZARD_DAMAGE);
      state.rng = dmg.state;
      events.push(...applyDamage(state, moverId, moverId, dmg.total, 'fire', dmg.rolls));
      if (!mover.alive) {
        events.unshift({ type: 'moved', combatantId: moverId, path: walked });
        return events;
      }
    }
  }

  mover.turn.movementUsed += cost;
  events.unshift({ type: 'moved', combatantId: moverId, path: walked });
  return events;
}

/**
 * Forced movement (Thunderwave push): shove `cells` cells along a unit
 * direction. Stops at board edge, walls, and occupied cells. Provokes no
 * opportunity attacks; hazard cells still burn.
 */
export function pushCreature(
  state: GameState,
  targetId: Id,
  dir: { x: number; y: number },
  cells: number,
): GameEvent[] {
  const events: GameEvent[] = [];
  const t = state.combatants[targetId]!;
  const walked: Position[] = [t.position];
  for (let i = 0; i < cells; i++) {
    const next = { x: t.position.x + dir.x, y: t.position.y + dir.y };
    const cell = cellAt(state.grid, next);
    if (!cell || cell.terrain === 'wall' || cell.occupantId !== undefined) break;
    const fromCell = cellAt(state.grid, t.position)!;
    if (fromCell.occupantId === targetId) delete fromCell.occupantId;
    t.position = next;
    cell.occupantId = targetId;
    walked.push(next);
    if (cell.terrain === 'hazard') {
      const dmg = rollDice(state.rng, HAZARD_DAMAGE);
      state.rng = dmg.state;
      events.push(...applyDamage(state, targetId, targetId, dmg.total, 'fire', dmg.rolls));
      if (!t.alive) break;
    }
  }
  if (walked.length > 1) {
    events.unshift({ type: 'moved', combatantId: targetId, path: walked });
  }
  return events;
}
