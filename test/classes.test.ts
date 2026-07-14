import { describe, it, expect } from 'vitest';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { acOf } from '../src/data/armor.js';

describe('character builder', () => {
  it('fighter: AC 17, HP 13, str-based stats, sap mastery', () => {
    const f = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } });
    expect(acOf(f)).toBe(17); // scale mail 14 + dex cap 2(dex13→+1) + shield 2
    expect(f.maxHp).toBe(13);
    expect(f.abilities.str).toBe(16);
    expect(f.abilities.con).toBe(16);
    expect(f.weaponMasteries).toContain('longsword');
    expect(f.featureIds).toEqual(expect.arrayContaining(['second-wind', 'action-surge', 'dueling']));
    expect(f.featureUses['second-wind']).toEqual({ current: 2, max: 2 });
    expect(f.featureUses['action-surge']).toEqual({ current: 1, max: 1 });
  });

  it('cleric: AC 18, HP 11, wis caster with 2 slots and life domain', () => {
    const c = buildCharacter({ classId: 'cleric', team: 'team1', position: { x: 0, y: 0 } });
    expect(acOf(c)).toBe(18); // chain mail 16 + shield 2
    expect(c.maxHp).toBe(11);
    expect(c.spellcastingAbility).toBe('wis');
    expect(c.spellSlots).toEqual([{ current: 2, max: 2 }]);
    expect(c.spellIds).toEqual(expect.arrayContaining(['sacred-flame', 'cure-wounds', 'bless']));
    expect(c.featureIds).toContain('disciple-of-life');
  });

  it('wizard: AC 13, HP 7, int caster', () => {
    const w = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 } });
    expect(acOf(w)).toBe(13); // 10 + dex 16 → +3
    expect(w.maxHp).toBe(7);
    expect(w.spellcastingAbility).toBe('int');
    expect(w.spellIds).toHaveLength(5);
  });

  it('rogue: AC 15, HP 11, vex masteries on both weapons', () => {
    const r = buildCharacter({ classId: 'rogue', team: 'team1', position: { x: 0, y: 0 } });
    expect(acOf(r)).toBe(15); // studded 12 + dex +3
    expect(r.maxHp).toBe(11);
    expect(r.weaponMasteries).toEqual(expect.arrayContaining(['shortsword', 'shortbow']));
    expect(r.featureIds).toContain('sneak-attack');
  });

  it('supports higher levels: HP and proficiency-driven values scale', () => {
    const f5 = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    expect(f5.maxHp).toBe(13 + 4 * 9); // +6(avg)+3(con) per level
    expect(f5.level).toBe(5);
  });

  it('buildParty places four distinct classes on the rank', () => {
    const party = buildParty('team1', 0);
    expect(party).toHaveLength(4);
    expect(new Set(party.map((c) => c.classId)).size).toBe(4);
    expect(party.every((c) => c.position.y === 0)).toBe(true);
  });
});
