import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import {
  newCampaign, setPartyClass, setPartyChoice, setPartySpecies, buildCampaignParty,
  PARTY_TEMPLATES, applyPartyTemplate, randomizeParty, defaultPortraitFor, rerollPartyName,
} from '../src/campaign/campaign.js';
import { SPECIES } from '../src/data/species.js';
import { CLASSES } from '../src/data/classes.js';
import { randomNameFor } from '../src/builder/names.js';
import { seedRng } from '../src/engine/rng.js';

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

  // Portraits now de-duplicate: two elves don't both wear the elf archer, since
  // that reads as a copy-paste bug on the party strip. So a member gets either
  // its species default or — if another member already took it — its class art.
  it('randomizeParty gives each member species-appropriate art, and no two the same', () => {
    const c = newCampaign(3);
    randomizeParty(c);
    for (const ch of c.characters) {
      const preferred = defaultPortraitFor(ch.speciesId, ch.classId);
      const classArt = ch.classId;
      expect([preferred, classArt]).toContain(ch.portraitId);
    }
    const used = c.characters.map((ch) => ch.portraitId);
    expect(new Set(used).size, `duplicate portraits: ${used.join(', ')}`).toBe(used.length);
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

  // Templates now carry their own classes, so they can field a paladin or a
  // ranger — the point being that the shelf shows parties you can't reach by
  // only editing species.
  it('every template fields four real, distinct classes', () => {
    for (const t of PARTY_TEMPLATES) {
      expect(t.members, `${t.id} roster size`).toHaveLength(4);
      for (const m of t.members) {
        expect(CLASSES[m.classId], `${t.id}: unknown class ${m.classId}`).toBeDefined();
        expect(SPECIES[m.speciesId], `${t.id}: unknown species ${m.speciesId}`).toBeDefined();
      }
      const classes = t.members.map((m) => m.classId);
      expect(new Set(classes).size, `${t.id} repeats a class`).toBe(4);
    }
  });

  it('the shelf offers classes the default four roles never show', () => {
    const offered = new Set(PARTY_TEMPLATES.flatMap((t) => t.members.map((m) => m.classId)));
    expect(offered).toContain('paladin');
    expect(offered).toContain('ranger');
  });

  it('a template replaces classes, not just species', () => {
    const c = newCampaign(21);
    expect(c.characters.map((ch) => ch.classId)).toEqual(['fighter', 'wizard', 'cleric', 'rogue']);
    applyPartyTemplate(c, 'wardens');
    expect(c.characters.map((ch) => ch.classId)).toEqual(['paladin', 'ranger', 'cleric', 'rogue']);
    // …and re-kits them: a paladin must not be holding the fighter's loadout.
    expect(c.characters[0]!.equipped.mainHand).toBe(CLASSES['paladin']!.equipment.mainHand);
    expect(c.characters[0]!.backgroundId).toBe('acolyte');
  });

  it('template names are rolled, so the same template twice gives different people', () => {
    const a = newCampaign(31); applyPartyTemplate(a, 'frontier');
    const b = newCampaign(99); applyPartyTemplate(b, 'frontier');
    expect(a.characters.map((ch) => ch.name)).not.toEqual(b.characters.map((ch) => ch.name));
    // …but a given seed still rebuilds exactly, like everything else here.
    const again = newCampaign(31); applyPartyTemplate(again, 'frontier');
    expect(again.characters.map((ch) => ch.name)).toEqual(a.characters.map((ch) => ch.name));
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

/**
 * Names are curated per species rather than generated, because syllable-mashers
 * produce a lot of "Vrelnag" — pronounceable in theory, unreadable in a text box
 * a nine-year-old is scanning mid-fight.
 */
describe('random names', () => {
  it('every species has a pool, and every roll is non-empty', () => {
    for (const speciesId of Object.keys(SPECIES)) {
      let rng = seedRng(4);
      for (let i = 0; i < 20; i++) {
        const r = randomNameFor(speciesId, rng);
        rng = r.state;
        expect(r.value.trim().length, `${speciesId} rolled an empty name`).toBeGreaterThan(0);
        expect(r.value).not.toContain('undefined');
      }
    }
  });

  it('draws from the species own pool — a dwarf never gets an elf name', () => {
    let rng = seedRng(9);
    const dwarves = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = randomNameFor('dwarf', rng); rng = r.state;
      dwarves.add(r.value.split(' ')[0]!);
    }
    let rng2 = seedRng(9);
    const elves = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = randomNameFor('elf', rng2); rng2 = r.state;
      elves.add(r.value.split(' ')[0]!);
    }
    for (const d of dwarves) expect(elves.has(d), `${d} appears in both pools`).toBe(false);
  });

  it('is deterministic on the rng, and varies across seeds', () => {
    expect(randomNameFor('elf', seedRng(5)).value).toBe(randomNameFor('elf', seedRng(5)).value);
    const many = new Set<string>();
    let rng = seedRng(1);
    for (let i = 0; i < 40; i++) { const r = randomNameFor('human', rng); rng = r.state; many.add(r.value); }
    expect(many.size, 'the generator should not keep returning one name').toBeGreaterThan(10);
  });

  it('rerollPartyName gives that member a new name and advances the rng', () => {
    const c = newCampaign(17);
    const before = c.characters[0]!.name;
    const rngBefore = c.rng;
    expect(rerollPartyName(c, 0)).toBe(true);
    expect(c.rng).not.toBe(rngBefore);
    // Same pool could in principle repeat, so assert over several rolls.
    const seen = new Set([before, c.characters[0]!.name]);
    for (let i = 0; i < 8; i++) { rerollPartyName(c, 0); seen.add(c.characters[0]!.name); }
    expect(seen.size).toBeGreaterThan(1);
  });
});
