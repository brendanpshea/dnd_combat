import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { applyCondition } from '../src/engine/rules/conditions.js';
import type { Combatant, ConditionId } from '../src/engine/types.js';

/**
 * "Your Concentration ends if you have the Incapacitated condition or you die"
 * (SRD 5.2.1, Concentration, line 13567) — and Stunned, Paralyzed and
 * Unconscious each carry Incapacitated.
 */

const pc = (classId: string, team: 'team1' | 'team2', x: number, y: number, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team, position: { x, y }, level: 5 }), id });

function blessing(): Combat {
  const c = new Combat({
    seed: 3, width: 8, height: 8,
    combatants: [pc('cleric', 'team1', 1, 1, 'cle'), pc('fighter', 'team1', 2, 1, 'ftr'), pc('wizard', 'team2', 6, 6, 'wiz')],
  });
  c.state.combatants['cle']!.concentratingOn = { spellId: 'bless', targetIds: ['ftr'] };
  c.state.combatants['ftr']!.conditions.push({ id: 'blessed', sourceId: 'cle', concentration: true });
  return c;
}

describe('concentration ends with the Incapacitated condition', () => {
  for (const id of ['stunned', 'paralyzed', 'unconscious', 'incapacitated'] as ConditionId[]) {
    it(`${id} ends it, and the spell's effects with it`, () => {
      const c = blessing();
      applyCondition(c.state, 'cle', { id, sourceId: 'wiz' }, { magical: true });
      const events = c.apply({ kind: 'endTurn' });
      expect(c.state.combatants['cle']!.concentratingOn).toBeUndefined();
      expect(c.state.combatants['ftr']!.conditions.some((k) => k.id === 'blessed')).toBe(false);
      expect(events.some((e) => e.type === 'concentrationBroken' && e.combatantId === 'cle')).toBe(true);
    });
  }

  it('prone, poisoned or frightened do not', () => {
    const c = blessing();
    for (const id of ['prone', 'poisoned', 'frightened'] as ConditionId[]) {
      applyCondition(c.state, 'cle', { id, sourceId: 'wiz' }, { magical: true });
    }
    c.apply({ kind: 'endTurn' });
    expect(c.state.combatants['cle']!.concentratingOn?.spellId).toBe('bless');
  });
});
