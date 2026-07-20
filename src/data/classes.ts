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

export type SkillId =
  // the original shop skills
  | 'stealth' | 'sleight-of-hand' | 'intimidation' | 'persuasion' | 'deception' | 'perception'
  // the rest of the PHB list, used by adventure-mode scene checks
  | 'athletics' | 'acrobatics'
  | 'arcana' | 'history' | 'investigation' | 'nature' | 'religion'
  | 'animal-handling' | 'insight' | 'medicine' | 'survival'
  | 'performance';

export const SKILL_ABILITY: Record<SkillId, Ability> = {
  athletics: 'str',
  acrobatics: 'dex',
  'sleight-of-hand': 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  'animal-handling': 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha',
};

/** Human-readable skill labels for UI (derive title-case where obvious). */
export const SKILL_LABEL: Record<SkillId, string> = {
  athletics: 'Athletics', acrobatics: 'Acrobatics', 'sleight-of-hand': 'Sleight of Hand',
  stealth: 'Stealth', arcana: 'Arcana', history: 'History', investigation: 'Investigation',
  nature: 'Nature', religion: 'Religion', 'animal-handling': 'Animal Handling', insight: 'Insight',
  medicine: 'Medicine', perception: 'Perception', survival: 'Survival', deception: 'Deception',
  intimidation: 'Intimidation', performance: 'Performance', persuasion: 'Persuasion',
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
    /**
     * How many cantrips / leveled spells this caster *knows* at each level
     * (index = characterLevel - 1) — a "spells known" model: the class table
     * above is the menu to choose from, these are how many you pick, with the
     * rest changeable in the campaign's prepare panel. Rituals (Find Familiar)
     * are always known and don't count against `spellsKnownByLevel`. Omit
     * either array to mean "knows the whole list" (the half-caster default,
     * and what a class had before this model).
     */
    cantripsKnownByLevel?: number[];
    spellsKnownByLevel?: number[];
    /**
     * Spells this class can learn beyond its default table — a wizard's
     * spellbook growing from scrolls found in play, rather than every copy
     * being one already known for free. Campaign-only: nothing here is
     * granted by default; a character must copy it in first (campaign.ts).
     */
    learnableExtra?: Id[];
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
      1: ['second-wind'],
      2: ['action-surge'], // 2024: Action Surge is a level-2 feature.
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
    armorProfs: ['light', 'medium', 'heavy', 'shield'], // heavy via Protector Divine Order (2024)
    skillProfs: ['persuasion'],
    statPriority: ['wis', 'con', 'str', 'dex', 'cha', 'int'],
    spellcasting: {
      ability: 'wis',
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2]],
      cantripsKnownByLevel: [2, 2, 2, 2, 2], // both cleric cantrips (Sacred Flame, Guidance)
      spellsKnownByLevel: [5, 6, 7, 8, 9],
      spellsByLevel: {
        1: ['sacred-flame', 'guidance', 'cure-wounds', 'bless', 'healing-word', 'command', 'inflict-wounds', 'bane', 'shield-of-faith'],
        2: ['guiding-bolt'],
        3: ['hold-person', 'aid', 'spiritual-weapon', 'blindness', 'lesser-restoration'],
        5: ['mass-healing-word', 'spiritual-guardians', 'dispel-magic'], // 3rd-level slot arrives here
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
      cantripsKnownByLevel: [3, 3, 3, 4, 4],
      spellsKnownByLevel: [5, 6, 7, 8, 9], // Find Familiar is a ritual, always known on top of these
      spellsByLevel: {
        1: [
          'fire-bolt', 'shocking-grasp', 'magic-missile', 'sleep', 'burning-hands',
          'find-familiar', 'mage-armor', 'shield', 'ray-of-frost', 'acid-splash', 'color-spray', 'false-life',
        ],
        2: ['thunderwave'],
        3: ['scorching-ray', 'misty-step', 'suggestion', 'web', 'invisibility', 'blindness'],
        5: ['fireball', 'fear', 'lightning-bolt', 'dispel-magic', 'haste'], // 3rd-level slot arrives here
      },
      learnableExtra: ['ray-of-sickness'],
    },
    featuresByLevel: {
      1: [],
      // Evoker subclass at level 3: a simplified Enhanced Cantrip (adds the
      // evoker's Int modifier to its damaging cantrips). Sculpt Spells is a
      // level-6 feature in the 2024 PHB and lands there for when the campaign
      // eventually reaches that level.
      3: ['enhanced-cantrip'],
      6: ['sculpt-spells'],
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
