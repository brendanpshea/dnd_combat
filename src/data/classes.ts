/**
 * Class data: everything the builder needs to assemble a level-N character.
 */
import type { Id, Ability, ItemStack } from '../engine/types.js';

export type ArmorProf = 'light' | 'medium' | 'heavy' | 'shield';

export type SkillId = 'stealth' | 'sleight-of-hand' | 'intimidation' | 'persuasion' | 'deception' | 'perception';

export const SKILL_ABILITY: Record<SkillId, Ability> = {
  stealth: 'dex',
  'sleight-of-hand': 'dex',
  intimidation: 'cha',
  persuasion: 'cha',
  deception: 'cha',
  perception: 'wis',
};

export interface ClassData {
  id: Id;
  name: string;
  hitDie: number;
  savingThrows: [Ability, Ability];
  armorProfs: ArmorProf[];
  skillProfs: SkillId[];
  /** How 16,16,13,12,10,8 gets assigned, highest first. */
  statPriority: [Ability, Ability, Ability, Ability, Ability, Ability];
  spellcasting?: {
    ability: Ability;
    /** slotsByLevel[characterLevel - 1][spellLevel - 1] = slot count. */
    slotsByLevel: number[][];
    spellsByLevel: Record<number, Id[]>; // spells known at each character level
  };
  featuresByLevel: Record<number, Id[]>;
  weaponMasteries: Id[];
  equipment: {
    mainHand: Id;
    offHand?: Id | 'shield';
    armor?: Id;
    inventory: ItemStack[];   // spare weapons + consumables
  };
}

export const CLASSES: Record<Id, ClassData> = {
  fighter: {
    id: 'fighter', name: 'Fighter', hitDie: 10,
    savingThrows: ['str', 'con'],
    armorProfs: ['light', 'medium', 'heavy', 'shield'],
    skillProfs: ['intimidation'],
    statPriority: ['str', 'con', 'dex', 'wis', 'int', 'cha'],
    featuresByLevel: {
      1: ['second-wind', 'action-surge', 'dueling'],
      3: ['improved-critical'], // Champion
    },
    weaponMasteries: ['longsword', 'longsword-plus1'],
    equipment: {
      mainHand: 'longsword', offHand: 'shield', armor: 'scale-mail',
      inventory: [
        { itemId: 'javelin', qty: 2 },
        { itemId: 'potion-healing', qty: 1 },
        { itemId: 'alchemists-fire', qty: 1 },
      ],
    },
  },
  cleric: {
    id: 'cleric', name: 'Cleric', hitDie: 8,
    savingThrows: ['wis', 'cha'],
    armorProfs: ['light', 'medium', 'heavy', 'shield'], // heavy via Life Domain
    skillProfs: ['persuasion'],
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
    weaponMasteries: [],
    equipment: {
      // Mace and shield in hand (AC 18), with a light crossbow slung in the
      // pack. True Strike guides *any* attackable weapon, so an elf cleric fires
      // the stowed crossbow across the board on Wisdom without dropping the
      // shield — the pack is the ranged slot.
      mainHand: 'mace', offHand: 'shield', armor: 'chain-mail',
      inventory: [
        { itemId: 'light-crossbow', qty: 1 },
        { itemId: 'potion-healing', qty: 1 },
        { itemId: 'scroll-cure-wounds', qty: 1 },
      ],
    },
  },
  wizard: {
    id: 'wizard', name: 'Wizard', hitDie: 6,
    savingThrows: ['int', 'wis'],
    armorProfs: [],
    skillProfs: [],
    statPriority: ['int', 'dex', 'con', 'wis', 'cha', 'str'],
    spellcasting: {
      ability: 'int',
      slotsByLevel: [[2], [3], [4, 2]],
      spellsByLevel: {
        1: ['fire-bolt', 'shocking-grasp', 'magic-missile', 'sleep', 'burning-hands', 'find-familiar'],
        2: ['thunderwave'],
        3: ['scorching-ray', 'misty-step'],
      },
    },
    featuresByLevel: {
      1: [],
      3: ['sculpt-spells'], // Evoker
    },
    weaponMasteries: [],
    equipment: {
      // Two daggers: finesse, so they hit off the wizard's Dexterity (+3) rather
      // than its feeble Strength, and thrown, so they reach — a real weapon for
      // True Strike, and dual-wieldable. The staff waits in the pack.
      mainHand: 'dagger', offHand: 'dagger',
      inventory: [
        { itemId: 'quarterstaff', qty: 1 },
        { itemId: 'potion-healing', qty: 1 },
        { itemId: 'scroll-magic-missile', qty: 1 },
      ],
    },
  },
  rogue: {
    id: 'rogue', name: 'Rogue', hitDie: 8,
    savingThrows: ['dex', 'int'],
    armorProfs: ['light'],
    skillProfs: ['stealth', 'sleight-of-hand', 'deception'],
    statPriority: ['dex', 'con', 'int', 'wis', 'cha', 'str'],
    featuresByLevel: {
      1: ['sneak-attack'],
      2: ['cunning-dash', 'cunning-disengage', 'cunning-hide'],
      3: ['assassinate'], // Assassin
    },
    weaponMasteries: ['shortsword', 'shortsword-plus1', 'shortbow'],
    equipment: {
      mainHand: 'shortsword', offHand: 'shortsword', armor: 'studded-leather',
      inventory: [
        { itemId: 'shortbow', qty: 1 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
};
