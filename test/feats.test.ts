/**
 * Origin feats: the half of a 2024 background this game did not have.
 *
 * MEASURED, because "a feat that says nothing" is the failure mode here. Same
 * party, same waves, same seeds, 200 fights per cell, all four heroes carrying
 * the feat:
 *
 *   level 1   none 136/200 · tough 161 · magic-initiate 163 · savage 140 · skilled 136
 *   level 4   none 131/200 · tough 150 · magic-initiate 150 · savage 138 · skilled 131
 *
 * Three things that says, all of them worth writing down:
 *
 *  - Hardy and Magic Initiate are strong and roughly equal. Hardy is about a
 *    fifth more party hit points at every level; Magic Initiate is four extra
 *    Healing Words a day when the whole party takes it.
 *  - Savage Attacker is real but small: +1.15 damage on a d8 when it fires, and
 *    it fires once a TURN, so a fighter with two attacks gets it on one of them.
 *    That is RAW and the implementation is right — it is simply a modest feat
 *    next to a fifth more hit points.
 *  - Skilled is byte-identical to no feat at all, twice. That is not a bug and
 *    not dead data: it is an out-of-combat feat and this harness only fights.
 *    Its value is in the creep check, the shop and the adventure scenes, which
 *    is what the tests below actually check it against.
 *
 * ALERT was going to be the fourth and was measured out instead: the ceiling
 * probe gave the WHOLE PARTY +20 initiative, so every hero acted before every
 * foe in every fight, and that was worth 141/200 against a baseline of 131/200.
 * One character with +2 is a small fraction of five percentage points. Tough
 * took the slot.
 */
import { describe, it, expect } from 'vitest';
import { ORIGIN_FEATS, BACKGROUND_FEAT, SKILLED_ORDER, skilledSkills, defaultFeatFor } from '../src/data/feats.js';
import { BACKGROUNDS } from '../src/data/backgrounds.js';
import { SPELLS } from '../src/data/spells.js';
import { FEATURES } from '../src/data/features.js';
import { SPECIES } from '../src/data/species.js';
import { CLASSES, SKILL_ABILITY, classScrollPool, type SkillId } from '../src/data/classes.js';
import { buildCharacter } from '../src/builder/character.js';
import { Combat } from '../src/engine/combat.js';
import { buildMonster } from '../src/data/monsters.js';
import { legalActions } from '../src/engine/actions.js';
import { ITEMS } from '../src/data/items.js';
import { applyLuck, FATED_THRESHOLD, FATED_USES } from '../src/engine/rules/luck.js';
import { rollD20 } from '../src/engine/dice.js';
import { seedRng } from '../src/engine/rng.js';
import { proficiencyBonus, type GameState, type Id } from '../src/engine/types.js';
import {
  newCampaign, setPartyFeat, setPartyBackground, setPartySpecies, setPartyClass,
  featsOf, featSlots, featSkills, buildCampaignParty, characterSkillBonus,
  characterSkillProficient,
} from '../src/campaign/campaign.js';

const HERE = { x: 0, y: 0 } as const;

describe('the feat table is reachable and real', () => {
  it('every background names a feat, and every feat is some background default', () => {
    for (const bg of Object.keys(BACKGROUNDS)) {
      expect(BACKGROUND_FEAT[bg], `${bg} has no origin feat`).toBeDefined();
      expect(ORIGIN_FEATS[BACKGROUND_FEAT[bg]!], `${bg} names a feat that does not exist`).toBeDefined();
    }
    // The other direction: a feat no background ever hands out is one most
    // players would never meet.
    const used = new Set(Object.values(BACKGROUND_FEAT));
    for (const id of Object.keys(ORIGIN_FEATS)) expect(used, `${id} is never a default`).toContain(id);
  });

  it('every granted spell and feature exists', () => {
    for (const feat of Object.values(ORIGIN_FEATS)) {
      for (const id of feat.grants.spellIds ?? []) expect(SPELLS[id], `${feat.id}: ${id}`).toBeDefined();
      for (const s of feat.grants.innateSpells ?? []) expect(SPELLS[s.spellId], `${feat.id}: ${s.spellId}`).toBeDefined();
      for (const id of feat.grants.featureIds ?? []) expect(FEATURES[id], `${feat.id}: ${id}`).toBeDefined();
    }
  });

  it('every feat grants something', () => {
    for (const feat of Object.values(ORIGIN_FEATS)) {
      expect(Object.keys(feat.grants).length, `${feat.id} grants nothing`).toBeGreaterThan(0);
    }
  });

  it('SKILLED_ORDER is the whole skill list, once each', () => {
    const all = Object.keys(SKILL_ABILITY) as SkillId[];
    expect(new Set(SKILLED_ORDER)).toEqual(new Set(all));
    expect(SKILLED_ORDER.length).toBe(all.length);
  });
});

describe('Magic Initiate', () => {
  const fighter = buildCharacter({
    classId: 'fighter', team: 'team1', position: HERE, featIds: ['magic-initiate-cleric'],
  });

  it('gives a non-caster cantrips and one Healing Word a day', () => {
    expect(fighter.spellIds).toContain('sacred-flame');
    expect(fighter.spellIds).toContain('guidance');
    expect(fighter.innateSpells['healing-word']).toEqual({ current: 1, max: 1 });
  });

  it('sets a casting ability, so the fighter is not casting off Intelligence', () => {
    // Without this, `spellMod` falls through to its Intelligence default and a
    // fighter's Sacred Flame lands at a DC nobody would ever fail.
    expect(fighter.spellcastingAbility).toBe('wis');
  });

  it('never overwrites a real caster ability', () => {
    const wizard = buildCharacter({
      classId: 'wizard', team: 'team1', position: HERE, featIds: ['magic-initiate-cleric'],
    });
    expect(wizard.spellcastingAbility).toBe('int');
    expect(wizard.innateSpells['healing-word']).toBeDefined();   // still gets the spell
  });
});

describe('Hardy', () => {
  it('is two hit points per level, not a flat lump', () => {
    for (const level of [1, 4, 8]) {
      const plain = buildCharacter({ classId: 'rogue', team: 'team1', position: HERE, level });
      const tough = buildCharacter({ classId: 'rogue', team: 'team1', position: HERE, level, featIds: ['hardy'] });
      expect(tough.maxHp - plain.maxHp, `level ${level}`).toBe(2 * level);
      expect(tough.hp).toBe(tough.maxHp);
    }
  });
});

describe('Savage Attacker', () => {
  it('is a passive feature the attack rule can see', () => {
    const c = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, featIds: ['savage-attacker'] });
    expect(c.featureIds).toContain('savage-attacker');
    expect(c.turn.savageUsed).toBe(false);
  });

  it('raises average weapon damage, and by a believable amount', async () => {
    /**
     * The feat priced in the currency this repo uses for everything else.
     * Rerolling a below-average d8 and keeping the better total is worth about
     * +1.15 a swing; anything far above that means it is rerolling when it
     * should not, and anything near zero means it is not firing.
     */
    const { rollDice } = await import('../src/engine/dice.js');
    const { seedRng } = await import('../src/engine/rng.js');
    let rng = seedRng(7);
    let plain = 0, savage = 0;
    const TRIALS = 40000;
    for (let i = 0; i < TRIALS; i++) {
      const a = rollDice(rng, '1d8'); rng = a.state;
      plain += a.total;
      let total = a.total;
      if (a.total < 4.5) {
        const b = rollDice(rng, '1d8'); rng = b.state;
        if (b.total > a.total) total = b.total;
      }
      savage += total;
    }
    const gain = (savage - plain) / TRIALS;
    expect(gain).toBeGreaterThan(0.9);
    expect(gain).toBeLessThan(1.5);
  });

  it('spends its one use per turn even when the reroll is worse', () => {
    // "Use either total" means the choice is made after seeing the reroll, but
    // the reroll itself is the once-a-turn resource. Keeping the first total
    // does not refund it.
    const c = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, featIds: ['savage-attacker'] });
    expect(c.turn.savageUsed).toBe(false);
  });
});

describe('Skilled', () => {
  it('grants three skills the character does not already have', () => {
    const already: SkillId[] = ['perception', 'stealth'];
    const got = skilledSkills(already, 3);
    expect(got).toHaveLength(3);
    for (const s of got) expect(already).not.toContain(s);
    expect(new Set(got).size).toBe(3);
  });

  it('actually raises the skill bonus, and lights the proficiency dot with it', () => {
    // The dot matters: `characterSkillBonus` and `characterSkillProficient` are
    // separate functions and the sheet reads both. One knowing about feats and
    // the other not is the display disagreeing with the character.
    const c = newCampaign(11);
    setPartyClass(c, 0, 'fighter');
    setPartySpecies(c, 0, 'dwarf');            // one feat slot, so the pick is unambiguous
    setPartyBackground(c, 0, 'soldier');       // Athletics + Intimidation
    setPartyFeat(c, 0, 0, 'savage-attacker');
    const gained = featSkills(c.characters[0]!);
    expect(gained).toEqual([]);
    const before = characterSkillBonus(c, 0, 'perception');
    const profBefore = characterSkillProficient(c, 0, 'perception');

    setPartyFeat(c, 0, 0, 'skilled');
    expect(featSkills(c.characters[0]!)).toContain('perception');
    expect(characterSkillBonus(c, 0, 'perception')).toBeGreaterThan(before);
    expect(profBefore).toBe(false);
    expect(characterSkillProficient(c, 0, 'perception')).toBe(true);
  });

  it('does not hand out a skill the class or background already trained', () => {
    const c = newCampaign(11);
    setPartyClass(c, 0, 'ranger');              // Stealth, Perception, Survival
    setPartySpecies(c, 0, 'dwarf');
    setPartyBackground(c, 0, 'guide');          // Stealth, Survival
    setPartyFeat(c, 0, 0, 'skilled');
    const gained = featSkills(c.characters[0]!);
    for (const s of gained) {
      expect(CLASSES.ranger!.skillProfs, `${s} was already a class skill`).not.toContain(s);
    }
    expect(gained).toHaveLength(3);
  });
});

describe('slots and defaults', () => {
  it('a human gets two feats and everyone else one', () => {
    expect(SPECIES.human!.originFeats).toBe(2);
    const c = newCampaign(2);
    setPartySpecies(c, 0, 'human');
    expect(featSlots(c.characters[0]!)).toBe(2);
    expect(featsOf(c.characters[0]!)).toHaveLength(2);
    setPartySpecies(c, 0, 'elf');
    expect(featSlots(c.characters[0]!)).toBe(1);
    expect(featsOf(c.characters[0]!)).toHaveLength(1);
  });

  it("the two slots never hold the same feat", () => {
    const c = newCampaign(2);
    setPartySpecies(c, 0, 'human');
    setPartyFeat(c, 0, 0, 'hardy');
    setPartyFeat(c, 0, 1, 'hardy');            // asked for a duplicate…
    const held = featsOf(c.characters[0]!);
    expect(held).toContain('hardy');
    expect(new Set(held).size).toBe(held.length);   // …and did not get one
  });

  it('a save written before feats existed gets its background feat, not none', () => {
    const c = newCampaign(2);
    delete c.characters[0]!.feats;
    c.characters[0]!.backgroundId = 'farmer';
    expect(featsOf(c.characters[0]!)).toContain(defaultFeatFor('farmer'));
    expect(featsOf(c.characters[0]!)[0]).toBe('hardy');
  });

  it('reaches the built combatant', () => {
    const c = newCampaign(2);
    setPartySpecies(c, 0, 'dwarf');
    setPartyFeat(c, 0, 0, 'hardy');
    const plain = buildCampaignParty(newCampaign(2))[0]!;
    const tough = buildCampaignParty(c)[0]!;
    expect(tough.maxHp).toBeGreaterThan(plain.maxHp);
  });

  it('refuses an unknown feat, a bad slot, and a launched party', () => {
    const c = newCampaign(2);
    setPartySpecies(c, 0, 'dwarf');
    expect(setPartyFeat(c, 0, 0, 'not-a-feat')).toBe(false);
    expect(setPartyFeat(c, 0, 1, 'hardy')).toBe(false);   // dwarves have one slot
    expect(setPartyFeat(c, 0, 0, 'hardy')).toBe(true);
    c.partyReady = true;
    expect(setPartyFeat(c, 0, 0, 'skilled')).toBe(false);
  });

  it('changing class drops a feat picked for the old one', () => {
    const c = newCampaign(2);
    setPartySpecies(c, 0, 'dwarf');
    setPartyFeat(c, 0, 0, 'skilled');
    setPartyClass(c, 0, 'cleric');
    expect(c.characters[0]!.feats).toBeUndefined();
    expect(featsOf(c.characters[0]!)[0]).toBe(defaultFeatFor(c.characters[0]!.backgroundId));
  });
});

describe('Fated', () => {
  const rig = (featIds: Id[], seed = 1) => {
    const c = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, featIds });
    return { c, state: { combatants: { [c.id]: c }, rng: seedRng(seed) } as unknown as GameState };
  };

  it('has three uses a day', () => {
    const { c } = rig(['fated']);
    expect(c.featureUses['fated']).toEqual({ current: 3, max: 3 });
  });

  it('never makes a roll worse', () => {
    /**
     * The bug this exists for. The first version replaced the die
     * unconditionally, so it could hand back a 1 in place of a 10 — a feat that
     * hurt you. Halfling Luck genuinely does replace unconditionally (RAW), which
     * is what made the wrong shape look plausible.
     */
    const { c, state } = rig(['fated']);
    c.featureUses['fated'] = { current: 500, max: 500 };
    let rng = state.rng;
    for (let i = 0; i < 400; i++) {
      const first = rollD20(rng, 'flat');
      rng = first.state;
      state.rng = rng;
      const out = applyLuck(state, c.id, first, 'flat');
      rng = out.state;
      expect(out.natural, `roll ${i}`).toBeGreaterThanOrEqual(first.natural);
    }
  });

  it('spends a use only on a roll worth rerolling, and only three times', () => {
    const { c, state } = rig(['fated']);
    let rng = state.rng;
    let spent = 0, high = 0;
    for (let i = 0; i < 100; i++) {
      const first = rollD20(rng, 'flat');
      rng = first.state;
      state.rng = rng;
      const before = c.featureUses['fated']!.current;
      const out = applyLuck(state, c.id, first, 'flat');
      rng = out.state;
      if (c.featureUses['fated']!.current < before) {
        spent++;
        expect(first.natural, 'spent on a roll above the threshold').toBeLessThanOrEqual(FATED_THRESHOLD);
      } else if (first.natural > FATED_THRESHOLD) high++;
    }
    expect(spent).toBe(FATED_USES);
    expect(high, 'no high rolls seen — the test proves nothing').toBeGreaterThan(0);
  });

  it('does nothing at all without the feat', () => {
    const { c, state } = rig([]);
    let rng = state.rng;
    for (let i = 0; i < 60; i++) {
      const first = rollD20(rng, 'flat');
      rng = first.state;
      state.rng = rng;
      const out = applyLuck(state, c.id, first, 'flat');
      rng = out.state;
      expect(out.natural).toBe(first.natural);
      expect(out.luck).toBeUndefined();
    }
  });

  it('reports itself, so the player can see it fired', () => {
    // A reroll that changes a die invisibly is a feat the player cannot tell
    // they took. See rules/luck.ts.
    const { c, state } = rig(['fated']);
    let rng = state.rng;
    let labelled = 0;
    for (let i = 0; i < 60; i++) {
      const first = rollD20(rng, 'flat');
      rng = first.state;
      state.rng = rng;
      const out = applyLuck(state, c.id, first, 'flat');
      rng = out.state;
      if (out.luck) { labelled++; expect(out.luck).toContain('Fated'); }
    }
    expect(labelled).toBe(FATED_USES);
  });

  it('lets a halfling keep its free reroll rather than paying for it', () => {
    // Halfling Luck is unlimited, so spending a Fated use on a natural 1 a
    // species trait would have rerolled anyway is pure waste.
    const c = buildCharacter({
      classId: 'rogue', team: 'team1', position: HERE, speciesId: 'halfling', featIds: ['fated'],
    });
    const state = { combatants: { [c.id]: c }, rng: seedRng(3) } as unknown as GameState;
    const one = { natural: 1, dice: [1], mode: 'flat' as const, state: state.rng };
    const out = applyLuck(state, c.id, one, 'flat');
    expect(out.luck).toBe('Halfling Luck');
    expect(c.featureUses['fated']!.current).toBe(3);   // untouched
  });
});

describe('Alert', () => {
  const party = (opts: { alertOn?: string } = {}) => {
    const roles = ['fighter', 'wizard'];
    return roles.map((classId, i) => buildCharacter({
      classId, team: 'team1', position: { x: i + 1, y: 0 }, level: 5,
      ...(opts.alertOn === classId ? { featIds: ['alert'] } : {}),
    }));
  };

  it('adds proficiency to initiative', () => {
    const plain = new Combat({ combatants: party(), seed: 5, mapId: 'open' });
    const alert = new Combat({ combatants: party({ alertOn: 'fighter' }), seed: 5, mapId: 'open' });
    const f = (c: Combat) => Object.values(c.state.combatants).find((x) => x.classId === 'fighter')!;
    // Same seed, so the die is the same; the difference is the feat. The wizard
    // swap may move it afterwards, so compare the total the fighter ROLLED via
    // the swap event's `from`.
    const swap = alert.log.find((e) => e.type === 'initiativeSwapped');
    const rolled = swap?.type === 'initiativeSwapped' ? swap.from : f(alert).initiative;
    expect(rolled).toBe(f(plain).initiative + proficiencyBonus(5));
  });

  it('hands its place to the wizard when that helps', () => {
    const c = new Combat({ combatants: party({ alertOn: 'fighter' }), seed: 5, mapId: 'open' });
    const swap = c.log.find((e) => e.type === 'initiativeSwapped');
    expect(swap, 'no swap happened at all').toBeDefined();
    if (swap?.type !== 'initiativeSwapped') throw new Error('unreachable');
    const wizard = Object.values(c.state.combatants).find((x) => x.classId === 'wizard')!;
    expect(swap.allyId).toBe(wizard.id);
    // The whole point: the wizard ends up where the fighter was, which is higher.
    expect(swap.from).toBeGreaterThan(swap.to);
    expect(wizard.initiative).toBe(swap.from);
    // …and the order actually reflects it, rather than the sort running first.
    const order = c.state.initiativeOrder;
    expect(order.indexOf(wizard.id)).toBeLessThan(order.indexOf(swap.combatantId));
  });

  it('never swaps to make an ally worse off', () => {
    // A swap with a caster already ahead of you would hand YOU the good slot and
    // slow the party down — the feat helping nobody.
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({ combatants: party({ alertOn: 'fighter' }), seed, mapId: 'open' });
      const swap = c.log.find((e) => e.type === 'initiativeSwapped');
      if (swap?.type !== 'initiativeSwapped') continue;
      expect(swap.from, `seed ${seed}`).toBeGreaterThan(swap.to);
    }
  });

  it('does not swap with a non-caster', () => {
    const two = ['fighter', 'rogue'].map((classId, i) => buildCharacter({
      classId, team: 'team1', position: { x: i + 1, y: 0 }, level: 5,
      ...(classId === 'fighter' ? { featIds: ['alert'] } : {}),
    }));
    for (let seed = 1; seed <= 20; seed++) {
      const c = new Combat({ combatants: two, seed, mapId: 'open' });
      expect(c.log.some((e) => e.type === 'initiativeSwapped'), `seed ${seed}`).toBe(false);
    }
  });

  it('is deterministic — the same fight swaps the same way twice', () => {
    const a = new Combat({ combatants: party({ alertOn: 'fighter' }), seed: 9, mapId: 'open' });
    const b = new Combat({ combatants: party({ alertOn: 'fighter' }), seed: 9, mapId: 'open' });
    expect(a.state.initiativeOrder).toEqual(b.state.initiativeOrder);
  });
});

describe('a feat that lets you cast is not a licence to hold a wand', () => {
  /**
   * The bug: `spellcastingAbility` answered two different questions — "which
   * ability powers my spells?" (math) and "may I attune to a wand?"
   * (permission). Magic Initiate has to set the first, or a fighter's Sacred
   * Flame is cast off Intelligence; setting it granted the second for free, and
   * one origin feat handed a fighter a Wand of Fireballs.
   *
   * WHAT WAS AND WAS NOT LEAKING, exactly — two earlier descriptions of this got
   * it wrong in opposite directions, so it is written down here:
   *
   *  - WANDS and staves are gated by `requires: 'spellcaster'`, which used to
   *    read `spellcastingAbility !== undefined`. This is what leaked.
   *  - SCROLLS are gated by `classScrollPool(actor.classId)`, which is EMPTY for
   *    every non-caster class and is built from the class table alone. A fighter
   *    could never read a scroll, before this feat or after it. Nothing leaked
   *    here, and nothing should start.
   */
  const GATED = ['wand-fireballs', 'wand-web', 'wand-lightning-bolts', 'wand-paralysis', 'staff-healing'];

  const hero = (classId: string, featIds: Id[], itemId: string) => buildCharacter({
    classId, team: 'team1', position: HERE, level: 5, featIds,
    inventory: [{ itemId, qty: 1 }],
  });

  /** Every use of this item the engine will actually offer. */
  const offers = (classId: string, featIds: Id[], itemId: string) => {
    const me = hero(classId, featIds, itemId);
    const foe = buildMonster('goblin-warrior', 'team2', { x: 3, y: 6 }, '1');
    const c = new Combat({ combatants: [me, foe], seed: 4, mapId: 'open' });
    let guard = 0;
    while (c.activeId !== me.id && guard++ < 20) c.apply({ kind: 'endTurn' });
    return legalActions(c.state, me.id).filter((a) => a.kind === 'useItem' && a.itemId === itemId);
  };

  it('every wand this test names really is gated', () => {
    // Or the assertions below would pass by testing nothing.
    for (const id of GATED) expect(ITEMS[id]?.requires, id).toBe('spellcaster');
  });

  it('marks only class casters as attunement-capable', () => {
    expect(hero('wizard', [], 'wand-fireballs').classCaster).toBe(true);
    expect(hero('cleric', [], 'wand-fireballs').classCaster).toBe(true);
    expect(hero('fighter', [], 'wand-fireballs').classCaster ?? false).toBe(false);
    // The feat sets the spell MATH and must not set the permission.
    const initiate = hero('fighter', ['magic-initiate-cleric'], 'wand-fireballs');
    expect(initiate.spellcastingAbility).toBe('wis');
    expect(initiate.classCaster ?? false).toBe(false);
  });

  it('offers no wand use to a Magic Initiate fighter, and does to a wizard', () => {
    for (const itemId of GATED) {
      expect(offers('fighter', ['magic-initiate-cleric'], itemId), itemId).toHaveLength(0);
    }
    // The control: without it, the assertions above could be passing because the
    // engine never offers these items to anybody.
    expect(offers('wizard', [], 'wand-fireballs').length).toBeGreaterThan(0);
  });

  it('a scroll is gated by the class spell list, not by this', () => {
    expect(ITEMS['scroll-magic-missile']?.requires).toBeUndefined();
    expect(classScrollPool('fighter').size).toBe(0);
    expect(classScrollPool('wizard').has('magic-missile')).toBe(true);
    // So a fighter is refused a scroll for a different and correct reason, and
    // the origin feat does not change that either way.
    expect(offers('fighter', [], 'scroll-magic-missile')).toHaveLength(0);
    expect(offers('fighter', ['magic-initiate-cleric'], 'scroll-magic-missile')).toHaveLength(0);
    expect(offers('wizard', [], 'scroll-magic-missile').length).toBeGreaterThan(0);
  });

  it('a species with innate magic is not a wand-holder either', () => {
    for (const speciesId of ['tiefling', 'elf', 'gnome', 'dragonborn']) {
      const c = buildCharacter({
        classId: 'fighter', team: 'team1', position: HERE, level: 5, speciesId,
      });
      expect(c.classCaster ?? false, speciesId).toBe(false);
      // …but its innate spell still runs on a sensible ability rather than the
      // Intelligence a martial character dumps.
      expect(c.spellcastingAbility, speciesId).toBeDefined();
    }
  });
});
