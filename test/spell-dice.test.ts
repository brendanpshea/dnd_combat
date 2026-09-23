import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SPELL_DICE, spellDice } from '../src/data/spells.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { scoreCastForTest } from '../src/ai/greedy.js';

const GREEDY = readFileSync(new URL('../src/ai/greedy.ts', import.meta.url), 'utf8');

/**
 * A spell's dice live in SPELL_DICE, rolled by its `cast` and priced by the AI.
 * Written twice they drifted — the AI priced upcasts at base dice and cantrips
 * at 1st-level dice for the whole game.
 */
describe('one source for spell dice', () => {
  it('prices every tabled spell through the table', () => {
    const copied = Object.keys(SPELL_DICE).filter((id) => !GREEDY.includes(`spellDice('${id}'`));
    expect(copied, 'the AI has its own copy of these spells\' dice').toEqual([]);
  });

  it('casts an innate spell at its own level, not at slot 0', () => {
    // Innate casts spend no slot and arrive at slotLevel 0: Healing Word rolled
    // 0d4 and Ray of Sickness 1d8.
    expect(spellDice('healing-word', 0, 3)).toBe('2d4');
    expect(spellDice('ray-of-sickness', 0, 3)).toBe('2d8');
    expect(spellDice('guiding-bolt', 3, 5)).toBe('6d6');
    expect(spellDice('fire-bolt', 0, 5)).toBe('2d10');
  });

  it('does not spend a high slot on a spell that gains nothing from it', () => {
    // A flat slot cost made every slot the same price, so a spell whose value
    // does not grow with the slot was cast from whichever the tie-break found.
    // False Life's temporary hit points are the same at every slot here.
    const me = { ...buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 9 }), hp: 5 };
    const foe = { ...buildMonster('ogre', 'team2', { x: 3, y: 0 }), id: 'e0' };
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [me, foe] });
    const actor = c.state.combatants[me.id]!;
    const at = (slotLevel: number) => scoreCastForTest(c.state, actor, {
      kind: 'castSpell', spellId: 'false-life', slotLevel, targets: [],
    });
    expect(at(1)).toBeGreaterThan(at(2));
    expect(at(2)).toBeGreaterThan(at(5));
  });
});
