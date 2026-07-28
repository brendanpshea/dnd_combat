import { describe, it, expect } from 'vitest';
import { RUN_TARGET_XP } from '../src/arena/medal.js';
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

/**
 * Level 8: cheap to add, and the reason for adding it.
 *
 * In the SRD level 8 is an Ability Score Increase and nothing else for most
 * classes — no new spell tier, no new subclass feature — so the cost is a +2
 * and one more entry in each per-level array. What it buys is several more
 * fights with a second 4th-level slot in hand, which is where the interesting
 * spells are and where the arena had almost no data.
 *
 * The trap it opened: the finish line was 34,000, the level-8 threshold. Adding
 * the level would have meant reaching it and having the run end in the same
 * instant — an eighth level that exists and is never played.
 */
describe('level 8', () => {
  it('is reachable, and is not the finish line', () => {
    expect(MAX_LEVEL).toBe(8);
    expect(levelForXp(LEVEL_XP[7]!)).toBe(8);
    // Strictly greater, with room in it: a party that hits level 8 must get
    // fights at level 8.
    expect(RUN_TARGET_XP).toBeGreaterThan(LEVEL_XP[7]! + 5000);
  });

  it('gives every class its ability score increase', () => {
    for (const id of Object.keys(CLASSES)) {
      const at7 = buildCharacter({ classId: id, team: 'team1', position: { x: 0, y: 0 }, level: 7 });
      const at8 = buildCharacter({ classId: id, team: 'team1', position: { x: 0, y: 0 }, level: 8 });
      const primary = CLASSES[id]!.statPriority[0]!;
      // Capped at 20, so a class already there gains nothing rather than
      // overflowing — which is the correct outcome, not a missing feature.
      const expected = Math.min(20, at7.abilities[primary] + 2);
      expect(at8.abilities[primary], `${id} primary at level 8`).toBe(expected);
    }
  });

  it('gives every caster the slots the level comes with', () => {
    for (const [id, cls] of Object.entries(CLASSES)) {
      const sc = cls.spellcasting;
      if (!sc) continue;
      expect(sc.slotsByLevel, `${id} slots`).toHaveLength(MAX_LEVEL);
      const at7 = sc.slotsByLevel[6]!;
      const at8 = sc.slotsByLevel[7]!;
      // Never fewer slots for being a level higher — the shape of bug that
      // would be invisible until somebody levelled up and lost a spell.
      at8.forEach((n, i) => expect(n, `${id} tier ${i + 1}`).toBeGreaterThanOrEqual(at7[i] ?? 0));
      expect(at8.length).toBeGreaterThanOrEqual(at7.length);
    }
  });

  it('gives every caster a prepared/cantrip column for the new level', () => {
    // A short array reads as `undefined` at level 8 and silently falls back,
    // which is how a level-8 wizard ends up preparing a level-1 loadout.
    for (const [id, cls] of Object.entries(CLASSES)) {
      const sc = cls.spellcasting;
      if (!sc) continue;
      for (const key of ['cantripsKnownByLevel', 'spellbookByLevel', 'preparedByLevel'] as const) {
        const arr = sc[key];
        if (arr) expect(arr, `${id}.${key}`).toHaveLength(MAX_LEVEL);
      }
    }
  });

  it('keeps generating harder encounters at the new level', () => {
    // `evenBudgetFor` clamps to the array length, so a short EVEN_BUDGET does
    // not throw — it feeds a level-8 party level-7 encounters, and the arena
    // gets easier exactly where it should get harder.
    expect(EVEN_BUDGET).toHaveLength(MAX_LEVEL);
    expect(evenBudgetFor(8)).toBeGreaterThan(evenBudgetFor(7));
  });
});
