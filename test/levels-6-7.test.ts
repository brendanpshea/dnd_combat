import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { LEVEL_XP, MAX_LEVEL, levelForXp } from '../src/campaign/campaign.js';
import { EVEN_BUDGET, evenBudgetFor } from '../src/arena/run.js';

describe('levels 6 and 7', () => {
  it('every per-level class array reaches the new cap', () => {
    // A short array does not throw, it silently yields undefined and the
    // character quietly gets nothing — which is exactly how a half-added level
    // would ship without anyone noticing.
    for (const c of Object.values(CLASSES)) {
      const sc = c.spellcasting;
      if (!sc) continue;
      expect(sc.slotsByLevel, `${c.id} slotsByLevel`).toHaveLength(MAX_LEVEL);
      for (const key of ['cantripsKnownByLevel', 'spellbookByLevel', 'preparedByLevel'] as const) {
        const arr = sc[key];
        if (arr) expect(arr, `${c.id} ${key}`).toHaveLength(MAX_LEVEL);
      }
    }
  });

  it('grants the SRD slot progression', () => {
    const full = ['cleric', 'wizard', 'bard', 'druid'];
    for (const id of full) {
      const s = CLASSES[id]!.spellcasting!.slotsByLevel;
      expect(s[5], `${id} at 6th`).toEqual([4, 3, 3]);
      expect(s[6], `${id} at 7th`).toEqual([4, 3, 3, 1]);
    }
    for (const id of ['ranger', 'paladin']) {
      const s = CLASSES[id]!.spellcasting!.slotsByLevel;
      expect(s[5], `${id} at 6th`).toEqual([4, 2]);
      expect(s[6], `${id} at 7th`).toEqual([4, 3]);
    }
  });

  it('the arena budget is defined for every level, not clamped to the old cap', () => {
    // evenBudgetFor clamps to the array length, so a short array does not throw
    // — it feeds a 7th-level party 5th-level encounters and the arena gets
    // easier exactly where it should get harder.
    expect(EVEN_BUDGET).toHaveLength(MAX_LEVEL);
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(evenBudgetFor(level), `L${level} budget`).toBeGreaterThan(evenBudgetFor(level - 1));
    }
  });

  it('XP thresholds are the SRD ones and stay ordered', () => {
    expect(LEVEL_XP[5]).toBe(14000);
    expect(LEVEL_XP[6]).toBe(23000);
    for (let i = 1; i < LEVEL_XP.length; i++) expect(LEVEL_XP[i]!).toBeGreaterThan(LEVEL_XP[i - 1]!);
    expect(levelForXp(23000)).toBe(7);
  });
});

/**
 * A 4th-level slot arrives at 7th level and this game has no 4th-level spells,
 * so without upcasting it is a resource that cannot be spent at all —
 * legalActions offered every spell at its own level and nothing else. Fourteen
 * spells were written with slot scaling that had never once been reachable.
 */
describe('upcasting', () => {
  const wizardAt = (level: number) => {
    const wiz = { ...buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 1, y: 1 }, level }), id: 'wiz' };
    const c = new Combat({
      seed: 3, width: 8, height: 8,
      combatants: [wiz, { ...buildMonster('ogre', 'team2', { x: 4, y: 4 }), id: 'o1' }],
    });
    while (c.activeId !== 'wiz') c.apply({ kind: 'endTurn' });
    return c;
  };

  it("a 7th-level caster can actually spend its 4th-level slot", () => {
    const c = wizardAt(7);
    expect(c.state.combatants['wiz']!.spellSlots).toHaveLength(4);
    const atFour = c.legalActions('wiz')
      .filter((a) => a.kind === 'castSpell' && a.slotLevel === 4);
    expect(atFour.length, 'nothing can be cast with the 4th-level slot').toBeGreaterThan(0);
  });

  it('offers a bigger slot only where it changes something', () => {
    const c = wizardAt(7);
    const casts = c.legalActions('wiz').filter((a) => a.kind === 'castSpell');
    for (const a of casts) {
      if (a.kind !== 'castSpell') continue;
      const spell = SPELLS[a.spellId]!;
      if (a.slotLevel > spell.level && spell.level > 0) {
        expect(spell.upcast, `${a.spellId} offered above its level without scaling`).toBe(true);
      }
    }
    // Web does not scale, so it must appear at 2nd and nowhere above it.
    const web = casts.filter((a) => a.kind === 'castSpell' && a.spellId === 'web');
    expect(new Set(web.map((a) => (a as { slotLevel: number }).slotLevel))).toEqual(new Set([2]));
  });

  it('leaves an innate caster able to cast innately', () => {
    // Ray of Sickness is both innate (Abyssal Tiefling) and upcastable, and
    // enumerating slot levels alone silently dropped the slotLevel-0 innate
    // cast — a fighter with the species trait could no longer use it at all.
    const f = {
      ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 1, y: 1 }, level: 3, speciesId: 'tiefling' }),
      id: 'ftr',
    };
    const c = new Combat({
      seed: 2, width: 8, height: 8,
      combatants: [f, { ...buildMonster('ogre', 'team2', { x: 3, y: 3 }), id: 'o1' }],
    });
    while (c.activeId !== 'ftr') c.apply({ kind: 'endTurn' });
    const innate = c.legalActions('ftr')
      .filter((a) => a.kind === 'castSpell' && a.spellId === 'ray-of-sickness' && a.slotLevel === 0);
    expect(innate.length, 'the innate cast was dropped').toBeGreaterThan(0);
  });
});
