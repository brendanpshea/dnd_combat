/**
 * Every spell a class grants must be on that class's SRD 5.2 spell list.
 *
 * This exists because three weren't. Misty Step was on the ranger (it is a
 * wizard spell, and has never been on the ranger's list in any edition), and
 * Thunderous Smite and Wrathful Smite were on the paladin (2014 spells that
 * the 2024 SRD does not carry). All three were authored from memory, all three
 * looked completely plausible, and nothing in the codebase could tell.
 *
 * The lists below are transcribed from the SRD 5.2 class entries, not recalled.
 * They are deliberately the *whole* list rather than only what is implemented,
 * so adding a spell to a class is checked against the real thing rather than
 * against a subset someone previously chose. Levels 1-4: a full caster reaches a
 * 4th-level slot at 7th, so that tier is pinned too. The 4th-level lists were
 * fetched from the SRD class entries the same way the rest were.
 *
 * If a future SRD revision moves a spell, fix the list here — do not delete the
 * assertion.
 */
import { describe, it, expect } from 'vitest';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';

/** SRD 5.2 class spell lists, cantrips through 3rd level, as spell ids. */
const SRD: Record<string, string[]> = {
  cleric: [
    // Cantrips
    'guidance', 'light', 'mending', 'resistance', 'sacred-flame', 'spare-the-dying', 'thaumaturgy',
    // 1st
    'bane', 'bless', 'command', 'create-or-destroy-water', 'cure-wounds', 'detect-evil-and-good',
    'detect-magic', 'detect-poison-and-disease', 'guiding-bolt', 'healing-word', 'inflict-wounds',
    'protection-from-evil-and-good', 'purify-food-and-drink', 'sanctuary', 'shield-of-faith',
    // 2nd
    'aid', 'augury', 'blindness', 'calm-emotions', 'continual-flame', 'enhance-ability', 'find-traps',
    'gentle-repose', 'hold-person', 'lesser-restoration', 'locate-object', 'prayer-of-healing',
    'protection-from-poison', 'silence', 'spiritual-weapon', 'warding-bond', 'zone-of-truth',
    // 3rd
    'animate-dead', 'beacon-of-hope', 'bestow-curse', 'clairvoyance', 'create-food-and-water',
    'daylight', 'dispel-magic', 'glyph-of-warding', 'magic-circle', 'mass-healing-word',
    'meld-into-stone', 'protection-from-energy', 'remove-curse', 'revivify', 'sending',
    'speak-with-dead', 'spiritual-guardians', 'tongues', 'water-walk',
    // 4th
    'aura-of-life', 'banishment', 'control-water', 'death-ward', 'divination',
    'freedom-of-movement', 'guardian-of-faith', 'locate-creature', 'stone-shape',
  ],
  wizard: [
    // Cantrips
    'acid-splash', 'chill-touch', 'dancing-lights', 'elementalism', 'fire-bolt', 'light', 'mage-hand',
    'mending', 'message', 'minor-illusion', 'poison-spray', 'prestidigitation', 'ray-of-frost',
    'shocking-grasp', 'true-strike',
    // 1st
    'alarm', 'burning-hands', 'charm-person', 'chromatic-orb', 'color-spray', 'comprehend-languages',
    'detect-magic', 'disguise-self', 'expeditious-retreat', 'false-life', 'feather-fall',
    'find-familiar', 'floating-disk', 'fog-cloud', 'grease', 'hideous-laughter', 'ice-knife',
    'identify', 'illusory-script', 'jump', 'longstrider', 'mage-armor', 'magic-missile',
    'protection-from-evil-and-good', 'ray-of-sickness', 'shield', 'silent-image', 'sleep',
    'thunderwave', 'unseen-servant',
    // 2nd
    'acid-arrow', 'alter-self', 'arcane-lock', 'arcanists-magic-aura', 'augury', 'blindness', 'blur',
    'continual-flame', 'darkness', 'darkvision', 'detect-thoughts', 'dragons-breath', 'enhance-ability',
    'enlarge-reduce', 'flaming-sphere', 'gentle-repose', 'gust-of-wind', 'hold-person', 'invisibility',
    'knock', 'levitate', 'locate-object', 'magic-mouth', 'magic-weapon', 'mind-spike', 'mirror-image',
    'misty-step', 'ray-of-enfeeblement', 'rope-trick', 'scorching-ray', 'see-invisibility', 'shatter',
    'spider-climb', 'suggestion', 'web',
    // 3rd
    'animate-dead', 'bestow-curse', 'blink', 'clairvoyance', 'counterspell', 'dispel-magic', 'fear',
    'fireball', 'fly', 'gaseous-form', 'glyph-of-warding', 'haste', 'hypnotic-pattern',
    'lightning-bolt', 'magic-circle', 'major-image', 'nondetection', 'phantom-steed',
    'protection-from-energy', 'remove-curse', 'sending', 'sleet-storm', 'slow', 'speak-with-dead',
    'stinking-cloud', 'tiny-hut', 'tongues', 'vampiric-touch', 'water-breathing',
    // 4th
    'arcane-eye', 'banishment', 'black-tentacles', 'blight', 'charm-monster', 'confusion',
    'conjure-minor-elementals', 'control-water', 'dimension-door', 'divination', 'fabricate',
    'faithful-hound', 'fire-shield', 'greater-invisibility', 'hallucinatory-terrain', 'ice-storm',
    'locate-creature', 'phantasmal-killer', 'polymorph', 'private-sanctum', 'resilient-sphere',
    'secret-chest', 'stone-shape', 'stoneskin', 'vitriolic-sphere', 'wall-of-fire',
  ],
  druid: [
    // Cantrips. The markdown conversion this was transcribed from drops the
    // druid's cantrip table row, so this line was assembled from the SRD itself
    // rather than from that file — Starry Wisp is on the list, and reading its
    // absence from the conversion as a real absence was a mistake once already.
    'druidcraft', 'elementalism', 'guidance', 'mending', 'poison-spray', 'produce-flame',
    'resistance', 'shillelagh', 'spare-the-dying', 'starry-wisp',
    // 1st
    'animal-friendship', 'charm-person', 'create-or-destroy-water', 'cure-wounds', 'detect-magic',
    'detect-poison-and-disease', 'entangle', 'faerie-fire', 'fog-cloud', 'goodberry',
    'healing-word', 'ice-knife', 'jump', 'longstrider', 'protection-from-evil-and-good',
    'purify-food-and-drink', 'speak-with-animals', 'thunderwave',
    // 2nd
    'aid', 'animal-messenger', 'augury', 'barkskin', 'continual-flame', 'darkvision',
    'enhance-ability', 'enlarge-reduce', 'find-traps', 'flame-blade', 'flaming-sphere',
    'gust-of-wind', 'heat-metal', 'hold-person', 'lesser-restoration',
    'locate-animals-or-plants', 'locate-object', 'moonbeam', 'pass-without-trace',
    'protection-from-poison', 'spike-growth',
    // 3rd
    'call-lightning', 'conjure-animals', 'daylight', 'dispel-magic', 'meld-into-stone',
    'plant-growth', 'protection-from-energy', 'revivify', 'sleet-storm', 'speak-with-plants',
    'water-breathing', 'water-walk', 'wind-wall',
    // 4th
    'blight', 'charm-monster', 'confusion', 'conjure-minor-elementals', 'conjure-woodland-beings',
    'control-water', 'divination', 'dominate-beast', 'fire-shield', 'freedom-of-movement',
    'giant-insect', 'hallucinatory-terrain', 'ice-storm', 'locate-creature', 'polymorph',
    'stone-shape', 'stoneskin', 'wall-of-fire',
  ],
  ranger: [
    // 1st
    'alarm', 'animal-friendship', 'cure-wounds', 'detect-magic', 'detect-poison-and-disease',
    'ensnaring-strike', 'entangle', 'fog-cloud', 'goodberry', 'hunters-mark', 'jump', 'longstrider',
    'speak-with-animals',
    // 2nd
    'aid', 'animal-messenger', 'barkskin', 'darkvision', 'enhance-ability', 'find-traps',
    'gust-of-wind', 'lesser-restoration', 'locate-animals-or-plants', 'locate-object', 'magic-weapon',
    'pass-without-trace', 'protection-from-poison', 'silence', 'spike-growth',
    // 3rd
    'conjure-animals', 'daylight', 'dispel-magic', 'meld-into-stone', 'nondetection', 'plant-growth',
    'protection-from-energy', 'revivify', 'speak-with-plants', 'water-breathing', 'water-walk',
    'wind-wall',
  ],
  bard: [
    // Cantrips
    'dancing-lights', 'light', 'mage-hand', 'mending', 'message', 'minor-illusion',
    'prestidigitation', 'starry-wisp', 'true-strike', 'vicious-mockery',
    // 1st
    'animal-friendship', 'bane', 'charm-person', 'color-spray', 'command', 'comprehend-languages',
    'cure-wounds', 'detect-magic', 'disguise-self', 'dissonant-whispers', 'faerie-fire',
    'feather-fall', 'healing-word', 'heroism', 'hideous-laughter', 'identify', 'illusory-script',
    'longstrider', 'silent-image', 'sleep', 'speak-with-animals', 'thunderwave', 'unseen-servant',
    // 2nd
    'aid', 'animal-messenger', 'blindness', 'calm-emotions', 'detect-thoughts', 'enhance-ability',
    'enlarge-reduce', 'enthrall', 'heat-metal', 'hold-person', 'invisibility', 'knock',
    'lesser-restoration', 'locate-animals-or-plants', 'locate-object', 'magic-mouth',
    'mirror-image', 'see-invisibility', 'shatter', 'silence', 'suggestion', 'zone-of-truth',
    // 3rd
    'bestow-curse', 'clairvoyance', 'dispel-magic', 'fear', 'glyph-of-warding',
    'hypnotic-pattern', 'major-image', 'mass-healing-word', 'nondetection', 'plant-growth',
    'sending', 'slow', 'speak-with-dead', 'speak-with-plants', 'stinking-cloud', 'tiny-hut',
    'tongues',
    // 4th
    'charm-monster', 'compulsion', 'confusion', 'dimension-door', 'freedom-of-movement',
    'greater-invisibility', 'hallucinatory-terrain', 'locate-creature', 'phantasmal-killer',
    'polymorph',
  ],
  paladin: [
    // 1st
    'bless', 'command', 'cure-wounds', 'detect-evil-and-good', 'detect-magic',
    'detect-poison-and-disease', 'divine-favor', 'divine-smite', 'heroism',
    'protection-from-evil-and-good', 'purify-food-and-drink', 'searing-smite', 'shield-of-faith',
    // 2nd
    'aid', 'find-steed', 'gentle-repose', 'lesser-restoration', 'locate-object', 'magic-weapon',
    'prayer-of-healing', 'protection-from-poison', 'shining-smite', 'warding-bond', 'zone-of-truth',
    // 3rd
    'create-food-and-water', 'daylight', 'dispel-magic', 'magic-circle', 'remove-curse', 'revivify',
  ],
};

/**
 * Spells a class gets from a *class feature* rather than from its spell list,
 * with the feature named. These are the only legitimate way for a class to hold
 * a spell that is not on its SRD list, and each one has to be justified here
 * rather than by widening the list above.
 */
const FEATURE_GRANTED: Record<string, Record<string, string>> = {
  druid: { 'find-familiar': 'Wild Companion (level 2): spend a Wild Shape use to cast it' },
};

/** Every spell id a class hands out, from any level of its progression. */
function granted(classId: string): string[] {
  const sc = CLASSES[classId]?.spellcasting;
  if (!sc) return [];
  const out = new Set<string>();
  for (const ids of Object.values(sc.spellsByLevel)) ids.forEach((id) => out.add(id));
  return [...out];
}

describe('class spell lists match the SRD', () => {
  for (const classId of Object.keys(SRD)) {
    it(`${classId} grants nothing off its SRD list`, () => {
      const allowed = new Set(SRD[classId]);
      for (const [id, why] of Object.entries(FEATURE_GRANTED[classId] ?? {})) {
        expect(why, `${classId}'s exception for ${id} needs a reason`).toBeTruthy();
        allowed.add(id);
      }
      for (const id of granted(classId)) {
        expect(allowed.has(id), `${classId} grants ${id}, which is not on the SRD 5.2 ${classId} list`).toBe(true);
      }
    });
  }

  it('covers every spellcasting class in the game', () => {
    const casters = Object.keys(CLASSES).filter((id) => CLASSES[id]?.spellcasting);
    for (const id of casters) {
      expect(Object.keys(SRD), `${id} casts spells but has no SRD list to check against`).toContain(id);
    }
  });

  it('every granted spell is actually implemented', () => {
    for (const classId of Object.keys(SRD)) {
      for (const id of granted(classId)) {
        expect(SPELLS[id], `${classId} grants ${id} but no such spell exists`).toBeDefined();
      }
    }
  });

  // The three that were wrong, named explicitly. A generic check can be
  // satisfied by weakening the list; these cannot.
  it('the spells this sweep removed stay removed', () => {
    expect(granted('ranger'), 'Misty Step is a wizard spell').not.toContain('misty-step');
    expect(granted('paladin'), 'Thunderous Smite is 2014-only').not.toContain('thunderous-smite');
    expect(granted('paladin'), 'Wrathful Smite is 2014-only').not.toContain('wrathful-smite');
    expect(SPELLS['thunderous-smite'], 'and the implementation is gone too').toBeUndefined();
    expect(SPELLS['wrathful-smite']).toBeUndefined();
  });

  // Misty Step is legal — just not for rangers. Guard against over-correcting.
  it('does not throw out spells that are legal for the class that has them', () => {
    expect(granted('wizard')).toContain('misty-step');
  });
});
