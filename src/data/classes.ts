/**
 * Class data: everything the builder needs to assemble a level-N character.
 */
import type { Id, Ability, ItemStack, DamageType } from '../engine/types.js';

export type ArmorProf = 'light' | 'medium' | 'heavy' | 'shield';

/**
 * A build decision offered at character creation — a Fighter's Fighting Style,
 * and later subclasses or species ancestries. One generic shape so a new choice
 * is data (an entry on a class or species), never new builder or UI code: the
 * builder folds the picked option's grants exactly like it folds species traits,
 * and the forge renders any choice point from this declaration.
 */
export interface ChoiceGrant {
  featureIds?: Id[];
  spellIds?: Id[];
  weaponMasteries?: Id[];
  resistances?: DamageType[];
}
export interface ChoiceOption {
  id: Id;
  name: string;
  /** One line shown under the option in the forge. */
  blurb: string;
  grants: ChoiceGrant;
}
export interface ChoicePoint {
  id: Id;
  label: string;
  /** Only offered/applied once the character reaches this level. */
  atLevel: number;
  /** Option used when the player hasn't chosen (beginners, legacy saves, skirmish). */
  default: Id;
  options: ChoiceOption[];
}

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
  /** Build decisions this class offers (Fighting Style, later subclasses). */
  choices?: ChoicePoint[];
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
      1: ['second-wind', 'action-surge'],
      3: ['improved-critical'], // Champion
      // 4: Ability Score Increase (applied in the builder, not a feature).
      5: ['extra-attack'],
    },
    choices: [{
      id: 'fighting-style', label: 'Fighting Style', atLevel: 1, default: 'dueling',
      options: [
        { id: 'dueling', name: 'Dueling', blurb: '+2 damage with a one-handed weapon (shield ok).', grants: { featureIds: ['dueling'] } },
        { id: 'defense', name: 'Defense', blurb: '+1 AC while wearing armor.', grants: { featureIds: ['defense'] } },
        { id: 'archery', name: 'Archery', blurb: '+2 to attack rolls with ranged weapons.', grants: { featureIds: ['archery'] } },
        { id: 'great-weapon-fighting', name: 'Great Weapon Fighting', blurb: 'Reroll 1s and 2s on two-handed weapon damage.', grants: { featureIds: ['great-weapon-fighting'] } },
        { id: 'two-weapon-fighting', name: 'Two-Weapon Fighting', blurb: 'Add your ability modifier to off-hand damage.', grants: { featureIds: ['two-weapon-fighting'] } },
      ],
    }],
    weaponMasteries: ['longsword', 'longsword-plus1', 'javelin'],
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
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2]],
      spellsByLevel: {
        1: ['sacred-flame', 'cure-wounds', 'bless', 'healing-word', 'command'],
        2: ['guiding-bolt'],
        3: ['hold-person', 'aid', 'spiritual-weapon'],
        5: ['mass-healing-word', 'spiritual-guardians'], // 3rd-level slot arrives here
      },
    },
    featuresByLevel: {
      1: ['disciple-of-life'],
      2: ['turn-undead'], // Channel Divinity every cleric gets
      3: ['preserve-life'], // Life Domain: Channel Divinity
      // 4: Ability Score Increase (builder).
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
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2]],
      spellsByLevel: {
        1: ['fire-bolt', 'shocking-grasp', 'magic-missile', 'sleep', 'burning-hands', 'find-familiar', 'mage-armor', 'shield'],
        2: ['thunderwave'],
        3: ['scorching-ray', 'misty-step', 'suggestion', 'web'],
        5: ['fireball', 'fear', 'lightning-bolt'], // 3rd-level slot arrives here
      },
    },
    featuresByLevel: {
      1: [],
      3: ['sculpt-spells'], // Evoker
      // 4: Ability Score Increase (builder).
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
      // 4: Ability Score Increase (builder). Sneak Attack scales to 3d6 at L5
      // automatically via its advantageDice(level) formula.
      5: ['uncanny-dodge'],
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
  ranger: {
    id: 'ranger', name: 'Ranger', hitDie: 10,
    savingThrows: ['str', 'dex'],
    armorProfs: ['light', 'medium', 'shield'],
    skillProfs: ['stealth', 'perception'],
    statPriority: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
    // 2024 half-caster progression: slots from 1st level, second-level slots
    // arrive at 5th alongside Extra Attack.
    spellcasting: {
      ability: 'wis',
      slotsByLevel: [[2], [2], [3], [3], [4, 2]],
      spellsByLevel: {
        1: ['hunters-mark', 'cure-wounds', 'animal-friendship'],
        5: ['misty-step'], // 2nd-level slot arrives here
      },
    },
    featuresByLevel: {
      1: [], // Hunter's Mark (the spell) is the level-1 identity, not a feature
      3: ['colossus-slayer'], // Hunter's Prey
      // 4: Ability Score Increase (builder).
      5: ['extra-attack'],
    },
    choices: [{
      id: 'fighting-style', label: 'Fighting Style', atLevel: 2, default: 'archery',
      options: [
        { id: 'archery', name: 'Archery', blurb: '+2 to attack rolls with ranged weapons.', grants: { featureIds: ['archery'] } },
        { id: 'defense', name: 'Defense', blurb: '+1 AC while wearing armor.', grants: { featureIds: ['defense'] } },
        { id: 'dueling', name: 'Dueling', blurb: '+2 damage with a one-handed weapon (shield ok).', grants: { featureIds: ['dueling'] } },
        { id: 'two-weapon-fighting', name: 'Two-Weapon Fighting', blurb: 'Add your ability modifier to off-hand damage.', grants: { featureIds: ['two-weapon-fighting'] } },
      ],
    }],
    weaponMasteries: ['longbow', 'longbow-plus1', 'shortsword', 'shortsword-plus1'],
    equipment: {
      mainHand: 'longbow', armor: 'studded-leather',
      inventory: [
        { itemId: 'shortsword', qty: 2 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
  paladin: {
    id: 'paladin', name: 'Paladin', hitDie: 10,
    savingThrows: ['wis', 'cha'],
    armorProfs: ['light', 'medium', 'heavy', 'shield'],
    skillProfs: ['intimidation'],
    statPriority: ['str', 'cha', 'con', 'wis', 'dex', 'int'],
    // Same half-caster progression as the Ranger; the spell list is support
    // and control, since Divine Smite is the class's real damage engine.
    spellcasting: {
      ability: 'cha',
      slotsByLevel: [[2], [2], [3], [3], [4, 2]],
      spellsByLevel: {
        1: ['bless', 'cure-wounds', 'command'],
        5: ['aid'], // 2nd-level slot arrives here
      },
    },
    featuresByLevel: {
      1: ['lay-on-hands'],
      2: ['divine-smite'],
      3: ['sacred-weapon'], // Devotion: Channel Divinity
      // 4: Ability Score Increase (builder).
      5: ['extra-attack'],
    },
    choices: [{
      id: 'fighting-style', label: 'Fighting Style', atLevel: 2, default: 'defense',
      options: [
        { id: 'defense', name: 'Defense', blurb: '+1 AC while wearing armor.', grants: { featureIds: ['defense'] } },
        { id: 'dueling', name: 'Dueling', blurb: '+2 damage with a one-handed weapon (shield ok).', grants: { featureIds: ['dueling'] } },
        { id: 'great-weapon-fighting', name: 'Great Weapon Fighting', blurb: 'Reroll 1s and 2s on two-handed weapon damage.', grants: { featureIds: ['great-weapon-fighting'] } },
      ],
    }],
    weaponMasteries: ['longsword', 'longsword-plus1', 'warhammer', 'warhammer-plus1'],
    equipment: {
      mainHand: 'longsword', offHand: 'shield', armor: 'chain-mail',
      inventory: [
        { itemId: 'javelin', qty: 2 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
};
