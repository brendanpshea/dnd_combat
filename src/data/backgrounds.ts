/**
 * Backgrounds: a character-creation identity granting two skill proficiencies.
 *
 * The list is the 2024 SRD 5.2 set, verbatim in name and skill pair. Two older
 * entries were retired to get there: Folk Hero became **Farmer** (its 2024
 * successor, and the same rustic idea) and Investigator became **Scribe**,
 * which keeps Investigation and trades Acrobatics for Perception.
 *
 * Deliberately lighter than a class/species ChoicePoint — a background is not
 * level-gated and grants nothing but skills, so it's a flat data table read by
 * `skillBonus` rather than folded through the builder's grant machinery. A
 * party of four covers most of the 18-skill list, and the pick is what makes
 * an adventure's scene checks land on different heroes.
 *
 * ADAPTED: the SRD also gives each background a tool proficiency, an Origin
 * feat, and three ability-score increases. This models the skills only. Tools
 * have nothing to check against in this engine, and the feats and ability bumps
 * would re-tune every character's stat line and combat balance — worth doing
 * deliberately, not as a side effect of adding flavour. `toolNote` keeps the
 * tool as text so the forge can still say what you trained at.
 */
import type { Id } from '../engine/types.js';
import type { SkillId } from './classes.js';

export interface BackgroundData {
  id: Id;
  name: string;
  /** One line shown under the option in the forge. */
  blurb: string;
  skills: [SkillId, SkillId];
  /** The SRD's tool proficiency, flavour only — see the note above. */
  toolNote: string;
}

export const BACKGROUNDS: Record<Id, BackgroundData> = {
  acolyte: {
    id: 'acolyte', name: 'Acolyte', blurb: 'Raised in a temple; versed in lore and hearts.',
    skills: ['insight', 'religion'], toolNote: 'Calligrapher’s Supplies',
  },
  artisan: {
    id: 'artisan', name: 'Artisan', blurb: 'Trained at a workbench; you can make it and sell it.',
    skills: ['investigation', 'persuasion'], toolNote: 'Artisan’s Tools',
  },
  charlatan: {
    id: 'charlatan', name: 'Charlatan', blurb: 'You made a living convincing people of untrue things.',
    skills: ['deception', 'sleight-of-hand'], toolNote: 'Forgery Kit',
  },
  criminal: {
    id: 'criminal', name: 'Criminal', blurb: 'A past in the shadows; quick hands, quiet feet.',
    skills: ['sleight-of-hand', 'stealth'], toolNote: 'Thieves’ Tools',
  },
  entertainer: {
    id: 'entertainer', name: 'Entertainer', blurb: 'A crowd-pleaser who can tumble as well as sing.',
    skills: ['acrobatics', 'performance'], toolNote: 'Musical Instrument',
  },
  farmer: {
    id: 'farmer', name: 'Farmer', blurb: 'You worked the land; patient, strong, good with beasts.',
    skills: ['animal-handling', 'nature'], toolNote: 'Carpenter’s Tools',
  },
  guard: {
    id: 'guard', name: 'Guard', blurb: 'You watched a gate, and learned to notice what moved.',
    skills: ['athletics', 'perception'], toolNote: 'Gaming Set',
  },
  guide: {
    id: 'guide', name: 'Guide', blurb: 'At home in the wild; sure-footed and hard to spot.',
    skills: ['stealth', 'survival'], toolNote: 'Cartographer’s Tools',
  },
  hermit: {
    id: 'hermit', name: 'Hermit', blurb: 'You lived apart, tending your own hurts and questions.',
    skills: ['medicine', 'religion'], toolNote: 'Herbalism Kit',
  },
  merchant: {
    id: 'merchant', name: 'Merchant', blurb: 'A stall or a caravan; you can read a buyer at ten paces.',
    skills: ['animal-handling', 'persuasion'], toolNote: 'Navigator’s Tools',
  },
  noble: {
    id: 'noble', name: 'Noble', blurb: 'Raised to privilege, and to the histories behind it.',
    skills: ['history', 'persuasion'], toolNote: 'Gaming Set',
  },
  sage: {
    id: 'sage', name: 'Sage', blurb: 'A scholar of the arcane and the ages.',
    skills: ['arcana', 'history'], toolNote: 'Calligrapher’s Supplies',
  },
  sailor: {
    id: 'sailor', name: 'Sailor', blurb: 'You kept your feet on a deck that would not keep still.',
    skills: ['acrobatics', 'perception'], toolNote: 'Navigator’s Tools',
  },
  scribe: {
    id: 'scribe', name: 'Scribe', blurb: 'You copied documents, and noticed what others missed.',
    skills: ['investigation', 'perception'], toolNote: 'Calligrapher’s Supplies',
  },
  soldier: {
    id: 'soldier', name: 'Soldier', blurb: 'Drilled in arms and the reading of foes.',
    skills: ['athletics', 'intimidation'], toolNote: 'Gaming Set',
  },
  wayfarer: {
    id: 'wayfarer', name: 'Wayfarer', blurb: 'You grew up on the road, and learned to read people fast.',
    skills: ['insight', 'stealth'], toolNote: 'Thieves’ Tools',
  },
};

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS);

/** The two skills a background grants, or [] for none/unknown. */
export function backgroundSkills(backgroundId: Id | undefined): SkillId[] {
  if (!backgroundId) return [];
  return BACKGROUNDS[backgroundId]?.skills ?? [];
}

/**
 * The background a class falls into when nobody picks one, so a player who
 * never opens the picker still gets the skills — the same way an untouched
 * Fighting Style still applies. Chosen to spread skill coverage across the
 * party, so an adventure's varied scene checks land on different heroes.
 */
const DEFAULT_BY_CLASS: Record<Id, Id> = {
  fighter: 'soldier',
  wizard: 'sage',
  cleric: 'acolyte',
  rogue: 'criminal',
  ranger: 'guide',
  paladin: 'noble',
};

export function defaultBackgroundFor(classId: Id): Id {
  return DEFAULT_BY_CLASS[classId] ?? 'wayfarer';
}
