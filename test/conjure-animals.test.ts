/**
 * Conjure Animals: a pack of spirit beasts that runs things down.
 *
 * WHY IT IS A SUMMON AND NOT AN AURA
 *
 * The 2024 spell is a ten-foot emanation, and the obvious implementation is
 * `spiritualGuardians` — an aura on the caster, which this engine already has.
 * That would be the wrong spell. The pack MOVES: it lopes across the board
 * after whatever is nearest, which is the difference between standing in a
 * cloud of blades and setting animals on somebody. So it rides the Spiritual
 * Weapon / Flaming Sphere machinery instead.
 *
 * What it does not share with those two is the strike. They pick one adjacent
 * victim; a pack mauls everything within ten feet of where it stands. And the
 * save avoids the damage entirely rather than halving it, which is what makes
 * it a gamble against nimble things and brutal against brutes.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { breakConcentration } from '../src/engine/rules/attack.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { Combatant, Position } from '../src/engine/types.js';

function board(foes: Position[], seed = 3) {
  const me: Combatant = buildCharacter({ classId: 'druid', team: 'team1', position: { x: 0, y: 0 }, level: 7 });
  me.spellIds = [...new Set([...me.spellIds, 'conjure-animals'])];
  const enemies = foes.map((p, i) => ({
    ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 60, maxHp: 60,
  }));
  const c = new Combat({ combatants: [me, ...enemies], seed });
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
  return { c, meId: me.id };
}

function conjure(c: Combat, meId: string, at: Position, slotLevel = 3) {
  return c.apply({ kind: 'castSpell', spellId: 'conjure-animals', slotLevel, targets: [{ position: at }] });
}

describe('the pack', () => {
  it('is a 3rd-level druid spell that takes concentration', () => {
    const spell = SPELLS['conjure-animals']!;
    expect(spell.level).toBe(3);
    expect(spell.concentration).toBe(true);
    expect(CLASSES.druid!.spellcasting!.spellsByLevel[5] ?? []).toContain('conjure-animals');
  });

  it('is not on the ranger list, which never sees a 3rd-level slot', () => {
    // The ranger is a half-caster and tops out at 2nd-level slots inside the
    // level-7 cap, so putting Conjure Animals on its list would be a spell it
    // could read and never cast — the dead data this codebase keeps finding.
    const sc = CLASSES.ranger!.spellcasting!;
    expect(sc.slotsByLevel[6]?.length ?? 0).toBeLessThan(3);
    expect(Object.values(sc.spellsByLevel).flat()).not.toContain('conjure-animals');
  });

  it('mauls everything within ten feet, not just one adjacent victim', () => {
    // THE difference from Spiritual Weapon. A pack that could only bite one
    // creature at a time would be a Spiritual Weapon with fur.
    //
    // ONE OF THESE ORCS IS DELIBERATELY NOT ADJACENT. The first version put
    // three orcs around the landing cell and every one of them was also next to
    // it, so replacing the ten-foot check with an adjacency check left the test
    // green — it could not tell the two rules apart, which is the only thing it
    // was there to do. `e1` at (5,3) is two cells from the pack at (5,5): ten
    // feet, and not adjacent.
    const { c, meId } = board([{ x: 4, y: 4 }, { x: 5, y: 3 }]);
    // Landed on an EMPTY cell — the spell targets a cell the way Flaming
    // Sphere does, so it cannot be dropped on a body.
    const events = conjure(c, meId, { x: 5, y: 5 });
    const bitten = new Set(events.flatMap((e) => (e.type === 'damageDealt' ? [e.targetId] : [])));
    expect(bitten.size).toBeGreaterThan(1);
    expect(bitten.has('e1'), 'the orc ten feet away was not bitten').toBe(true);
    for (const e of events) {
      if (e.type === 'damageDealt') expect(e.via).toBe('conjure-animals');
    }
  });

  it('chases: it moves toward the nearest enemy on the caster\'s turn', () => {
    // The whole reason this is a summon rather than an aura on the caster.
    const { c, meId } = board([{ x: 7, y: 7 }]);
    conjure(c, meId, { x: 1, y: 1 });
    const before = { ...c.state.combatants[meId]!.summons![0]!.position };
    // Round the table back to the druid; `activateSummons` runs at turn start.
    let guard = 0;
    do { c.apply({ kind: 'endTurn' }); } while (c.activeId !== meId && guard++ < 30);
    const after = c.state.combatants[meId]!.summons?.[0]?.position;
    expect(after, 'the pack vanished').toBeDefined();
    expect(after!.x !== before.x || after!.y !== before.y, 'the pack never moved').toBe(true);
  });

  it('deals nothing at all on a successful save', () => {
    // Save for NOTHING, not for half — the 2024 wording, and what makes the
    // spell a gamble rather than reliable chip damage. Rolled over many seeds
    // so both outcomes are certain to appear.
    let sawZero = false;
    let sawHit = false;
    for (let seed = 1; seed <= 40 && !(sawZero && sawHit); seed++) {
      const { c, meId } = board([{ x: 4, y: 4 }], seed);
      const events = conjure(c, meId, { x: 4, y: 3 });
      const saved = events.some((e) => e.type === 'savingThrow' && e.success);
      const hurt = events.some((e) => e.type === 'damageDealt');
      if (saved && !hurt) sawZero = true;
      if (hurt) sawHit = true;
    }
    expect(sawZero, 'a successful save never once avoided the damage entirely').toBe(true);
    expect(sawHit, 'the pack never once bit anybody').toBe(true);
  });

  it('scales with the slot it was cast from', () => {
    const { c, meId } = board([{ x: 4, y: 4 }]);
    conjure(c, meId, { x: 4, y: 3 }, 4);
    expect(c.state.combatants[meId]!.summons![0]!.dice).toBe('4d10');
  });

  it('vanishes when the druid loses concentration', () => {
    // Held by concentration, so `breakConcentration` sweeps it — the general
    // rule for concentration-held summons, which this must not sidestep.
    const { c, meId } = board([{ x: 4, y: 4 }]);
    conjure(c, meId, { x: 4, y: 3 });
    expect(c.state.combatants[meId]!.summons?.length).toBe(1);
    breakConcentration(c.state, meId);
    expect(c.state.combatants[meId]!.summons?.length ?? 0).toBe(0);
  });
});

describe('the AI casts it', () => {
  it('drops the pack on a clump', () => {
    // A spell with no scoring case is one the druid holds all campaign.
    const me: Combatant = buildCharacter({ classId: 'druid', team: 'team1', position: { x: 0, y: 3 }, level: 7 });
    me.spellIds = ['conjure-animals', 'poison-spray'];
    me.inventory = [];
    const enemies = [{ x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }].map((p, i) => ({
      ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 60, maxHp: 60,
    }));
    const c = new Combat({ combatants: [me, ...enemies], seed: 4 });
    let guard = 0;
    while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
    const a = chooseAction(c.state, me.id);
    expect(a.kind === 'castSpell' && a.spellId === 'conjure-animals').toBe(true);
  });

  it('will not hold two concentration spells at once', () => {
    const me: Combatant = buildCharacter({ classId: 'druid', team: 'team1', position: { x: 0, y: 3 }, level: 7 });
    me.spellIds = ['conjure-animals', 'poison-spray'];
    me.inventory = [];
    const foe = { ...buildMonster('orc', 'team2', { x: 5, y: 3 }), id: 'e0', hp: 60, maxHp: 60 };
    const c = new Combat({ combatants: [me, foe], seed: 4 });
    let guard = 0;
    while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
    c.state.combatants[me.id]!.concentratingOn = { spellId: 'moonbeam', targetIds: [] };
    const a = chooseAction(c.state, me.id);
    expect(a.kind === 'castSpell' && a.spellId === 'conjure-animals').toBe(false);
  });
});
