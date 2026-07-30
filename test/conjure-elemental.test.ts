/**
 * Conjure Elemental, and the 2014 spell it is not.
 *
 * THE WHOLE POINT OF THIS FILE. The plan for this spell was "a summoned
 * creature, driven by the AI" — a stat block with hit points and its own place
 * in the initiative order. That is the 2014 version. The 2024 SRD entry
 * conjures "a Large, intangible spirit": no stat block, no hit points, nothing
 * to give an order to. It is a hazard that stands still and grabs.
 *
 * Reading the document changed the implementation completely, from
 * `summonCombatant` (a real combatant) to a `Combatant.summons` entry (a
 * position, a token, swept when concentration drops) — so the tests below are
 * as much about what it ISN'T as what it is.
 *
 * The rule that shapes everything: the SRD only offers the save "if the spirit
 * has no creature Restrained". One grip, one victim. Without that, a 5th-level
 * slot would lock down a whole wave.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { actsOnItsOwn } from '../src/engine/rules/summon.js';
import { breakConcentration } from '../src/engine/rules/attack.js';
import { scoreCastForTest } from '../src/ai/greedy.js';
import { activateSummons } from '../src/data/spells.js';
import type { Combatant, Id, Position } from '../src/engine/types.js';

const at = (x: number, y: number): Position => ({ x, y });

/** A druid, three ogres crowded next to the spirit's landing spot, and a cast. */
function field(seed = 4) {
  const hero = { ...buildCharacter({ classId: 'druid', team: 'team1', position: at(0, 0), level: 9 }), id: 'druid' };
  // Inside the spirit's 2x2 (anchored at 3,3) but never ON the anchor cell:
  // `adjacent` is false for two things in the same square, which would hide a
  // phantom strike the moment `activateSummons` stopped skipping the spirit.
  const foes = [at(4, 3), at(3, 4), at(4, 4)].map((p, i) => ({
    ...buildMonster('ogre', 'team2', p, `${i}`), id: `foe${i}`,
  }));
  const c = new Combat({ combatants: [hero, ...foes], seed, mapId: 'open' });
  let guard = 0;
  while (c.activeId !== 'druid' && guard++ < 30) c.apply({ kind: 'endTurn' });
  return c;
}

const spiritOf = (c: Combat) =>
  c.state.combatants['druid']!.summons?.find((s) => s.kind === 'conjure-elemental');

const restrainedIds = (c: Combat) =>
  Object.values(c.state.combatants).filter((x) => x.conditions.some((k) => k.id === 'restrained')).map((x) => x.id);

describe('it is a spirit, not a creature', () => {
  it('is on the druid and wizard lists, and nowhere else', () => {
    // Sorcerer is the trap: it has Insect Plague and Cone of Cold at this tier
    // but the SRD does not give it Conjure Elemental.
    const carries = Object.values(CLASSES).filter((cls) =>
      Object.values(cls.spellcasting?.spellsByLevel ?? {}).flat().includes('conjure-elemental'));
    expect(carries.map((c) => c.id).sort()).toEqual(['druid', 'wizard']);
  });

  it('puts no new combatant on the board and no new slot in initiative', () => {
    /**
     * The assertion that pins the 2014-vs-2024 reading. A summoned creature
     * would show up in both of these, and the whole implementation would be a
     * different one.
     */
    const c = field();
    const before = Object.keys(c.state.combatants).length;
    const order = c.state.initiativeOrder.length;
    c.apply({ kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(3, 3) }] });
    expect(Object.keys(c.state.combatants).length).toBe(before);
    expect(c.state.initiativeOrder.length).toBe(order);
    expect(Object.values(c.state.combatants).some(actsOnItsOwn)).toBe(false);
  });

  it('leaves a visible spirit anchored where it was cast', () => {
    const c = field();
    c.apply({ kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(3, 3) }] });
    const s = spiritOf(c)!;
    expect(s, 'no spirit on the caster').toBeDefined();
    expect(s.position).toEqual(at(3, 3));
    expect(s.dice).toBe('8d8');
  });

  it('never chases and never strikes on its caster turn', () => {
    /**
     * Spiritual Weapon and Flaming Sphere glide toward the nearest enemy and hit
     * it every time their caster's turn comes round. The spirit does neither: it
     * is anchored, and it catches whoever comes to IT.
     *
     * Position alone would not test this — the spirit's `moveCells` is 0, so it
     * cannot move whatever `activateSummons` does. The thing the skip in
     * `activateSummons` actually prevents is a PHANTOM ATTACK every round, so
     * that is what is asserted.
     */
    const c = field();
    c.apply({ kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(3, 3) }] });
    const start = { ...spiritOf(c)!.position };
    // Straight at the animator: every other summon kind produces events here.
    const strikes = activateSummons(c.state, 'druid').length;
    expect(strikes, 'the spirit moved or struck like a roaming summon').toBe(0);
    const now = spiritOf(c);
    if (now) expect(now.position).toEqual(start);
  });
});

describe('one grip, one victim', () => {
  it('catches at most one creature however many are standing in it', () => {
    /**
     * Three ogres shoulder to shoulder around the spirit. The SRD offers the
     * save only "if the spirit has no creature Restrained", so exactly one can
     * ever be held — this is the rule that keeps it from being a wave-wipe.
     */
    let everCaught = false;
    for (let seed = 1; seed <= 25; seed++) {
      const c = field(seed);
      c.apply({ kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(3, 3) }] });
      const held = restrainedIds(c);
      expect(held.length, `seed ${seed} held ${held.length}`).toBeLessThanOrEqual(1);
      if (held.length === 1) {
        everCaught = true;
        expect(spiritOf(c)!.restrainedId).toBe(held[0]);
      }
    }
    // And it does catch things — a rule that never fires is not a rule.
    expect(everCaught, 'never caught anything in 25 casts').toBe(true);
  });

  it('hurts what it catches', () => {
    let sawDamage = false;
    for (let seed = 1; seed <= 25 && !sawDamage; seed++) {
      const c = field(seed);
      const before = Object.values(c.state.combatants).filter((x) => x.team === 'team2').reduce((n, x) => n + x.hp, 0);
      c.apply({ kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(3, 3) }] });
      const after = Object.values(c.state.combatants).filter((x) => x.team === 'team2').reduce((n, x) => n + x.hp, 0);
      if (after < before) sawDamage = true;
    }
    expect(sawDamage).toBe(true);
  });
});

describe('letting go', () => {
  it('frees its victim when the druid loses concentration', () => {
    /**
     * The gap this change had to close. The restrained condition is applied to
     * a THIRD party, and the concentration machinery only sweeps conditions
     * listed in the caster's own `concentratingOn.targetIds` — the spirit's
     * victim is not in it. Without an explicit release the ogre would stay
     * restrained for the rest of the fight with nothing holding it.
     */
    let checked = false;
    for (let seed = 1; seed <= 25 && !checked; seed++) {
      const c = field(seed);
      c.apply({ kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(3, 3) }] });
      const held = restrainedIds(c);
      if (held.length !== 1) continue;
      checked = true;
      breakConcentration(c.state, 'druid');
      expect(restrainedIds(c), 'still restrained by a spirit that is gone').toEqual([]);
      expect(spiritOf(c), 'the spirit outlived the concentration').toBeUndefined();
    }
    expect(checked, 'never caught anything to release').toBe(true);
  });
});

describe('the spell is aimed, not sprayed', () => {
  it('scores zero when placed where nothing is standing', () => {
    // A stationary hazard put on empty ground is a 5th-level slot spent on
    // scenery, and the scorer has to know that or the AI will do it.
    const c = field();
    const near = scoreCastForTest(c.state, c.state.combatants['druid']!, {
      kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(3, 3) }],
    });
    const far = scoreCastForTest(c.state, c.state.combatants['druid']!, {
      kind: 'castSpell', spellId: 'conjure-elemental', slotLevel: 5, targets: [{ position: at(7, 7) }],
    });
    expect(far).toBeLessThan(near);
  });
});
