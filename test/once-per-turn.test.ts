import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { makeCombatant } from './helpers.js';

/**
 * `combatant.turn` is the budget of the owner's most recent turn. Read on
 * someone else's turn it is stale — and "once per turn" means once per ANY
 * turn, not once per the owner's.
 */
describe('once per turn, and whose turn', () => {
  it('frees Sneak Attack again when another creature\'s turn starts', () => {
    const rogue = makeCombatant({ id: 'r', team: 'team1', position: { x: 0, y: 0 }, featureIds: ['sneak-attack'] });
    const foe = makeCombatant({ id: 'f', team: 'team2', position: { x: 5, y: 5 } });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [rogue, foe] });
    for (let g = 0; c.activeId !== 'r' && g < 4; g++) c.apply({ kind: 'endTurn' });
    c.state.combatants['r']!.turn.sneakAttackUsed = true;   // spent on its own turn
    c.apply({ kind: 'endTurn' });                            // the foe's turn starts
    expect(c.activeId).toBe('f');
    expect(c.state.combatants['r']!.turn.sneakAttackUsed, 'an opportunity attack now could sneak').toBe(false);
  });

  it('does not add a charge to an attack made off the charger\'s turn', () => {
    let charges = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const boar = makeCombatant({ id: 'b', team: 'team2', position: { x: 0, y: 0 }, featureIds: ['charge'] });
      const hero = makeCombatant({ id: 'h', team: 'team1', position: { x: 1, y: 0 } });
      const c = new Combat({ seed, mapId: 'open', combatants: [boar, hero] });
      for (let g = 0; c.activeId !== 'h' && g < 4; g++) c.apply({ kind: 'endTurn' });
      c.state.combatants['b']!.turn.movementUsed = 30;       // it charged on its own turn
      const evs = resolveAttack(c.state, 'b', 'h', 'longsword', { opportunity: true });
      if (evs.some((e) => e.type === 'damageDealt' && e.tags?.includes('Charge'))) charges++;
    }
    expect(charges).toBe(0);
  });
});
