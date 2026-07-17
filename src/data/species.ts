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
  tiefling: {
    id: 'tiefling', name: 'Abyssal Tiefling', speed: 30,
    // Poison resistance, not fire — an abyssal (demonic) tiefling, distinct
    // from the usual infernal fire flavour and from the Dragonborn we already
    // have. Poison Spray free at 1st; Ray of Sickness innate from 3rd is the
    // first spell to ever apply `poisoned`, which existed as a condition
    // (disadvantage on the bearer's attacks) but had no caster before this.
    resistances: ['poison'],
    spellsByLevel: { 1: ['poison-spray'] },
    innateSpells: [{ spellId: 'ray-of-sickness', atLevel: 3, uses: 1 }],
  },
  gnome: {
    id: 'gnome', name: 'Gnome', speed: 30,
    // Gnomish Cunning: advantage on Int/Wis/Cha saves — the reliable backbone,
    // the same shape as the elf's Keen Senses. Minor Illusion is free from 1st
    // (battlefield LoS control, not a damage cantrip — the tray's the only
    // place it costs nothing to browse for). Animal Friendship replaces the
    // useless-in-combat Speak with Animals: 2 uses from 1st (not gated to 3rd
    // like the other species' innate spells — a gnome starts able to talk its
    // way past a wolf pack), a hard beast-only counter that removes its
    // target from the fight on a failed save rather than damaging it.
    featureIds: ['gnomish-cunning'],
    spellsByLevel: { 1: ['minor-illusion'] },
    innateSpells: [{ spellId: 'animal-friendship', atLevel: 1, uses: 2 }],
  },
  halfling: {
    id: 'halfling', name: 'Halfling', speed: 30,
    // Two survival traits, deliberately not a damage-dealer: a halfling reads
    // as hard to pin down and hard to hit, not another offensive niche.
    // Lucky (a natural 1 rerolls, unconditionally, on every attack roll,
    // saving throw and Hide check — see engine/rules/luck.ts) is the
    // signature trait, unlimited rather than the capped "Lucky" feat's
    // separate 2024 mechanic. Halfling Nimbleness and 2024's Naturally
    // Stealthy (hiding behind a larger ally) both need a size system this
    // game doesn't have, so Naturally Stealthy is reframed as straight
    // Stealth proficiency — its own Hide check gets better, which is the part
    // that actually shows up at the table. Brave (advantage vs Frightened) is
    // deliberately not included: nothing in the game applies Frightened yet,
    // so it would ship inert, the same trap Speak with Animals was for the
    // gnome before Animal Friendship replaced it.
    featureIds: ['lucky', 'naturally-stealthy'],
  },
};