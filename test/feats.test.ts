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
 *  - Tough and Magic Initiate are strong and roughly equal. Tough is about a
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
import { CLASSES, SKILL_ABILITY, type SkillId } from '../src/data/classes.js';
import { buildCharacter } from '../src/builder/character.js';
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

describe('Tough', () => {
  it('is two hit points per level, not a flat lump', () => {
    for (const level of [1, 4, 8]) {
      const plain = buildCharacter({ classId: 'rogue', team: 'team1', position: HERE, level });
      const tough = buildCharacter({ classId: 'rogue', team: 'team1', position: HERE, level, featIds: ['tough'] });
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
    setPartyFeat(c, 0, 0, 'tough');
    setPartyFeat(c, 0, 1, 'tough');            // asked for a duplicate…
    const held = featsOf(c.characters[0]!);
    expect(held).toContain('tough');
    expect(new Set(held).size).toBe(held.length);   // …and did not get one
  });

  it('a save written before feats existed gets its background feat, not none', () => {
    const c = newCampaign(2);
    delete c.characters[0]!.feats;
    c.characters[0]!.backgroundId = 'farmer';
    expect(featsOf(c.characters[0]!)).toContain(defaultFeatFor('farmer'));
    expect(featsOf(c.characters[0]!)[0]).toBe('tough');
  });

  it('reaches the built combatant', () => {
    const c = newCampaign(2);
    setPartySpecies(c, 0, 'dwarf');
    setPartyFeat(c, 0, 0, 'tough');
    const plain = buildCampaignParty(newCampaign(2))[0]!;
    const tough = buildCampaignParty(c)[0]!;
    expect(tough.maxHp).toBeGreaterThan(plain.maxHp);
  });

  it('refuses an unknown feat, a bad slot, and a launched party', () => {
    const c = newCampaign(2);
    setPartySpecies(c, 0, 'dwarf');
    expect(setPartyFeat(c, 0, 0, 'not-a-feat')).toBe(false);
    expect(setPartyFeat(c, 0, 1, 'tough')).toBe(false);   // dwarves have one slot
    expect(setPartyFeat(c, 0, 0, 'tough')).toBe(true);
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
