/**
 * Class data: everything the builder needs to assemble a level-N character.
 */
import type { Id, Ability, ItemStack, DamageType, WeaponProfs } from '../engine/types.js';

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
  weaponProfs: WeaponProfs;
  skillProfs: SkillId[];
  /** How 16,16,13,12,10,8 gets assigned, highest first. */
  statPriority: [Ability, Ability, Ability, Ability, Ability, Ability];
  spellcasting?: {
    ability: Ability;
    /** slotsByLevel[characterLevel - 1][spellLevel - 1] = slot count. */
    slotsByLevel: number[][];
    /**
     * Spells known at each character level.
     *
     * ORDER IS PRIORITY. The auto-prepared loadout (campaign.ts's defaultKnown)
     * walks each spell level in *this* order and takes the first few, so a
     * strong spell written late in its level simply never gets prepared. The
     * bard shipped with Sleep fifth on its 1st-level line and Bane first, and
     * so spent every run casting Bane and never once casting the best spell it
     * owned. Within each spell level, write strongest first.
     */
    spellsByLevel: Record<number, Id[]>;
    /**
     * The 2024 three-tier "spells known" model, per character level (index =
     * level - 1). The class table above is the menu; these are how many you
     * take, chosen at party creation and editable in the prepare panel.
     *  - `cantripsKnownByLevel`: cantrips known — always all prepared.
     *  - `spellbookByLevel`: for a *spellbook* caster (wizard), how many leveled
     *    spells it knows. This chosen set is the pool it prepares from, and it
     *    grows via scribed scrolls. Omit for a caster that knows its whole
     *    leveled list (cleric).
     *  - `preparedByLevel`: how many leveled spells can be prepared at once —
     *    the wizard's "Prepared Spells" column, `[4,5,6,7,9]`.
     * Rituals (Find Familiar) are always known and count against none of these.
     * All omitted → the caster knows/prepares its whole list (the half-caster
     * default, and what a class had before this model).
     */
    cantripsKnownByLevel?: number[];
    spellbookByLevel?: number[];
    preparedByLevel?: number[];
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
    weaponProfs: { simple: true, martial: true },
    skillProfs: ['athletics', 'intimidation'],
    statPriority: ['str', 'con', 'dex', 'wis', 'int', 'cha'],
    featuresByLevel: {
      1: ['second-wind'],
      2: ['action-surge'], // 2024: Action Surge is a level-2 feature.
      3: ['improved-critical', 'remarkable-athlete'],   // Champion, both at 3rd in the SRD // Champion
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
    }, {
      // A SECOND Fighting Style at 7th — the Champion's, and the only thing a
      // fighter gains at that level. Its own choice-point id, because picks
      // are keyed by that id and a shared one would mean choosing once for
      // both. A different default too, so a fighter who never opens the panel
      // ends up with two styles rather than one applied twice.
      id: 'fighting-style-2', label: 'Additional Fighting Style', atLevel: 7,
      default: 'great-weapon-fighting',
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
    weaponProfs: { simple: true, martial: false },
    skillProfs: ['religion', 'persuasion'],
    statPriority: ['wis', 'con', 'str', 'dex', 'cha', 'int'],
    spellcasting: {
      ability: 'wis',
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2]],
      cantripsKnownByLevel: [2, 2, 2, 2, 2, 2, 2, 2], // both cleric cantrips (Sacred Flame, Guidance)
      // Cleric knows its whole leveled list (no spellbook); it prepares a subset.
      // Widened alongside the list: the point of the new spells is a choice, and
      // preparing 4 of 9 was already most of the 1st-level list.
      // 12 and 13 continue this class's own slope; its column already runs
      // ahead of the SRD's (11 at 5th where the table has 9) because the list is
      // wider here. The SRD's own increment over 6 and 7 is +1 a level either way.
      preparedByLevel: [4, 5, 7, 8, 11, 12, 13, 14],
      spellsByLevel: {
        1: ['sacred-flame', 'guidance', 'cure-wounds', 'bless', 'healing-word', 'command', 'inflict-wounds', 'bane', 'shield-of-faith', 'sanctuary', 'protection-from-evil-and-good'],
        2: ['guiding-bolt'],
        3: ['hold-person', 'aid', 'spiritual-weapon', 'silence', 'blindness', 'lesser-restoration', 'warding-bond'],
        5: ['mass-healing-word', 'spiritual-guardians', 'dispel-magic', 'protection-from-energy', 'bestow-curse'], // 3rd-level slot arrives here
        // 4th-level slot arrives here, and used to hold exactly one spell.
        7: ['banishment', 'death-ward', 'freedom-of-movement'],
      },
    },
    featuresByLevel: {
      6: ['blessed-healer'],
      7: ['potent-spellcasting'],   // Blessed Strikes, taken as Potent Spellcasting
      2: ['turn-undead'], // Channel Divinity every cleric gets
      // Both Life Domain, and the SRD gives both at 3 — Disciple of Life was
      // being handed out at 1, two levels before a cleric picks a domain.
      3: ['preserve-life', 'disciple-of-life'],
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
    weaponProfs: { simple: true, martial: false },
    skillProfs: ['arcana', 'investigation'],
    statPriority: ['int', 'dex', 'con', 'wis', 'cha', 'str'],
    spellcasting: {
      ability: 'int',
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2]],
      cantripsKnownByLevel: [3, 3, 3, 4, 4, 4, 4, 4],   // SRD: no new cantrip at 6, 7 or 8
      spellbookByLevel: [6, 8, 10, 12, 14, 16, 18, 20], // known leveled spells (grows via scribed scrolls too)
      preparedByLevel: [4, 5, 6, 7, 9, 10, 11, 12],     // the 2024 Wizard "Prepared Spells" column
      spellsByLevel: {
        1: [
          // cantrips (choose 3 of these 6) then leveled (spellbook order sets
          // the sensible auto-default: the first 6 non-ritual are the default
          // spellbook, the first 4 the default prepared).
          'fire-bolt', 'ray-of-frost', 'shocking-grasp', 'poison-spray', 'true-strike', 'acid-splash', 'minor-illusion',
          'magic-missile', 'sleep', 'burning-hands', 'shield', 'mage-armor', 'color-spray', 'false-life',
          'find-familiar', // ritual: always known, never counts against the spellbook
        ],
        2: ['thunderwave'],
        3: ['shatter', 'mirror-image', 'scorching-ray', 'misty-step', 'suggestion', 'web', 'invisibility', 'blindness', 'flaming-sphere'],
        5: ['fireball', 'counterspell', 'fear', 'lightning-bolt', 'dispel-magic', 'haste'], // 3rd-level slot arrives here
        7: ['greater-invisibility', 'wall-of-fire', 'confusion', 'dimension-door',
            'blight', 'ice-storm', 'banishment', 'phantasmal-killer', 'polymorph'],   // 4th-level slot arrives here
      },
      learnableExtra: ['ray-of-sickness'],
    },
    featuresByLevel: {
      1: ['arcane-recovery'],
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
    // 2024 rogue: simple weapons plus martial weapons with Finesse or Light.
    weaponProfs: { simple: true, martial: false, finesseLight: true },
    skillProfs: ['stealth', 'sleight-of-hand', 'deception', 'perception'],
    statPriority: ['dex', 'con', 'int', 'wis', 'cha', 'str'],
    featuresByLevel: {
      7: ['evasion'],
      1: ['sneak-attack'],
      2: ['cunning-dash', 'cunning-disengage', 'cunning-hide'],
      // Thief, not Assassin. Assassinate is in neither the 2014 nor the 2024
      // SRD — the SRD's only rogue subclass is the Thief, whose level-3
      // features are Fast Hands and Second-Story Work. The second is a climb
      // speed and a jump rule, neither of which exists on this grid.
      3: ['fast-hands', 'steady-aim'],
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
  /**
   * Bard: a Charisma full caster whose real resource is not spell slots but a
   * handful of d6s. Bardic Inspiration hands one to an ally; Cutting Words
   * spends one to spoil an enemy's hit. Same pool, opposite directions, and
   * choosing between them every round is the class.
   *
   * Light armour, simple weapons and d8 hit points, so it wants to stand behind
   * someone — but Vicious Mockery is a 60 ft cantrip and Bardic Inspiration
   * reaches 60 ft too, which is exactly where it should be standing anyway.
   */
  bard: {
    id: 'bard', name: 'Bard', hitDie: 8,
    savingThrows: ['dex', 'cha'],
    armorProfs: ['light'],
    weaponProfs: { simple: true, martial: false },
    skillProfs: ['performance', 'persuasion'],
    statPriority: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
    spellcasting: {
      ability: 'cha',
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2]],
      cantripsKnownByLevel: [2, 2, 2, 3, 3, 3, 3, 3],
      // A bard prepares from the whole list like a cleric rather than keeping a
      // spellbook, so only the prepared count is capped.
      preparedByLevel: [4, 5, 6, 7, 9, 10, 11, 12],
      spellsByLevel: {
        // Strongest first within each level — see spellsByLevel's note.
        1: ['vicious-mockery', 'starry-wisp', 'minor-illusion', 'true-strike', 'sleep', 'healing-word', 'command',
            'cure-wounds', 'faerie-fire', 'color-spray', 'thunderwave', 'bane', 'animal-friendship'],
        3: ['hold-person', 'shatter', 'mirror-image', 'silence', 'invisibility', 'suggestion', 'blindness', 'aid', 'lesser-restoration'],
        5: ['fear', 'mass-healing-word', 'bestow-curse', 'dispel-magic'], // 3rd-level slots
        // Magical Discoveries (6): two spells from off the bard's own list.
        // Written here rather than through new machinery because this table is
        // already "what this class can have, and when".
        6: ['fireball', 'spiritual-weapon'],
        7: ['greater-invisibility', 'confusion', 'dimension-door', 'freedom-of-movement', 'phantasmal-killer'],
      },
    },
    featuresByLevel: {
      7: ['countercharm'],
      1: ['bardic-inspiration'],
      2: ['expertise', 'jack-of-all-trades'],
      3: ['cutting-words'], // College of Lore
      6: ['magical-discoveries'], // College of Lore: two spells from any list
      // 4: Ability Score Increase (builder).
      // 5: Font of Inspiration — regaining uses on a short rest, which this
      //    engine already does for every per-encounter pool. Left off rather
      //    than invented into something it isn't.
    },
    weaponMasteries: [],
    equipment: {
      // Simple weapons only in the 2024 rules — the rapier a bard traditionally
      // carries is martial, and handing one over would mean a class whose
      // default weapon it is not trained with.
      mainHand: 'dagger', armor: 'leather',
      inventory: [
        { itemId: 'light-crossbow', qty: 1 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
  /**
   * Druid: a Wisdom full caster who can stop being a caster. Wild Shape trades
   * the whole spell list for a beast's body and its attacks, which is a real
   * decision rather than a buff — a shaped druid is a second front-liner with
   * no way to heal anyone.
   *
   * The 2024 shape keeps your hit points, so the trade is genuinely "AC, speed
   * and teeth versus everything I can cast", not a second health bar.
   */
  druid: {
    id: 'druid', name: 'Druid', hitDie: 8,
    savingThrows: ['int', 'wis'],
    // Primal Order: Warden. The 2024 druid picks Magician or Warden at level 1;
    // Warden grants Martial weapon proficiency and Medium armour training, and
    // it is the default here because the alternative (an extra cantrip) leaves a
    // d8 caster in leather with a quarterstaff, which is not a class anybody
    // wants to field. Magician is not offered as a choice yet.
    armorProfs: ['light', 'medium', 'shield'],
    weaponProfs: { simple: true, martial: true },
    skillProfs: ['nature', 'animal-handling'],
    statPriority: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
    spellcasting: {
      ability: 'wis',
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2]],
      cantripsKnownByLevel: [2, 2, 2, 3, 3, 3, 3, 3],
      preparedByLevel: [4, 5, 6, 7, 9, 10, 11, 12],
      spellsByLevel: {
        // Strongest first within each level — see spellsByLevel's note.
        // Starry Wisp is on the SRD druid list. The markdown conversion this
        // was checked against dropped the druid's cantrip table row entirely,
        // twice, which read as an absence — confirmed present against the real
        // document.
        1: ['starry-wisp', 'poison-spray', 'shillelagh', 'guidance', 'entangle',
            'cure-wounds', 'healing-word', 'faerie-fire', 'thunderwave',
            'protection-from-evil-and-good', 'animal-friendship'],
        // Wild Companion (level 2): the 2024 druid spends a Wild Shape use to
        // conjure a familiar. Modelled as the ritual the wizard gets, arriving
        // with Wild Shape itself — a ritual is always known and costs no slot,
        // which is the same "free, once you have it" shape.
        2: ['find-familiar'],
        3: ['moonbeam', 'pass-without-trace', 'hold-person', 'flaming-sphere', 'heat-metal', 'aid', 'lesser-restoration'],
        5: ['call-lightning', 'conjure-animals', 'protection-from-energy', 'dispel-magic'], // 3rd-level slots
        7: ['wall-of-fire', 'confusion', 'freedom-of-movement', 'blight', 'ice-storm', 'polymorph'],
      },
    },
    featuresByLevel: {
      3: ['lands-aid'],            // Circle of the Land
      6: ['natural-recovery'],     // Circle of the Land, and SRD-placed at 6 — not 2
      7: ['potent-spellcasting'],   // Elemental Fury, taken as Potent Spellcasting
      1: [],   // Druidic and Primal Order are flavour and skills, not grid rules
      2: ['wild-shape'],
      // 3: Circle of the Land — its feature is extra *prepared spells* by land
      //    type, which needs a build choice this class does not have yet.
      // 5: Wild Resurgence — trades a spell slot for a Wild Shape use out of
      //    combat; nothing on the grid to hang it on.
    },
    weaponMasteries: [],
    equipment: {
      // Warden's medium armour, and the staff stays in hand — Shillelagh makes
      // it the best weapon a druid owns (Wisdom to hit, a d10 by level 5), so a
      // martial weapon in its place would be a downgrade.
      mainHand: 'quarterstaff', offHand: 'shield', armor: 'scale-mail',
      inventory: [
        { itemId: 'sling', qty: 1 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
  ranger: {
    id: 'ranger', name: 'Ranger', hitDie: 10,
    savingThrows: ['str', 'dex'],
    armorProfs: ['light', 'medium', 'shield'],
    weaponProfs: { simple: true, martial: true },
    skillProfs: ['stealth', 'perception', 'survival'],
    statPriority: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
    // 2024 half-caster progression: slots from 1st level, second-level slots
    // arrive at 5th alongside Extra Attack.
    spellcasting: {
      ability: 'wis',
      slotsByLevel: [[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3]],
      spellsByLevel: {
        1: ['hunters-mark', 'cure-wounds', 'animal-friendship', 'ensnaring-strike'],
        // Misty Step used to sit here. It is a wizard spell — it has never been
        // on the ranger's list, in the SRD or anywhere else — so it is gone,
        // and Ensnaring Strike (which is on the list, and is the ranger's own
        // signature opener) takes over as the interesting thing to spend a
        // slot on.
        5: ['aid', 'lesser-restoration'], // 2nd-level slot arrives here
      },
    },
    featuresByLevel: {
      7: ['escape-the-horde'],
      6: ['roving'],
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
  /**
   * The barbarian.
   *
   * Cheapest class left to add, and not by accident: it casts nothing, so the
   * whole spell-preparation apparatus is untouched, and its art already ships
   * (`orc-barbarian`, `dwarf-berserker`). What it needed was a resource clock
   * that survives a fight, which is why the rest-scoping landed first — rage
   * lasts the whole fight, so a per-encounter pool would refill before it was
   * ever empty and the count that paces the class would be decoration.
   *
   * NO ARMOUR IN THE STARTING KIT, deliberately. Unarmored Defense is 10 + Dex
   * + Con, which beats hide and matches chain mail for a barbarian's stat
   * spread — hand it armour at level 1 and the feature is dead data the player
   * never meets. The shield is left off for the same reason a greataxe is the
   * main hand: two-handed damage is what rage multiplies.
   */
  barbarian: {
    id: 'barbarian', name: 'Barbarian', hitDie: 12,
    savingThrows: ['str', 'con'],
    // Light and medium only — and the class is built never to wear either.
    armorProfs: ['light', 'medium', 'shield'],
    weaponProfs: { simple: true, martial: true },
    skillProfs: ['athletics', 'survival'],
    statPriority: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
    featuresByLevel: {
      1: ['rage', 'unarmored-defense'],
      2: ['reckless-attack', 'danger-sense'],
      3: ['frenzy'],            // Berserker, the SRD's barbarian subclass
      // 4: Ability Score Increase (applied in the builder, not a feature).
      5: ['extra-attack', 'fast-movement'],
      6: ['mindless-rage'],     // Berserker
      7: ['feral-instinct'],
    },
    weaponMasteries: ['greataxe', 'handaxe', 'javelin'],
    equipment: {
      mainHand: 'greataxe',
      inventory: [
        { itemId: 'handaxe', qty: 2 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
  /**
   * The monk.
   *
   * Could not have been built before feature pools got clocks. Focus Points are
   * a per-level pool that comes back on a SHORT rest, and every technique the
   * class has spends from it — a pool that refilled every fight would have made
   * Flurry of Blows a free bonus action forever, which is the whole class.
   *
   * NO ARMOUR AND NO SHIELD, deliberately, the same way the barbarian carries
   * none: Unarmored Defense is 10 + Dex + Wis and a shield switches it off
   * outright. The quarterstaff is in hand for reach and for the bigger die when
   * a fist will not do, but the fist is the class.
   */
  monk: {
    id: 'monk', name: 'Monk', hitDie: 8,
    savingThrows: ['str', 'dex'],
    armorProfs: [],
    weaponProfs: { simple: true, martial: false },
    skillProfs: ['acrobatics', 'stealth'],
    statPriority: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
    featuresByLevel: {
      1: ['martial-arts', 'monk-defense'],
      2: ['monks-focus', 'flurry-of-blows', 'patient-defense', 'step-of-the-wind'],
      3: ['deflect-attacks', 'open-hand-technique'],   // Warrior of the Open Hand
      // 4: Ability Score Increase (builder). Slow Fall has no cliff to fall off.
      5: ['extra-attack', 'stunning-strike'],
      6: ['empowered-strikes'],
      7: ['evasion'],
    },
    weaponMasteries: ['quarterstaff'],
    equipment: {
      mainHand: 'quarterstaff',
      inventory: [
        { itemId: 'dagger', qty: 2 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
  paladin: {
    id: 'paladin', name: 'Paladin', hitDie: 10,
    savingThrows: ['wis', 'cha'],
    armorProfs: ['light', 'medium', 'heavy', 'shield'],
    weaponProfs: { simple: true, martial: true },
    skillProfs: ['athletics', 'intimidation'],
    statPriority: ['str', 'cha', 'con', 'wis', 'dex', 'int'],
    // Same half-caster progression as the Ranger; the spell list is support
    // and control, since Divine Smite is the class's real damage engine.
    spellcasting: {
      ability: 'cha',
      slotsByLevel: [[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3]],
      spellsByLevel: {
        1: ['bless', 'cure-wounds', 'command'],
        // The smite arrives with Divine Smite itself, alongside the wards that
        // make a paladin the party's shield rather than a second fighter.
        // Thunderous and Wrathful Smite used to be here; both are 2014 spells
        // that the SRD 5.2 paladin list does not carry, so Shining Smite (which
        // it does) is the second smite instead.
        2: ['searing-smite', 'shield-of-faith', 'protection-from-evil-and-good'],
        5: ['aid', 'shining-smite', 'lesser-restoration', 'warding-bond'], // 2nd-level slot arrives here
      },
    },
    featuresByLevel: {
      7: ['aura-of-devotion'],
      6: ['aura-of-protection'],
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

/** Every spell a class can cast from a scroll: its full list plus any
 *  learnable-extra spells (2024: you can use a spell scroll if the spell is on
 *  your class's list). Non-casters return an empty set — no scrolls for them. */
export function classScrollPool(classId: Id): Set<Id> {
  const sc = CLASSES[classId]?.spellcasting;
  const ids = new Set<Id>();
  if (!sc) return ids;
  for (const list of Object.values(sc.spellsByLevel)) for (const id of list) ids.add(id);
  for (const id of sc.learnableExtra ?? []) ids.add(id);
  return ids;
}
