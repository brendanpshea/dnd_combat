/**
 * Player-character species. Traits that matter to this combat-focused game
 * are represented as data; vision and exploration-only traits stay out of
 * the headless combat engine until those systems exist.
 */
import type { DamageType, Id } from '../engine/types.js';
import type { SkillId } from './classes.js';

export interface SpeciesData {
  id: Id;
  name: string;
  speed: number;
  /** Added to maximum HP once for every character level. */
  hpPerLevel?: number;
  resistances?: DamageType[];
  featureIds?: Id[];
  /**
   * Cantrips the species grants, by the character level they arrive — the same
   * shape a class uses. Cantrips are free to cast, so they need nothing more.
   */
  spellsByLevel?: Record<number, Id[]>;
  /**
   * Innate *levelled* spells: cast with no slot, a fixed number of times per
   * encounter. This is what a non-caster needs — a fighter has no slots, so
   * without this a racial Faerie Fire would silently be a caster-only perk.
   */
  innateSpells?: Array<{ spellId: Id; atLevel: number; uses: number }>;
  /** Deterministic Skillful choice for the campaign's limited skill list. */
  skillProficienciesByClass?: Partial<Record<Id, SkillId>>;
}

export const SPECIES: Record<Id, SpeciesData> = {
  human: {
    id: 'human', name: 'Human', speed: 30,
    featureIds: ['heroic-inspiration'],
    skillProficienciesByClass: {
      fighter: 'persuasion', wizard: 'deception', cleric: 'stealth', rogue: 'persuasion',
    },
  },
  dwarf: {
    id: 'dwarf', name: 'Dwarf', speed: 30,
    hpPerLevel: 1,
    resistances: ['poison'],
  },
  elf: {
    id: 'elf', name: 'Wood Elf', speed: 35,
    // Trance (no Sleep) and 35 ft were the whole species; an elf may as well
    // have been a human in a hurry. True Strike is the elf's own magic, and
    // Keen Senses makes it the party's lookout.
    featureIds: ['trance', 'keen-senses'],
    spellsByLevel: { 1: ['true-strike'] },
    // Faerie Fire at 3rd — the elf lights a cluster of foes so the whole party
    // strikes them with advantage, and no one among them can hide.
    innateSpells: [{ spellId: 'faerie-fire', atLevel: 3, uses: 1 }],
  },
  orc: {
    id: 'orc', name: 'Orc', speed: 30,
    featureIds: ['adrenaline-rush', 'relentless-endurance'],
  },
  dragonborn: {
    id: 'dragonborn', name: 'Dragonborn', speed: 30,
    // Draconic Ancestry (red): shrug off fire, and breathe it back — a cone a
    // couple of times a fight, the innate-spell path's damage shape.
    resistances: ['fire'],
    innateSpells: [{ spellId: 'breath-weapon', atLevel: 1, uses: 2 }],
  },
};