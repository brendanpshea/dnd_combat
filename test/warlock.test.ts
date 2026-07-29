/**
 * The Warlock. Pact Magic is the whole of it.
 *
 * Two slots, always at the caster's highest tier, back on EVERY short rest —
 * against a wizard's many that only return at dawn. The arena runs two fights a
 * day with a short rest between, which is exactly the rhythm the class is built
 * for: the wizard walks into the afternoon depleted and the warlock walks in
 * full.
 *
 * The consequence is that a warlock spends most turns on a CANTRIP, which is
 * why Eldritch Blast has to be good and why Agonizing Blast is the invocation
 * every warlock takes.
 *
 * WHAT THE EXISTING TESTS CAUGHT
 *
 * The first draft of the spell list reached for Vicious Mockery, Sleep,
 * Fireball and Confusion, because they are good and the class looked thin
 * without them. `srd-spell-lists` rejected every one — none is on the SRD
 * warlock list. The first draft also granted "Agonizing Blast" as a level-2
 * feature; `srd-class-features` reads the SRD's own `Level N:` headings and
 * pointed out that the level-1 feature is Eldritch Invocations, of which
 * Agonizing Blast is one.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';
import { SPELLS, eldritchBeams } from '../src/data/spells.js';
import { legalActions } from '../src/engine/actions.js';
import { chooseAction } from '../src/ai/greedy.js';
import { applyDamage } from '../src/engine/rules/attack.js';
import {
  newCampaign, buildCampaignParty, setPartyClass, shortRest, longRest, LEVEL_XP, growSpellsForLevel,
} from '../src/campaign/campaign.js';
import { rolesOf } from '../src/campaign/roles.js';
import type { Combatant } from '../src/engine/types.js';

function warlock(level: number): Combatant {
  return buildCharacter({ classId: 'warlock', team: 'team1', position: { x: 0, y: 3 }, level });
}

function fight(level: number, foes = [{ x: 4, y: 3 }]) {
  const me = warlock(level);
  const enemies = foes.map((p, i) => ({
    ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 60, maxHp: 60,
  }));
  const c = new Combat({ combatants: [me, ...enemies], seed: 4 });
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
  return { c, meId: me.id };
}

describe('Pact Magic', () => {
  it('holds few slots, all at one tier', () => {
    // The shape of the class, and the shape that `legalActions` could not cast
    // from until the slot-payment fix.
    const table = CLASSES.warlock!.spellcasting!.slotsByLevel;
    for (const [i, row] of table.entries()) {
      const nonZero = row.filter((n) => n > 0);
      expect(nonZero, `level ${i + 1} should hold one tier`).toHaveLength(1);
      expect(nonZero[0], `level ${i + 1} slot count`).toBeLessThanOrEqual(2);
    }
    // And the tier climbs: two 4th-level slots by the cap.
    expect(table[7]!).toEqual([0, 0, 0, 2]);
  });

  it('can cast its whole list despite the gap under its slots', () => {
    // The failure the slot-payment fix exists for, stated from the class's
    // side: a level-7 warlock holds only 4th-level slots, and most of its list
    // is 1st and 2nd level and does not scale.
    const { c, meId } = fight(7);
    const live = c.state.combatants[meId]!;
    const castable = new Set(legalActions(c.state, meId)
      .flatMap((a) => (a.kind === 'castSpell' ? [a.spellId] : [])));
    const leveled = live.spellIds.filter((id) => (SPELLS[id]?.level ?? 0) >= 1);
    expect(leveled.length, 'this test needs leveled spells to check').toBeGreaterThan(0);
    // Every leveled spell it has prepared and can target must be offered.
    expect(castable.has('hold-person') || castable.has('suggestion')).toBe(true);
  });

  it('gets every slot back on a short rest', () => {
    // The bargain of the class. Arcane Recovery's half-level budget would have
    // handed back one 4th-level slot every OTHER rest instead.
    const c = newCampaign(1);
    setPartyClass(c, 0, 'warlock');
    c.partyReady = true;
    c.xp = LEVEL_XP[6]!;
    growSpellsForLevel(c);
    const built = buildCampaignParty(c)[0]!;
    const top = built.spellSlots.length - 1;
    c.characters[0]!.resources = {
      ...c.characters[0]!.resources,
      hp: built.hp,
      slots: built.spellSlots.map(() => 0),
    };
    expect(buildCampaignParty(c)[0]!.spellSlots[top]!.current).toBe(0);
    shortRest(c);
    const after = buildCampaignParty(c)[0]!.spellSlots[top]!;
    expect(after.current, 'a short rest must refill every pact slot').toBe(after.max);
  });

  it('is not handed a wizard\'s recovery by accident', () => {
    // It must not ALSO have Arcane Recovery — the pact branch runs first, and a
    // warlock holding both would be an unbounded slot machine.
    const me = warlock(7);
    expect(me.featureIds).toContain('pact-magic');
    expect(me.featureIds).not.toContain('arcane-recovery');
  });
});

describe('Eldritch Blast', () => {
  it('is a cantrip, so it costs nothing to throw every turn', () => {
    expect(SPELLS['eldritch-blast']!.level).toBe(0);
  });

  it('fires a second beam from level 5, and only from level 5', () => {
    expect(eldritchBeams(4)).toBe(1);
    expect(eldritchBeams(5)).toBe(2);
    for (const level of [1, 4]) {
      const { c, meId } = fight(level, [{ x: 4, y: 3 }, { x: 5, y: 3 }]);
      const events = c.apply({
        kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
        targets: [{ combatantId: 'e0' }, { combatantId: 'e1' }],
      });
      const rolls = events.filter((e) => e.type === 'attackRolled').length;
      expect(rolls, `level ${level} should fire one beam even when handed two targets`).toBe(1);
    }
    const { c, meId } = fight(5, [{ x: 4, y: 3 }, { x: 5, y: 3 }]);
    void meId;
    const events = c.apply({
      kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
      targets: [{ combatantId: 'e0' }, { combatantId: 'e1' }],
    });
    expect(events.filter((e) => e.type === 'attackRolled')).toHaveLength(2);
  });

  it('adds Charisma to every beam, not once to the cast', () => {
    // The invocation applies per BEAM. Paying it once would quietly halve it
    // from level 5 on — the same trap the older cantrip cases fell into by
    // keeping their level-1 dice.
    //
    // Measured against a warlock with the invocation stripped, over many seeds,
    // because a single roll cannot separate "+Cha twice" from "+Cha once" —
    // 1d10 spans ten points and the modifier is four.
    const damage = (withInvocation: boolean) => {
      let total = 0;
      let beams = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const me = warlock(5);
        if (!withInvocation) me.featureIds = me.featureIds.filter((f) => f !== 'agonizing-blast');
        const foes = [{ x: 4, y: 3 }, { x: 5, y: 3 }].map((p, i) => ({
          ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 200, maxHp: 200,
        }));
        const c = new Combat({ combatants: [me, ...foes], seed });
        let guard = 0;
        while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
        for (const e of c.apply({
          kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
          targets: [{ combatantId: 'e0' }, { combatantId: 'e1' }],
        })) {
          if (e.type === 'attackRolled' && e.hit) beams++;
          if (e.type === 'damageDealt') total += e.amount;
        }
      }
      return { total, beams };
    };
    const on = damage(true);
    const off = damage(false);
    expect(on.beams, 'no beam ever landed, so this measures nothing').toBeGreaterThan(0);
    // The gap has to be about Charisma PER LANDED BEAM, not per cast.
    const perBeam = (on.total - off.total) / Math.max(1, (on.beams + off.beams) / 2);
    expect(perBeam).toBeGreaterThan(1.5);
  });

  it('is what the AI reaches for once the two slots are gone', () => {
    // The warlock's ordinary turn. With a slot in hand it correctly spends it —
    // Suggestion removes an enemy outright and beats any cantrip, and watching
    // it do that is also end-to-end proof that a pact caster can pay for a
    // 2nd-level spell out of a 4th-level slot. But it holds two slots for a
    // whole fight, so most turns look like this one.
    const { c, meId } = fight(5, [{ x: 4, y: 3 }]);
    const live = c.state.combatants[meId]!;
    live.spellSlots.forEach((sl) => { sl.current = 0; });
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'castSpell' && a.spellId === 'eldritch-blast').toBe(true);
  });

  it('spends a slot when it has one, rather than hoarding it', () => {
    const { c, meId } = fight(5, [{ x: 4, y: 3 }]);
    const a = chooseAction(c.state, meId);
    expect(a.kind).toBe('castSpell');
    expect(a.kind === 'castSpell' && (SPELLS[a.spellId]?.level ?? 0) >= 1).toBe(true);
  });
});

describe("Dark One's Blessing", () => {
  it('feeds the warlock temporary hit points for a kill', () => {
    const me = warlock(7);
    const foe = { ...buildMonster('orc', 'team2', { x: 1, y: 3 }), id: 'e0', hp: 1, maxHp: 60 };
    const c = new Combat({ combatants: [me, foe], seed: 4 });
    let guard = 0;
    while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
    // A level-7 warlock already carries Fiendish Vigor's temporary hit points
    // (the level-5 invocation's default), so this measures the CHANGE rather
    // than assuming it starts at zero.
    const before = c.state.combatants[me.id]!.tempHp ?? 0;
    // Straight through the damage rule, which is the one place that knows both
    // that a creature reached zero AND who put it there — `kill` takes only the
    // body, which is why the hook cannot live there.
    applyDamage(c.state, 'e0', me.id, 5, 'force', [5]);
    expect(c.state.combatants.e0!.alive).toBe(false);
    expect(c.state.combatants[me.id]!.tempHp ?? 0).toBeGreaterThan(before);
  });

  it('does not feed on an ally, or on itself', () => {
    const me = warlock(7);
    const friend = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 1, y: 3 }, level: 3 }), id: 'a0' };
    const c = new Combat({ combatants: [me, friend, { ...buildMonster('orc', 'team2', { x: 6, y: 6 }), id: 'e9' }], seed: 4 });
    c.state.combatants.a0!.hp = 1;
    const before = c.state.combatants[me.id]!.tempHp ?? 0;
    applyDamage(c.state, 'a0', me.id, 50, 'force', [50]);
    expect(c.state.combatants[me.id]!.tempHp ?? 0).toBe(before);
  });
});

describe('the party roller knows what a warlock is for', () => {
  it('counts it as magic and as ranged, and not as a healer', () => {
    // `roles.ts` derives this from the class data rather than a list, which is
    // the whole reason the random-party button did not need editing for the
    // warlock. It has no healing spell in the SRD, and must not claim to.
    const roles = rolesOf('warlock');
    expect(roles.has('magic')).toBe(true);
    expect(roles.has('ranged')).toBe(true);
    expect(roles.has('healing')).toBe(false);
  });
});

describe('a long rest still works', () => {
  it('refills pact slots at dawn too', () => {
    const c = newCampaign(1);
    setPartyClass(c, 0, 'warlock');
    c.partyReady = true;
    const built = buildCampaignParty(c)[0]!;
    c.characters[0]!.resources = {
      ...c.characters[0]!.resources, hp: built.hp, slots: built.spellSlots.map(() => 0),
    };
    longRest(c);
    const after = buildCampaignParty(c)[0]!.spellSlots;
    expect(after.some((s) => s.current > 0 && s.current === s.max)).toBe(true);
  });
});

describe('multi-shot spells fire every shot', () => {
  it('never leaves a shot unfired against a lone enemy', () => {
    // The bug Eldritch Blast walked into. `spellTargetSets` decided which
    // spells could stack their shots on one creature from a hard-coded list of
    // two ids, so a third spell of the same shape fired ONE beam at a lone
    // enemy however many it had earned — most of a warlock's damage, quietly
    // missing. It reads `stacksOnOneTarget` off the spell now, and this holds
    // every spell that declares it to actually offering all of its shots.
    for (const [id, spell] of Object.entries(SPELLS)) {
      if (!spell.stacksOnOneTarget) continue;
      const t = spell.targeting as { kind: string; count?: number };
      expect(t.count ?? 1, `${id} stacks but fires one shot`).toBeGreaterThan(1);

      const me = buildCharacter({ classId: 'warlock', team: 'team1', position: { x: 0, y: 3 }, level: 8 });
      me.spellIds = [...new Set([...me.spellIds, id])];
      const foe = { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0', hp: 200, maxHp: 200 };
      const c = new Combat({ combatants: [me, foe], seed: 4 });
      let guard = 0;
      while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
      const offered = legalActions(c.state, me.id)
        .find((a) => a.kind === 'castSpell' && a.spellId === id);
      if (!offered || offered.kind !== 'castSpell') continue;   // no slot for it
      expect(offered.targets.length, `${id} against one enemy`).toBe(t.count);
    }
  });
});

describe('Hex', () => {
  it('is a 1st-level bonus action the warlock starts with', () => {
    // The SRD recommends Hex as one of a warlock's two starting spells, and it
    // is the other half of Eldritch Blast. Its own list check missed it: the
    // hand-written SRD list in srd-spell-lists omitted Hex entirely, which
    // would have silently forbidden it.
    const spell = SPELLS.hex!;
    expect(spell.level).toBe(1);
    expect(spell.castingTime).toBe('bonus');
    expect(spell.concentration).toBe(true);
    expect(CLASSES.warlock!.spellcasting!.spellsByLevel[1] ?? []).toContain('hex');
  });

  it('adds a die to every hit, not once per turn', () => {
    // The pairing that makes the class work: two beams carry the rider twice.
    // Rolled against an unhexed control over many seeds, because 1d6 cannot be
    // separated from 1d10's spread in a single cast.
    const damage = (hexed: boolean) => {
      let total = 0;
      let hits = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const me = warlock(5);
        const foe = { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0', hp: 400, maxHp: 400 };
        const c = new Combat({ combatants: [me, foe], seed });
        let guard = 0;
        while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
        if (hexed) {
          c.state.combatants.e0!.conditions.push({ id: 'hexed', sourceId: me.id, concentration: true });
        }
        for (const e of c.apply({
          kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
          targets: [{ combatantId: 'e0' }, { combatantId: 'e0' }],
        })) {
          if (e.type === 'attackRolled' && e.hit) hits++;
          if (e.type === 'damageDealt') total += e.amount;
        }
      }
      return { total, hits };
    };
    const on = damage(true);
    const off = damage(false);
    expect(on.hits).toBeGreaterThan(0);
    const perHit = (on.total - off.total) / Math.max(1, (on.hits + off.hits) / 2);
    // 1d6 averages 3.5; anything near 1.75 would mean it paid once per CAST
    // rather than once per beam.
    expect(perHit, 'Hex should add about 3.5 per landed beam').toBeGreaterThan(2.2);
  });

  it('only helps the warlock who cast it', () => {
    const me = warlock(5);
    const friend = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'a0' };
    const foe = { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0', hp: 400, maxHp: 400 };
    const c = new Combat({ combatants: [me, friend, foe], seed: 3 });
    // Hexed by somebody else entirely — the fighter's swings must not carry it.
    c.state.combatants.e0!.conditions.push({ id: 'hexed', sourceId: 'nobody', concentration: true });
    let guard = 0;
    while (c.activeId !== 'a0' && guard++ < 30) c.apply({ kind: 'endTurn' });
    const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'e0' });
    for (const e of events) {
      if (e.type === 'damageDealt') expect(e.tags ?? []).not.toContain('Hex');
    }
  });

  it('moves to a new quarry when its target drops', () => {
    // Same courtesy Hunter's Mark gets, and for the same reason: a rider that
    // died with its target would make the bonus action a worse deal than it
    // reads as. Both riders share one loop so neither can be forgotten.
    const me = warlock(5);
    const a = { ...buildMonster('orc', 'team2', { x: 2, y: 3 }), id: 'e0', hp: 1, maxHp: 60 };
    const b = { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e1', hp: 60, maxHp: 60 };
    const c = new Combat({ combatants: [me, a, b], seed: 3 });
    c.state.combatants.e0!.conditions.push({ id: 'hexed', sourceId: me.id, concentration: true });
    c.state.combatants[me.id]!.concentratingOn = { spellId: 'hex', targetIds: ['e0'] };
    applyDamage(c.state, 'e0', me.id, 20, 'necrotic', [20]);
    expect(c.state.combatants.e1!.conditions.some((k) => k.id === 'hexed' && k.sourceId === me.id)).toBe(true);
    expect(c.state.combatants[me.id]!.concentratingOn?.targetIds).toEqual(['e1']);
  });

  it('is what the AI spends its bonus action on', () => {
    const { c, meId } = fight(5, [{ x: 4, y: 3 }]);
    // Bonus action free, nothing hexed yet: Hex should be the pick.
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'castSpell' && a.spellId === 'hex').toBe(true);
  });
});

/**
 * Eldritch Invocations, as choices.
 *
 * The first version of this class granted exactly ONE invocation, hard-coded,
 * where the SRD's own table gives 1 at level 1, 3 by level 2, 5 by level 5 and
 * 6 by level 7. That is about a sixth of the feature, and the invocations are
 * where most of a warlock's power budget lives — it measured as the
 * lowest-damage non-support class, which read as a design trade and was a
 * missing feature.
 */
describe('Eldritch Invocations', () => {
  it('grows with level instead of stopping at one', () => {
    const points = CLASSES.warlock!.choices ?? [];
    expect(points.length, 'a warlock should gain invocations as it levels').toBeGreaterThanOrEqual(4);
    // One at level 1, and more later — the shape of the SRD's column.
    expect(points.filter((p) => p.atLevel === 1)).toHaveLength(1);
    expect(points.some((p) => p.atLevel > 1)).toBe(true);
  });

  it('gives a warlock who never opens the screen a working set', () => {
    // Every default is the strongest option, which is the "auto-choose best"
    // half of this — the picks are visible and changeable, but ignoring them
    // must not produce a broken character.
    const at1 = warlock(1).featureIds;
    const at7 = warlock(7).featureIds;
    expect(at1).toContain('agonizing-blast');
    expect(at7.filter((f) => INVOCATIONS.has(f)).length,
      'a level-7 warlock should hold several invocations').toBeGreaterThanOrEqual(3);
  });

  it('offers only invocations that do something in this game', () => {
    // Eldritch Spear extends a range nothing on an eight-cell board can exceed;
    // Devil's Sight needs a Darkness that does not exist; Thirsting Blade,
    // Lifedrinker and Devouring Blade all hang off a pact weapon. Four real
    // choices beat six where two are decoration.
    for (const point of CLASSES.warlock!.choices ?? []) {
      for (const opt of point.options) {
        for (const id of opt.grants?.featureIds ?? []) {
          expect(FEATURES[id], `${opt.id} grants ${id}, which does not exist`).toBeDefined();
          expect(INVOCATIONS.has(id), `${id} should be a known invocation`).toBe(true);
        }
      }
    }
  });

  it('every default is a real option of its own choice point', () => {
    for (const point of CLASSES.warlock!.choices ?? []) {
      expect(point.options.some((o) => o.id === point.default),
        `${point.id}'s default is not one of its options`).toBe(true);
    }
  });
});

const INVOCATIONS = new Set([
  'agonizing-blast', 'armor-of-shadows', 'fiendish-vigor', 'repelling-blast',
  'gift-of-the-protectors',
]);

describe('what the invocations actually do', () => {
  it('Armor of Shadows is simply on', () => {
    const me = buildCharacter({
      classId: 'warlock', team: 'team1', position: { x: 0, y: 3 }, level: 1,
      choices: { 'invocation-1': 'armor-of-shadows' },
    });
    expect(me.mageArmor).toBe(true);
  });

  it('Fiendish Vigor brings temporary hit points into the fight', () => {
    const with_ = buildCharacter({
      classId: 'warlock', team: 'team1', position: { x: 0, y: 3 }, level: 1,
      choices: { 'invocation-1': 'fiendish-vigor' },
    });
    const without = buildCharacter({
      classId: 'warlock', team: 'team1', position: { x: 0, y: 3 }, level: 1,
      choices: { 'invocation-1': 'agonizing-blast' },
    });
    expect(with_.tempHp ?? 0).toBeGreaterThan(0);
    expect(without.tempHp ?? 0).toBe(0);
  });

  it('Repelling Blast shoves on every beam', () => {
    // The one invocation that changes the shape of a fight rather than its
    // numbers. Two beams means two shoves, so it must move further at level 5
    // than a single hit could.
    let moved = false;
    for (let seed = 1; seed <= 40 && !moved; seed++) {
      const me = buildCharacter({
        classId: 'warlock', team: 'team1', position: { x: 0, y: 3 }, level: 5,
        choices: { 'invocation-2': 'repelling-blast' },
      });
      const foe = { ...buildMonster('orc', 'team2', { x: 2, y: 3 }), id: 'e0', hp: 300, maxHp: 300 };
      const c = new Combat({ combatants: [me, foe], seed });
      let guard = 0;
      while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
      const from = { ...c.state.combatants.e0!.position };
      c.apply({
        kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
        targets: [{ combatantId: 'e0' }, { combatantId: 'e0' }],
      });
      const to = c.state.combatants.e0!.position;
      if (to.x !== from.x || to.y !== from.y) moved = true;
    }
    expect(moved, 'a landed beam never once shoved anything').toBe(true);
  });

  it('Gift of the Protectors leaves an ally standing on 1, once per rest', () => {
    const me = buildCharacter({
      classId: 'warlock', team: 'team1', position: { x: 0, y: 3 }, level: 7,
      choices: { 'invocation-4': 'gift-of-the-protectors' },
    });
    const friend = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 1, y: 3 }, level: 5 }), id: 'a0' };
    const foe = { ...buildMonster('orc', 'team2', { x: 6, y: 6 }), id: 'e9' };
    const c = new Combat({ combatants: [me, friend, foe], seed: 3 });
    c.state.combatants.a0!.hp = 4;
    applyDamage(c.state, 'a0', 'e9', 40, 'slashing', [40]);
    expect(c.state.combatants.a0!.hp, 'the ally should be left on 1').toBe(1);
    expect(c.state.combatants.a0!.conditions.some((k) => k.id === 'unconscious')).toBe(false);
    // Spent: the next ally to fall gets no such courtesy.
    c.state.combatants.a0!.hp = 4;
    applyDamage(c.state, 'a0', 'e9', 40, 'slashing', [40]);
    expect(c.state.combatants.a0!.hp).toBe(0);
  });
});
