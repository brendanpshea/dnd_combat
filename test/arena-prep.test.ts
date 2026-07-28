/**
 * Pre-fight buffs, and the cases where offering one would waste it.
 *
 * The machinery already existed and was invisible: `PartyScreen` has had
 * "Drink now" and out-of-combat casting since the adventure store folded into
 * it, and the durations were already right — an hour-long potion clears at
 * lunch and covers the fight you drank it for, Mage Armor's eight hours survive
 * lunch and die at the night. What was missing was anywhere to see it while the
 * door you are about to walk through is on screen.
 *
 * Most of these are about NOT offering something: a list that includes options
 * which do nothing is worse than no list, because acting on one costs a potion.
 */
import { describe, it, expect } from 'vitest';
import { prepOptions, potionOptions, spellOptions } from '../src/arena/prep.js';
import {
  newCampaign, addItem, setPrepared, drinkCampBuffPotion, useStoreSpell,
  buildCampaignParty, shortRest, longRest,
} from '../src/campaign/campaign.js';
import { acOf } from '../src/data/armor.js';
import type { CampaignState } from '../src/campaign/campaign.js';

function party(): CampaignState {
  const c = newCampaign(11);
  c.partyReady = true;
  return c;
}
const idxOf = (c: CampaignState, classId: string) =>
  c.characters.findIndex((ch) => ch.classId === classId);
const readyWizard = (c: CampaignState) => {
  const w = idxOf(c, 'wizard');
  setPrepared(c, w, ['magic-missile', 'mage-armor', 'sleep', 'shield']);
  return w;
};

describe('what the gate offers', () => {
  it('offers nothing to a party with no potions and nothing to cast', () => {
    // The common case. A row that appears every fight with nothing in it is
    // the same noise problem as the morning review.
    expect(prepOptions(party())).toEqual([]);
  });

  it('offers a buff potion sitting in a pack', () => {
    const c = party();
    const f = idxOf(c, 'fighter');
    addItem(c.characters[f]!.inventory, 'potion-fire-resistance');
    const opts = potionOptions(c);
    expect(opts).toHaveLength(1);
    expect(opts[0]!.detail).toContain('Fire Resistance');
    expect(opts[0]!.detail, 'the duration is the decision').toContain('this fight');
  });

  it('stops offering a resistance already in effect', () => {
    // Drinking a second one consumes the potion and sets a flag that is set.
    const c = party();
    const f = idxOf(c, 'fighter');
    addItem(c.characters[f]!.inventory, 'potion-fire-resistance', 2);
    expect(potionOptions(c)).toHaveLength(1);
    drinkCampBuffPotion(c, f, 'potion-fire-resistance');
    expect(potionOptions(c)).toEqual([]);
  });

  it('still offers a DIFFERENT resistance', () => {
    const c = party();
    const f = idxOf(c, 'fighter');
    addItem(c.characters[f]!.inventory, 'potion-fire-resistance');
    addItem(c.characters[f]!.inventory, 'potion-cold-resistance');
    drinkCampBuffPotion(c, f, 'potion-fire-resistance');
    expect(potionOptions(c).map((o) => o.id)).toEqual(['potion-cold-resistance']);
  });

  it('stops offering giant strength once a potion is already working', () => {
    const c = party();
    const f = idxOf(c, 'fighter');
    addItem(c.characters[f]!.inventory, 'potion-giant-strength-hill', 2);
    expect(potionOptions(c)).toHaveLength(1);
    drinkCampBuffPotion(c, f, 'potion-giant-strength-hill');
    expect(potionOptions(c)).toEqual([]);
  });
});

describe('Mage Armor, which is the whole reason for this', () => {
  it('is offered to a prepared wizard in a robe', () => {
    const c = party();
    readyWizard(c);
    expect(spellOptions(c)).toHaveLength(1);
    expect(spellOptions(c)[0]!.detail).toContain('all day');
  });

  it('is not offered when it was never prepared', () => {
    // The default wizard prepares the first four of six, and Mage Armor is
    // fifth — which is why almost nobody ever saw this option exist.
    expect(spellOptions(party())).toEqual([]);
  });

  it('is not offered to somebody already wearing armour', () => {
    // `acOf` ignores the spell when armour is worn, so the button would spend a
    // slot for nothing.
    //
    // The armour is put on directly rather than through `equipItem`, which
    // refuses: a wizard has no armour proficiency, so there is no legal way for
    // one to be wearing any today. The guard is for the case that is not about
    // wizards — a species trait or a class that gets both — and reading the
    // field the guard reads is the only way to test it.
    const c = party();
    const w = readyWizard(c);
    c.characters[w]!.equipped = { ...c.characters[w]!.equipped, armor: 'leather' };
    expect(spellOptions(c)).toEqual([]);
  });

  it('is not offered twice', () => {
    const c = party();
    const w = readyWizard(c);
    expect(spellOptions(c)).toHaveLength(1);
    useStoreSpell(c, w, 'mage-armor');
    expect(spellOptions(c)).toEqual([]);
  });

  it('is not offered with no slot left to spend', () => {
    const c = party();
    const w = readyWizard(c);
    const caster = buildCampaignParty(c)[w]!;
    c.characters[w]!.resources = {
      hp: caster.hp, slots: caster.spellSlots.map(() => 0),
    };
    expect(spellOptions(c)).toEqual([]);
  });
});

describe('how long a buff lasts, which is what makes it a decision', () => {
  it('a potion covers the fight it was drunk for and no more', () => {
    const c = party();
    const f = idxOf(c, 'fighter');
    addItem(c.characters[f]!.inventory, 'potion-giant-strength-hill');
    drinkCampBuffPotion(c, f, 'potion-giant-strength-hill');
    expect(buildCampaignParty(c)[f]!.abilities.str).toBe(21);
    shortRest(c);                                   // the arena's lunch
    expect(buildCampaignParty(c)[f]!.abilities.str).toBeLessThan(21);
  });

  it('Mage Armor survives lunch and dies at the night', () => {
    // Eight hours against one. This is what makes it worth a prepared slot —
    // one cast covers both of the day's fights.
    const c = party();
    const w = readyWizard(c);
    const bare = acOf(buildCampaignParty(c)[w]!);
    useStoreSpell(c, w, 'mage-armor');
    const warded = acOf(buildCampaignParty(c)[w]!);
    expect(warded).toBeGreaterThan(bare);
    shortRest(c);
    expect(acOf(buildCampaignParty(c)[w]!), 'still up after lunch').toBe(warded);
    longRest(c);
    expect(acOf(buildCampaignParty(c)[w]!), 'gone after the night').toBe(bare);
  });
});
