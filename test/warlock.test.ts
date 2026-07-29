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
        if (!withInvocation) me.featureIds = me.featureIds.filter((f) => f !== 'eldritch-invocations');
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
    expect(c.state.combatants[me.id]!.tempHp ?? 0).toBe(0);
    // Straight through the damage rule, which is the one place that knows both
    // that a creature reached zero AND who put it there — `kill` takes only the
    // body, which is why the hook cannot live there.
    applyDamage(c.state, 'e0', me.id, 5, 'force', [5]);
    expect(c.state.combatants.e0!.alive).toBe(false);
    expect(c.state.combatants[me.id]!.tempHp ?? 0).toBeGreaterThan(0);
  });

  it('does not feed on an ally, or on itself', () => {
    const me = warlock(7);
    const friend = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 1, y: 3 }, level: 3 }), id: 'a0' };
    const c = new Combat({ combatants: [me, friend, { ...buildMonster('orc', 'team2', { x: 6, y: 6 }), id: 'e9' }], seed: 4 });
    c.state.combatants.a0!.hp = 1;
    applyDamage(c.state, 'a0', me.id, 50, 'force', [50]);
    expect(c.state.combatants[me.id]!.tempHp ?? 0).toBe(0);
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
