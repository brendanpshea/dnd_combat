import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { buildEncounter } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { makeCombatant } from './helpers.js';
import { cellAt, Position } from '../src/engine/types.js';

/** No two living combatants ever share a cell, and grid occupancy matches positions. */
function assertNoOverlap(c: Combat) {
  const seen = new Map<string, string>();
  for (const u of Object.values(c.state.combatants)) {
    if (!u.alive) continue;
    const key = `${u.position.x},${u.position.y}`;
    expect(seen.has(key), `${u.id} overlaps ${seen.get(key)} at ${key}`).toBe(false);
    seen.set(key, u.id);
    // Grid cell must point back at the occupant.
    expect(cellAt(c.state.grid, u.position)!.occupantId).toBe(u.id);
  }
}

describe('movement occupancy integrity', () => {
  it('passing through an ally does not corrupt the ally\'s cell', () => {
    // a can pathfind through its ally m to reach the far side; m must remain
    // registered on the grid afterward.
    const c = new Combat({
      seed: 1,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        makeCombatant({ id: 'm', team: 'team1', position: { x: 4, y: 3 } }),
        makeCombatant({ id: 'e', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'a' && guard++ < 10) c.apply({ kind: 'endTurn' });
    // Move a to the far side of the ally (must route through/around m).
    c.apply({ kind: 'move', to: { x: 5, y: 3 } });
    expect(cellAt(c.state.grid, { x: 4, y: 3 })!.occupantId).toBe('m'); // ally intact
    expect(cellAt(c.state.grid, { x: 5, y: 3 })!.occupantId).toBe('a');
    expect(cellAt(c.state.grid, { x: 3, y: 3 })!.occupantId).toBeUndefined();
    assertNoOverlap(c);
  });

  it('a second unit cannot end on a cell an ally was passed through', () => {
    const c = new Combat({
      seed: 1,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 2, y: 2 } }),
        makeCombatant({ id: 'm', team: 'team1', position: { x: 3, y: 2 } }),
        makeCombatant({ id: 'b', team: 'team1', position: { x: 2, y: 4 } }),
        makeCombatant({ id: 'e', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    const order = ['a', 'b'];
    for (const who of order) {
      let guard = 0;
      while (c.activeId !== who && guard++ < 10) c.apply({ kind: 'endTurn' });
      if (c.activeId !== who) continue;
      if (who === 'a') c.apply({ kind: 'move', to: { x: 4, y: 2 } }); // through m
    }
    // m's cell must never be offered as a destination to anyone.
    for (const u of Object.values(c.state.combatants)) {
      if (!u.alive || u.id === 'm') continue;
      const legal = c.legalActions(u.id);
      const targetsMCell = legal.some((x) => x.kind === 'move' && x.to.x === 3 && x.to.y === 2);
      expect(targetsMCell).toBe(false);
    }
    assertNoOverlap(c);
  });

  it('full greedy 4v4 battles never produce overlapping units', () => {
    for (const seed of [1, 4, 9, 15, 22]) {
      const c = new Combat({
        seed,
        combatants: [...buildParty('team1', 0, 2), ...buildParty('team2', 7, 2)],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 3000) {
        c.apply(chooseAction(c.state, c.activeId));
        assertNoOverlap(c);
      }
      expect(c.isOver()).toBe(true);
    }
  });

  it('party-vs-encounter battles never overlap (allies cluster and pass through)', () => {
    const c = new Combat({
      seed: 5,
      mapId: 'ruins',
      combatants: [...buildParty('team1', 0, 2), ...buildEncounter('wolves', 'team2', 7)],
    });
    let steps = 0;
    while (!c.isOver() && steps++ < 4000) {
      c.apply(chooseAction(c.state, c.activeId));
      assertNoOverlap(c);
    }
    expect(c.isOver()).toBe(true);
  });
});
