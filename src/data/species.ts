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
    featureIds: ['trance'],
  },
  orc: {
    id: 'orc', name: 'Orc', speed: 30,
    featureIds: ['adrenaline-rush', 'relentless-endurance'],
  },
};