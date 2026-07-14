/**
 * Class data: everything the builder needs to assemble a level-N character.
 */
import type { Id, Ability } from '../engine/types.js';

export interface ClassData {
  id: Id;
  name: string;
  hitDie: number;
  savingThrows: [Ability, Ability];
  /** How 16,16,13,12,10,8 gets assigned, highest first. */
  statPriority: [Ability, Ability, Ability, Ability, Ability, Ability];
  spellcasting?: {
    ability: Ability;
    /** slotsByLevel[characterLevel - 1][spellLevel - 1] = slot count. */
    slotsByLevel: number[][];
    spellsByLevel: Record<number, Id[]>; // spells known at each character level
  };
  featuresByLevel: Record<number, Id[]>;
  weaponIds: Id[];
  weaponMasteries: Id[];
  armorId: Id;
  shield: boolean;
}

export const CLASSES: Record<Id, ClassData> = {
  fighter: {
    id: 'fighter', name: 'Fighter', hitDie: 10,
    savingThrows: ['str', 'con'],
    statPriority: ['str', 'con', 'dex', 'wis', 'int', 'cha'],
    featuresByLevel: {
      1: ['second-wind', 'action-surge', 'dueling'],
      3: ['improved-critical'], // Champion
    },
    weaponIds: ['longsword', 'javelin'],
    weaponMasteries: ['longsword'],
    armorId: 'scale-mail', shield: true,
  },
  cleric: {
    id: 'cleric', name: 'Cleric', hitDie: 8,
    savingThrows: ['wis', 'cha'],
    statPriority: ['wis', 'con', 'str', 'dex', 'cha', 'int'],
    spellcasting: {
      ability: 'wis',
      slotsByLevel: [[2], [3], [4, 2]],
      spellsByLevel: {
        1: ['sacred-flame', 'cure-wounds', 'bless'],
        2: ['guiding-bolt'],
        3: ['hold-person', 'aid'],
      },
    },
    featuresByLevel: {
      1: ['disciple-of-life'],
      3: ['preserve-life'], // Life Domain: Channel Divinity
    },
    weaponIds: ['mace'],
    weaponMasteries: [],
    armorId: 'chain-mail', shield: true,
  },
  wizard: {
    id: 'wizard', name: 'Wizard', hitDie: 6,
    savingThrows: ['int', 'wis'],
    statPriority: ['int', 'dex', 'con', 'wis', 'cha', 'str'],
    spellcasting: {
      ability: 'int',
      slotsByLevel: [[2], [3], [4, 2]],
      spellsByLevel: {
        1: ['fire-bolt', 'shocking-grasp', 'magic-missile', 'sleep', 'burning-hands'],
        2: ['thunderwave'],
        3: ['scorching-ray', 'misty-step'],
      },
    },
    featuresByLevel: {
      1: [],
      3: ['sculpt-spells'], // Evoker
    },
    weaponIds: ['quarterstaff'],
    weaponMasteries: [],
    armorId: 'none', shield: false,
  },
  rogue: {
    id: 'rogue', name: 'Rogue', hitDie: 8,
    savingThrows: ['dex', 'int'],
    statPriority: ['dex', 'con', 'int', 'wis', 'cha', 'str'],
    featuresByLevel: {
      1: ['sneak-attack'],
      2: ['cunning-dash', 'cunning-disengage'],
      3: ['assassinate'], // Assassin
    },
    weaponIds: ['shortsword', 'shortsword', 'shortbow'], // two blades for TWF
    weaponMasteries: ['shortsword', 'shortbow'],
    armorId: 'studded-leather', shield: false,
  },
};
