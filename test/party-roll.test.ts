/**
 * The party a new player is handed, and the party the dice hand them.
 *
 * Both came out of playtesting. The default four were all human, which shows a
 * new player nothing — every species trait in the game invisible on the screen
 * they meet first. And there were two random buttons, one of which promised
 * nothing and could deal four wizards; the arena will cheerfully build a fight
 * that needs somebody to stand in front of them, and a run lost to the roster
 * is one a player cannot diagnose.
 */
import { describe, it, expect } from 'vitest';
import {
  newCampaign, randomizeParty, PARTY_TEMPLATES, applyPartyTemplate,
  setPartyClass, buildCampaignParty, preparableSpells, type CampaignState,
} from '../src/campaign/campaign.js';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { SPECIES } from '../src/data/species.js';
import { rolesOf, missingRoles, REQUIRED_ROLES, HEALING_SPELLS } from '../src/campaign/roles.js';

/** A campaign whose first hero is a bard at the given level. */
function bardAt(level: number): CampaignState {
  const c = newCampaign(3);
  setPartyClass(c, 0, 'bard');
  c.xp = 0;
  while (buildCampaignParty(c)[0]!.level < level) c.xp += 500;
  return c;
}
const preparableIds = (c: CampaignState): string[] => preparableSpells(c, 0);

describe('the starting party', () => {
  it('is four different kin', () => {
    const c = newCampaign(1);
    expect(new Set(c.characters.map((ch) => ch.speciesId)).size).toBe(4);
    expect(c.characters.map((ch) => ch.speciesId)).toEqual(['human', 'dwarf', 'elf', 'halfling']);
  });

  it('still covers every role, which is the part that must not regress', () => {
    // Varying the kin is cosmetic; the classes are the promise. If a future
    // edit swapped the cleric out for flavour, this is what would object.
    expect(missingRoles(newCampaign(1).characters.map((ch) => ch.classId))).toEqual([]);
  });
});

describe('rolling a random party', () => {
  it('always deals a party that covers every role', () => {
    // THE guarantee. Run enough seeds that a bad hand would show up: the old
    // roller dealt four wizards roughly one run in a few hundred, and once is
    // enough to lose somebody.
    const bad: string[][] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const c = newCampaign(seed);
      randomizeParty(c);
      const classIds = c.characters.map((ch) => ch.classId);
      if (missingRoles(classIds).length > 0) bad.push(classIds);
    }
    expect(bad.slice(0, 3), 'parties with a hole in them').toEqual([]);
  });

  it('randomises kin freely — the guard is on classes, not species', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const c = newCampaign(seed);
      randomizeParty(c);
      for (const ch of c.characters) seen.add(ch.speciesId);
    }
    // Every species should turn up across sixty rolls; a guard that quietly
    // narrowed the pool would show here.
    expect(seen.size, 'the roller narrowed the species pool').toBe(Object.keys(SPECIES).length);
  });

  it('still deals varied classes rather than one safe party every time', () => {
    // A guard that always produced fighter/cleric/wizard/rogue would pass the
    // coverage test and defeat the point of the button.
    const hands = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const c = newCampaign(seed);
      randomizeParty(c);
      hands.add(c.characters.map((ch) => ch.classId).sort().join(','));
    }
    expect(hands.size, 'the roller settled into one hand').toBeGreaterThan(10);
  });

  it('is deterministic for a seed', () => {
    const a = newCampaign(42); randomizeParty(a);
    const b = newCampaign(42); randomizeParty(b);
    expect(a.characters.map((ch) => `${ch.speciesId}/${ch.classId}`))
      .toEqual(b.characters.map((ch) => `${ch.speciesId}/${ch.classId}`));
  });
});

describe('what a class brings', () => {
  it('derives roles for every class in the game', () => {
    // The point of deriving rather than listing: the warlock and the sorcerer
    // are covered the day they land. A class that covers nothing would be a
    // class the roller can never justify picking.
    for (const id of Object.keys(CLASSES)) {
      expect(rolesOf(id).size, `${id} covers no role at all`).toBeGreaterThan(0);
    }
  });

  it('names only real spells in the one hand-kept list', () => {
    // HEALING_SPELLS is the single thing here that cannot be derived — healing
    // lives inside a spell's `cast`, not in its data. So it gets the treatment
    // every hand-kept list in this codebase gets.
    for (const id of HEALING_SPELLS) expect(SPELLS[id], id).toBeDefined();
    const healers = Object.keys(CLASSES).filter((id) => rolesOf(id).has('healing'));
    expect(healers.length, 'no class heals, so the guard can never be satisfied').toBeGreaterThan(2);
  });

  it('has at least one class covering each required role', () => {
    for (const role of REQUIRED_ROLES) {
      const who = Object.keys(CLASSES).filter((id) => rolesOf(id).has(role));
      expect(who.length, `nothing covers ${role}`).toBeGreaterThan(0);
    }
  });

  it('leaves the hand-made templates alone', () => {
    // They are authored, not rolled, and a template that failed coverage would
    // be a deliberate choice — but none of them should, so this is a spot check
    // on the authored content rather than a rule imposed on it.
    for (const t of PARTY_TEMPLATES) {
      const c = newCampaign(1);
      applyPartyTemplate(c, t.id);
      expect(missingRoles(c.characters.map((ch) => ch.classId)), `${t.name} has a hole`).toEqual([]);
    }
  });
});

/**
 * The bard's level 6, which playtesting reported as "the bard falls off".
 *
 * It did: the class had no level-6 feature at all, and in a game that stops at
 * 7 that is a whole tier missing. The SRD's College of Lore gets Magical
 * Discoveries — two spells from off the bard's list.
 *
 * Deliberately no new machinery. `spellsByLevel` is already a table of "what
 * this class can have, and when", so two off-list spells written at level 6 are
 * exactly that, and the existing spell tray offers them like anything else.
 */
describe("the bard's Magical Discoveries", () => {
  it('arrives at 6, not before', () => {
    const five = bardAt(5);
    const six = bardAt(6);
    expect(preparableIds(five)).not.toContain('fireball');
    expect(preparableIds(six)).toContain('fireball');
    expect(preparableIds(six)).toContain('spiritual-weapon');
    expect(buildCampaignParty(six)[0]!.featureIds).toContain('magical-discoveries');
    expect(buildCampaignParty(five)[0]!.featureIds).not.toContain('magical-discoveries');
  });

  it('picks two spells the bard could not otherwise do', () => {
    // The choice is the point: a bonus-action damage engine that needs no
    // concentration, and the one spell that clears a crowd. Both are off the
    // bard list, which is what the feature is FOR — and what the SRD spell-list
    // test needs a declared reason for.
    expect(SPELLS['spiritual-weapon']!.castingTime).toBe('bonus');
    expect(SPELLS['spiritual-weapon']!.level).toBe(2);
    expect(SPELLS['fireball']!.level).toBe(3);
    // A 3rd-level spell needs a 3rd-level slot, which a bard has from 5.
    expect(buildCampaignParty(bardAt(6))[0]!.spellSlots[2]?.max ?? 0).toBeGreaterThan(0);
  });
});
