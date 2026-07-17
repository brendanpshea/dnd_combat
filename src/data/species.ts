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
   * Spells the species itself grants, by the level they arrive — the same shape
   * a class uses. Cantrips only for now, and deliberately: a levelled spell
   * needs a slot, and a fighter has none, so a racial fireball would be a
   * caster-only perk. Innate "once per rest, no slot" casting is the mechanism
   * that unlocks the rest, and it doesn't exist yet.
   */
  spellsByLevel?: Record<number, Id[]>;
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
  },
  orc: {
    id: 'orc', name: 'Orc', speed: 30,
    featureIds: ['adrenaline-rush', 'relentless-endurance'],
  },
};