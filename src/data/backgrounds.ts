/**
 * Backgrounds: a character-creation identity granting two skill proficiencies.
 *
 * Deliberately lighter than a class/species ChoicePoint — a background is not
 * level-gated and grants nothing but skills, so it's a flat data table read by
 * `skillBonus` rather than folded through the builder's grant machinery. A
 * party of four covers most of the 18-skill list, and the pick is what makes
 * an adventure's scene checks land on different heroes.
 */
import type { Id } from '../engine/types.js';
import type { SkillId } from './classes.js';

export interface BackgroundData {
  id: Id;
  name: string;
  /** One line shown under the option in the forge. */
  blurb: string;
  skills: [SkillId, SkillId];
}

export const BACKGROUNDS: Record<Id, BackgroundData> = {
  acolyte: {
    id: 'acolyte', name: 'Acolyte', blurb: 'Raised in a temple; versed in lore and hearts.',
    skills: ['religion', 'insight'],
  },
  criminal: {
    id: 'criminal', name: 'Criminal', blurb: 'A past in the shadows; quick hands, quiet feet.',
    skills: ['stealth', 'sleight-of-hand'],
  },
  sage: {
    id: 'sage', name: 'Sage', blurb: 'A scholar of the arcane and the ages.',
    skills: ['arcana', 'history'],
  },
  soldier: {
    id: 'soldier', name: 'Soldier', blurb: 'Drilled in arms and the reading of foes.',
    skills: ['athletics', 'intimidation'],
  },
  'folk-hero': {
    id: 'folk-hero', name: 'Folk Hero', blurb: 'Of the people; good with beasts and hard graft.',
    skills: ['animal-handling', 'survival'],
  },
  guide: {
    id: 'guide', name: 'Guide', blurb: 'At home in the wild; sharp-eyed and sure-footed.',
    skills: ['perception', 'nature'],
  },
  entertainer: {
    id: 'entertainer', name: 'Entertainer', blurb: 'A crowd-pleaser with a silver tongue.',
    skills: ['performance', 'persuasion'],
  },
  investigator: {
    id: 'investigator', name: 'Investigator', blurb: 'Nothing escapes a careful eye and a nimble step.',
    skills: ['investigation', 'acrobatics'],
  },
};

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS);

/** The two skills a background grants, or [] for none/unknown. */
export function backgroundSkills(backgroundId: Id | undefined): SkillId[] {
  if (!backgroundId) return [];
  return BACKGROUNDS[backgroundId]?.skills ?? [];
}
