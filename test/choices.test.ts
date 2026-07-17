import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import {
  newCampaign, setPartyClass, setPartyChoice, setPartySpecies, buildCampaignParty,
  PARTY_TEMPLATES, applyPartyTemplate, randomizeParty, defaultPortraitFor,
} from '../src/campaign/campaign.js';
import { SPECIES } from '../src/data/species.js';

const SPECIES_IDS = Object.keys(SPECIES);

describe('build-choice points', () => {
  it('a fighter with no choice specified resolves to the default Fighting Style (Dueling)', () => {
    const f = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } });
    expect(f.featureIds).toContain('dueling');
    expect(f.featureIds).not.toContain('archery');
  });

  it('a chosen Fighting Style grants that feature and drops the default', () => {
    const f = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 },
      choices: { 'fighting-style': 'archery' },
    });
    expect(f.featureIds).toContain('archery');
    expect(f.featureIds).not.toContain('dueling');
  });

  it('an unknown choice id falls back to the default rather than granting nothing', () => {
    const f = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 },
      choices: { 'fighting-style': 'nonsense' },
    });
    expect(f.featureIds).toContain('dueling');
  });

  it('a legacy party character with no choices field still builds (defaults apply)', () => {
    const c = newCampaign(7);
    // Simulate an old save: strip any choices that might be present.
    for (const ch of c.characters) delete ch.choices;
    const party = buildCampaignParty(c);
    const fighter = party.find((p) => p.classId === 'fighter')!;
    expect(fighter.featureIds).toContain('dueling');
  });

  it('setPartyChoice flows through to the built combatant', () => {
    const c = newCampaign(7);
    const fi = c.characters.findIndex((ch) => ch.classId === 'fighter');
    expect(setPartyChoice(c, fi, 'fighting-style', 'defense')).toBe(true);
    const party = buildCampaignParty(c);
    const fighter = party.find((p) => p.classId === 'fighter')!;
    expect(fighter.featureIds).toContain('defense');
    expect(fighter.featureIds).not.toContain('dueling');
  });

  it('a prebuilt party template overlays species and styles without breaking the four roles', () => {
    const c = newCampaign(7);
    expect(applyPartyTemplate(c, 'frontier')).toBe(true);
    // Still exactly one of each class.
    const classes = c.characters.map((ch) => ch.classId).sort();
    expect(classes).toEqual(['cleric', 'fighter', 'rogue', 'wizard']);
    const fighter = c.characters.find((ch) => ch.classId === 'fighter')!;
    expect(fighter.speciesId).toBe('dwarf');
    // The style resolves onto the built combatant.
    const built = buildCampaignParty(c).find((p) => p.classId === 'fighter')!;
    expect(built.featureIds).toContain('defense');
  });

  it('applying a template with no style for a slot clears any prior style', () => {
    const c = newCampaign(7);
    const fi = c.characters.findIndex((ch) => ch.classId === 'fighter');
    setPartyChoice(c, fi, 'fighting-style', 'archery');
    applyPartyTemplate(c, 'bloodline'); // fighter style is dueling here
    const built = buildCampaignParty(c).find((p) => p.classId === 'fighter')!;
    expect(built.featureIds).toContain('dueling');
    expect(built.featureIds).not.toContain('archery');
  });

  it('randomizeParty gives every member a real species and is deterministic per seed', () => {
    const a = newCampaign(42); randomizeParty(a);
    const b = newCampaign(42); randomizeParty(b);
    const speciesA = a.characters.map((ch) => ch.speciesId);
    expect(speciesA).toEqual(b.characters.map((ch) => ch.speciesId)); // same seed → same roll
    for (const ch of a.characters) expect(SPECIES_IDS).toContain(ch.speciesId);
  });

  it('template functions refuse to run once the party is locked in', () => {
    const c = newCampaign(7);
    c.partyReady = true;
    expect(applyPartyTemplate(c, 'frontier')).toBe(false);
    expect(randomizeParty(c)).toBe(false);
  });

  it('default party portraits are the class images (all human)', () => {
    const c = newCampaign(1);
    for (const ch of c.characters) expect(ch.portraitId).toBe(ch.classId);
  });

  it('a template gives each member their species portrait', () => {
    const c = newCampaign(1);
    applyPartyTemplate(c, 'frontier');
    const fighter = c.characters.find((ch) => ch.classId === 'fighter')!; // dwarf
    const rogue = c.characters.find((ch) => ch.classId === 'rogue')!;     // halfling
    const cleric = c.characters.find((ch) => ch.classId === 'cleric')!;   // human
    expect(fighter.portraitId).toBe('dwarf-berserker');
    expect(rogue.portraitId).toBe('halfling-rogue');
    expect(cleric.portraitId).toBe('cleric'); // human → class image
  });

  it('randomizeParty gives each member a portrait matching its rolled species', () => {
    const c = newCampaign(3);
    randomizeParty(c);
    for (const ch of c.characters) {
      expect(ch.portraitId).toBe(defaultPortraitFor(ch.speciesId, ch.classId));
    }
  });

  it('changing species updates an un-customized portrait but leaves a hand-picked one', () => {
    const c = newCampaign(1);
    const fi = c.characters.findIndex((ch) => ch.classId === 'fighter');
    // Default (human) → class portrait; switching to orc follows the species.
    setPartySpecies(c, fi, 'orc');
    expect(c.characters[fi]!.portraitId).toBe('orc-barbarian');
    // Hand-pick a portrait, then change species: the pick sticks.
    c.characters[fi]!.portraitId = 'gnome-bard';
    setPartySpecies(c, fi, 'elf');
    expect(c.characters[fi]!.portraitId).toBe('gnome-bard');
  });

  it('every template covers all four class roles', () => {
    for (const t of PARTY_TEMPLATES) {
      expect(Object.keys(t.members).sort()).toEqual(['cleric', 'fighter', 'rogue', 'wizard']);
    }
  });

  it('swapping a slot to a new class clears its old choices', () => {
    const c = newCampaign(7);
    const fi = c.characters.findIndex((ch) => ch.classId === 'fighter');
    const wi = c.characters.findIndex((ch) => ch.classId === 'wizard');
    setPartyChoice(c, fi, 'fighting-style', 'archery');
    // Swap the fighter slot to wizard (role-swap with the existing wizard slot).
    setPartyClass(c, fi, 'wizard');
    expect(c.characters[fi]!.choices).toBeUndefined();
    // The wizard that moved into the old fighter's role must not inherit a style.
    const party = buildCampaignParty(c);
    const anyArchery = party.some((p) => p.featureIds.includes('archery'));
    expect(anyArchery).toBe(false);
    expect(wi).toBeGreaterThanOrEqual(0);
  });
});
