import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { makeCombatant } from './helpers.js';

/**
 * A spell's save is a save against magic.
 *
 * Magic Resistance did nothing against spells for as long as it existed: the
 * spells' own `savingThrow` wrapper said it granted advantage "without each
 * spell needing to opt in" and then passed nothing, and the one test of the
 * feature called the engine's `savingThrow` directly with `magical: true`, so it
 * could not see the wrapper. This goes through a real spell's `cast`.
 */
describe('spells are magical', () => {
  function meanNatural(featureIds: string[]): number {
    let total = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) {
      const caster = makeCombatant({ id: 'wiz', team: 'team1', position: { x: 0, y: 0 } });
      const target = makeCombatant({
        id: 't', team: 'team2', position: { x: 3, y: 0 }, creatureType: 'humanoid', featureIds,
      });
      const c = new Combat({ seed, mapId: 'open', combatants: [caster, target] });
      const events = SPELLS['hold-person']!.cast({
        state: c.state, casterId: 'wiz', slotLevel: 2, targetIds: ['t'], positions: [],
      });
      const save = events.find((e) => e.type === 'savingThrow');
      if (save?.type !== 'savingThrow') throw new Error('Hold Person rolled no save');
      total += save.natural;
    }
    return total / N;
  }

  it('gives Magic Resistance advantage on a spell save', () => {
    // Advantage on a d20 averages ~13.8 against a flat 10.5.
    expect(meanNatural(['magic-resistance']) - meanNatural([])).toBeGreaterThan(2);
  });
});

describe('condition immunity', () => {
  it('does not poison a creature immune to poison', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const caster = makeCombatant({ id: 'wiz', team: 'team1', position: { x: 0, y: 0 } });
      const skel = makeCombatant({ id: 's', team: 'team2', position: { x: 3, y: 0 }, immunities: ['poison'] });
      const c = new Combat({ seed, mapId: 'open', combatants: [caster, skel] });
      SPELLS['ray-of-sickness']!.cast({ state: c.state, casterId: 'wiz', slotLevel: 1, targetIds: ['s'], positions: [] });
      expect(c.state.combatants['s']!.conditions.some((k) => k.id === 'poisoned'), `seed ${seed}`).toBe(false);
    }
  });
});
