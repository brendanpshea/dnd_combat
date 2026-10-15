import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { smiteDice, dischargeSmite, breakConcentration } from '../src/engine/rules/attack.js';
import type { Combatant } from '../src/engine/types.js';

/** The smite spells against SRD 5.2.1 (Divine Smite line 11473, Shining Smite, Ensnaring Strike). */

const pal = (): Combatant => ({ ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'pal' });

describe('smite dice', () => {
  it('Divine Smite: 2d8, +1d8 a slot level, +1d8 against a Fiend or an Undead', () => {
    const zombie = buildMonster('zombie', 'team2', { x: 0, y: 0 });
    const ogre = buildMonster('ogre', 'team2', { x: 0, y: 0 });
    expect(smiteDice('divine-smite', 1)).toBe('2d8');
    expect(smiteDice('divine-smite', 2, ogre)).toBe('3d8');
    expect(smiteDice('divine-smite', 1, zombie)).toBe('3d8');
    expect(smiteDice('divine-smite', 2, zombie)).toBe('4d8');
  });

  it('Shining Smite counts its steps from 2nd level, not 1st', () => {
    expect(smiteDice('shining-smite', 2)).toBe('2d6');
    expect(smiteDice('shining-smite', 3)).toBe('3d6');
  });
});

describe('the smites held by concentration end with it', () => {
  function armed(spellId: string, slotLevel: number) {
    const ogre = { ...buildMonster('ogre', 'team2', { x: 3, y: 4 }), id: 'ogre' };
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pal(), ogre] });
    const p = c.state.combatants['pal']!;
    p.armedSmite = { spellId, slotLevel };
    p.concentratingOn = { spellId, targetIds: [] };
    return c;
  }

  it('Shining Smite\'s light goes out when the concentration does', () => {
    const c = armed('shining-smite', 2);
    dischargeSmite(c.state, 'pal', 'ogre', false);
    expect(c.state.combatants['ogre']!.conditions.some((k) => k.id === 'outlined')).toBe(true);
    breakConcentration(c.state, 'pal');
    expect(c.state.combatants['ogre']!.conditions.some((k) => k.id === 'outlined')).toBe(false);
  });

  it('Ensnaring Strike scales its vines with the slot, and a save ends the spell', () => {
    let held = false, freed = false;
    for (let seed = 1; seed < 60 && !(held && freed); seed++) {
      const c = armed('ensnaring-strike', 2);
      c.state.rng = seed;
      dischargeSmite(c.state, 'pal', 'ogre', false);
      const caught = c.state.combatants['ogre']!.conditions.some((k) => k.id === 'restrained');
      if (caught) {
        held = true;
        expect(c.state.combatants['pal']!.holdDamage?.dice).toBe('2d6');
        breakConcentration(c.state, 'pal');
        expect(c.state.combatants['ogre']!.conditions.some((k) => k.id === 'restrained')).toBe(false);
      } else {
        freed = true;
        expect(c.state.combatants['pal']!.concentratingOn).toBeUndefined();
      }
    }
    expect(held && freed).toBe(true);
  });
});
