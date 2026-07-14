import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildParty, buildCharacter } from '../src/builder/character.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { Combatant, Position } from '../src/engine/types.js';

function place(classId: string, team: 'team1' | 'team2', position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position });
  return { ...c, ...over, id: over.id ?? c.id };
}

function playOut(combat: Combat, maxSteps = 5000): number {
  let steps = 0;
  while (!combat.isOver() && steps++ < maxSteps) {
    combat.apply(chooseAction(combat.state, combat.activeId));
  }
  return steps;
}

describe('greedy AI', () => {
  it('finishes full 4v4 games across many seeds without stalling', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 42, 99, 123]) {
      const c = new Combat({
        seed,
        combatants: [...buildParty('team1', 0), ...buildParty('team2', 7)],
      });
      const steps = playOut(c);
      expect(c.isOver()).toBe(true);
      expect(steps).toBeLessThan(5000);
    }
  });

  it('is deterministic: same seed gives the same game', () => {
    const run = (seed: number) => {
      const c = new Combat({
        seed,
        combatants: [...buildParty('team1', 0), ...buildParty('team2', 7)],
      });
      playOut(c);
      return { winner: c.winner(), log: JSON.stringify(c.log) };
    };
    expect(run(7)).toEqual(run(7));
  });

  it('attacks an adjacent enemy instead of ending its turn', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        place('fighter', 'team1', { x: 3, y: 3 }, { id: 'ftr' }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'ftr2' }),
      ],
    });
    const action = chooseAction(c.state, c.activeId);
    expect(action.kind).toBe('attack');
  });

  it('moves toward the enemy when out of reach (melee class)', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        place('fighter', 'team1', { x: 0, y: 0 }, { id: 'f1' }),
        place('fighter', 'team2', { x: 7, y: 7 }, { id: 'f2' }),
      ],
    });
    const me = c.state.combatants[c.activeId]!;
    const enemyPos = me.id === 'f1' ? { x: 7, y: 7 } : { x: 0, y: 0 };
    const action = chooseAction(c.state, c.activeId);
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') throw new Error();
    const before = Math.max(Math.abs(me.position.x - enemyPos.x), Math.abs(me.position.y - enemyPos.y));
    const after = Math.max(Math.abs(action.to.x - enemyPos.x), Math.abs(action.to.y - enemyPos.y));
    expect(after).toBeLessThan(before);
  });

  it('cleric heals a badly wounded ally', () => {
    const c = new Combat({
      seed: 10,
      combatants: [
        place('cleric', 'team1', { x: 0, y: 0 }, { id: 'clr' }),
        place('fighter', 'team1', { x: 1, y: 0 }, { id: 'ftr', hp: 2 }),
        place('rogue', 'team2', { x: 7, y: 7 }, { id: 'rog' }),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'clr' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const action = chooseAction(c.state, 'clr');
    expect(action.kind).toBe('castSpell');
    if (action.kind !== 'castSpell') throw new Error();
    expect(action.spellId).toBe('cure-wounds');
  });

  it('wizard does not walk adjacent to enemies', () => {
    const c = new Combat({
      seed: 15,
      combatants: [
        place('wizard', 'team1', { x: 4, y: 3 }, { id: 'wiz' }),
        place('fighter', 'team2', { x: 4, y: 5 }, { id: 'ftr' }),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const action = chooseAction(c.state, 'wiz');
    if (action.kind === 'move') {
      const d = Math.max(Math.abs(action.to.x - 4), Math.abs(action.to.y - 5));
      expect(d).toBeGreaterThan(1);
    }
    // Whatever it does, it should not be a melee walk-in; casting is expected.
    expect(action.kind === 'castSpell' || action.kind === 'move').toBe(true);
  });
});
