import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { step } from '../src/engine/actions.js';
import { worstCaseWalkDamage } from '../src/engine/rules/movement.js';
import type { Position } from '../src/engine/types.js';
import { cellAt } from '../src/engine/types.js';

const pc = (classId: string, team: 'team1' | 'team2', position: Position, id: string) =>
  ({ ...buildCharacter({ classId, team, position, level: 3 }), id });

/** The cells the mover actually walked, from the emitted event. */
function walk(state: Parameters<typeof step>[0], to: Position): Position[] {
  const { events } = step(state, { kind: 'move', to });
  const moved = events.find((e) => e.type === 'moved');
  if (moved?.type !== 'moved') throw new Error('no move event');
  return moved.path;
}

describe('pathing prefers the safe route among equal-length ones', () => {
  // A `move` action names only a destination — the engine picks the walk — so
  // this tiebreak is the only say anyone gets, player or AI. Both used to be
  // routed through whatever neighbours() happened to emit first.
  it('walks around a fighter\'s reach rather than out of it, when both are the same length', () => {
    // Mover at a1 heading to a4 up the left edge. Going straight up column a is
    // 3 steps; so is bulging out through column b. The fighter at c2 threatens
    // b1/b2/b3 — the bulge would provoke, the straight line never enters reach.
    const c = new Combat({
      seed: 4,
      mapId: 'open',
      combatants: [
        pc('rogue', 'team1', { x: 0, y: 0 }, 'rog'),
        pc('fighter', 'team2', { x: 2, y: 1 }, 'ftr'),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'rog' && guard++ < 20) c.apply({ kind: 'endTurn' });

    const path = walk(c.state, { x: 0, y: 3 });
    expect(path[path.length - 1]).toEqual({ x: 0, y: 3 });
    // Never steps adjacent to the fighter at all, so nothing is provoked.
    const touched = path.some((p) => Math.max(Math.abs(p.x - 2), Math.abs(p.y - 1)) <= 1);
    expect(touched).toBe(false);
  });

  it('takes no opportunity attacks when an equal-length safe route exists', () => {
    const c = new Combat({
      seed: 9,
      mapId: 'open',
      combatants: [
        pc('rogue', 'team1', { x: 0, y: 0 }, 'rog'),
        pc('fighter', 'team2', { x: 2, y: 1 }, 'ftr'),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'rog' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const { events } = step(c.state, { kind: 'move', to: { x: 0, y: 3 } });
    expect(events.some((e) => e.type === 'attackRolled' && e.opportunity)).toBe(false);
  });

  it('makes good on the spec: routes around a hazard when it costs no extra movement', () => {
    // The spec has always claimed "pathing prefers equal-cost routes around
    // hazards". It did not: a hazard costs exactly what open ground costs, and
    // nothing broke the tie, so the router walked people through the fire pit.
    //
    // c2 -> c6 across firepit: straight up column c is 4 steps and burns twice
    // (c4 and c5 are fire). Bulging through column b is also 4 steps and is
    // entirely open.
    const c = new Combat({
      seed: 2,
      mapId: 'firepit',
      combatants: [
        pc('fighter', 'team1', { x: 2, y: 1 }, 'a'),
        pc('fighter', 'team2', { x: 7, y: 7 }, 'b'),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'a' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const path = walk(c.state, { x: 2, y: 5 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 5 });
    expect(path.length - 1).toBe(4); // still the shortest route, not a detour
    const burned = path.filter((p) => cellAt(c.state.grid, p)!.terrain === 'hazard');
    expect(burned).toEqual([]);
  });
});

describe('worst-case walk damage (the lethality veto\'s input)', () => {
  it('counts an opportunity attack at its maximum normal hit', () => {
    const c = new Combat({
      seed: 5,
      mapId: 'open',
      combatants: [
        pc('rogue', 'team1', { x: 3, y: 3 }, 'rog'),
        pc('fighter', 'team2', { x: 3, y: 4 }, 'ftr'),
      ],
    });
    const rog = c.state.combatants['rog']!;
    // Walking out of the fighter's reach: longsword 1d8 + 3 Str, max 11.
    expect(worstCaseWalkDamage(c.state, rog, { x: 3, y: 0 })).toBe(11);
    // Sidestepping *within* its reach provokes nothing — you never left.
    expect(worstCaseWalkDamage(c.state, rog, { x: 2, y: 4 })).toBe(0);
  });

  it('charges each hostile once however often the walk crosses its reach', () => {
    // One reaction each per round, so a long walk past the same enemy cannot
    // stack opportunity attacks.
    const c = new Combat({
      seed: 5,
      mapId: 'open',
      combatants: [
        pc('rogue', 'team1', { x: 3, y: 3 }, 'rog'),
        pc('fighter', 'team2', { x: 3, y: 4 }, 'ftr'),
      ],
    });
    const rog = c.state.combatants['rog']!;
    expect(worstCaseWalkDamage(c.state, rog, { x: 6, y: 0 })).toBe(11);
  });

  it('is zero after Disengage', () => {
    const c = new Combat({
      seed: 5,
      mapId: 'open',
      combatants: [
        pc('rogue', 'team1', { x: 3, y: 3 }, 'rog'),
        pc('fighter', 'team2', { x: 3, y: 4 }, 'ftr'),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'rog' && guard++ < 20) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'disengage' });
    const rog = c.state.combatants['rog']!;
    expect(worstCaseWalkDamage(c.state, rog, { x: 3, y: 0 })).toBe(0);
  });
});
