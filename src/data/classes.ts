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

/**
 * A named way to build a class: which abilities it wants, what it starts
 * holding, and what it has weapon mastery with.
 *
 * WHY ALL THREE TOGETHER, AND WHY NOT JUST STATS
 *
 * "Let me play a Dexterity fighter" sounds like a stat question and is not.
 * Move a fighter's 16 from Strength to Dexterity today and three separate
 * things quietly refuse to follow:
 *
 *   - the longsword is not a finesse weapon, so `attackAbility` keeps reading
 *     Strength and the attack bonus simply drops;
 *   - scale mail is medium armour, so the Dexterity bonus to AC caps at +2 and
 *     nothing above 14 Dex buys anything;
 *   - the weapon masteries are the literal ids `longsword`/`javelin`, so a
 *     rapier would have no mastery at all.
 *
 * The character would be strictly worse and the player would have no way to
 * see why. So a kit moves the stats and the kit together or it is not offered.
 * (The same fact was already written down, in `campaign.ts`, as the reason the
 * Quick Start shelf never picks Archery or Two-Weapon Fighting: the styles are
 * there but the starting gear cannot fire them.)
 *
 * Every mechanical field is optional and falls back to the class's own — so a
 * kit list can name the class's existing build without restating it, and the
 * two can never drift apart.
 */
export interface ClassKit {
  id: Id;
  name: string;
  blurb: string;
  statPriority?: readonly Ability[];
  weaponMasteries?: Id[];
  equipment?: ClassData['equipment'];
  /**
   * Default picks for this class's choice points — in practice, the Fighting
   * Style the kit's weapons can actually fire.
   *
   * A choice point has ONE default for the whole class, and that was wrong the
   * moment kits existed: the fighter's second Fighting Style at 7th defaulted to
   * Great Weapon Fighting, which rerolls damage dice on TWO-HANDED weapons, on a
   * class whose starting kit is a longsword and a shield. Every sword-and-board
   * fighter in the game reached 7th level and gained nothing at all.
   *
   * The player still overrides freely; this only moves what "I didn't choose"
   * means, from a class-wide guess to one the kit can back up.
   */
  choices?: Record<Id, Id>;
}

/** The fields a kit can override, resolved against the class. */
export function kitFor(cls: ClassData, kitId: Id | undefined): {
  statPriority: readonly Ability[];
  weaponMasteries: Id[];
  equipment: ClassData['equipment'];
  choices: Record<Id, Id>;
} {
  // Falls back to the FIRST kit, not to none: a class that offers kits names
  // its own default as kits[0], so an unset id and the default id agree.
  const k = cls.kits?.find((x) => x.id === kitId) ?? cls.kits?.[0];
  return {
    statPriority: k?.statPriority ?? cls.statPriority,
    weaponMasteries: k?.weaponMasteries ?? cls.weaponMasteries,
    equipment: k?.equipment ?? cls.equipment,
    choices: k?.choices ?? {},
  };
}

/** The kit a class starts on when nobody has chosen — `undefined` if it offers none. */
export function defaultKitId(cls: ClassData): Id | undefined {
  return cls.kits?.[0]?.id;
}

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
  /**
   * Alternate builds, if this class has more than one shape worth playing.
   * `kits[0]` names the class's own default and overrides nothing. Omitted by
   * every class whose kit is not a real decision — a rogue is already Dexterous
   * and a barbarian in studded leather is a worse barbarian, not a different one.
   */
  kits?: ClassKit[];
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
    kits: [
      {
        id: 'martial', name: 'Martial',
        blurb: 'Strength, longsword and shield, scale mail. The soldier.',
        // Defense, not the class-wide Great Weapon Fighting: this kit has no
        // two-handed weapon, so that default was worth precisely nothing.
        choices: { 'fighting-style': 'dueling', 'fighting-style-2': 'defense' },
      },
      {
        /**
         * The Dexterity fighter — the reason kits exist at all.
         *
         * Everything about it is a consequence of moving the primary stat:
         * the rapier because it is the finesse weapon that still deals a d8
         * one-handed (so Dueling, the class's default Fighting Style, keeps
         * firing and the damage per swing does not move); studded leather
         * because light armour is the only kind that pays out an unbounded
         * Dexterity bonus; daggers instead of javelins because a thrown
         * javelin is a Strength attack.
         *
         * PLAIN LEATHER, AND WHY NOT STUDDED. Studded leather was the first
         * try and it made the kit strictly better: the Martial fighter's
         * Dexterity is 13, not 14, so 12+3+2 ties its 14+1+2 at first level and
         * then pulls ahead at every ability increase, since scale mail's +2 cap
         * means the soldier's own increases buy it no armour class at all.
         * Leather instead gives an arc rather than a free lunch — one AC behind
         * at 1st, level at 4th, one ahead at 8th — with studded leather in the
         * shop for 45gp as something worth saving for. (That last part was not
         * true when this kit was written: studded leather was on no ware list at
         * all and could not be bought by anyone. See ALL_WARES in campaign.ts.)
         *
         * WHAT IT TRADES. It gives up Strength: a worse Shove DC, Athletics,
         * Strength saves, and 20/60 thrown range instead of the javelin's
         * 30/120. It buys initiative, Dexterity saves, and — because leather
         * has no stealth penalty and scale mail does — the party's creep check.
         */
        id: 'duelist', name: 'Duelist',
        blurb: 'Dexterity, rapier and shield, leather. Quick, quiet, and lightly armoured.',
        statPriority: ['dex', 'con', 'str', 'wis', 'int', 'cha'],
        weaponMasteries: ['rapier', 'rapier-plus1', 'dagger'],
        equipment: {
          mainHand: 'rapier', offHand: 'shield', armor: 'leather',
          inventory: [
            { itemId: 'dagger', qty: 2 },
            { itemId: 'potion-healing', qty: 1 },
            { itemId: 'alchemists-fire', qty: 1 },
          ],
        },
        choices: { 'fighting-style': 'dueling', 'fighting-style-2': 'defense' },
      },
      {
        /**
         * The bow fighter. Archery (+2 to hit with ranged weapons) was in the
         * Fighting Style list from the beginning and no fighter has ever been
         * able to use it, because the class starts with a longsword.
         *
         * No shield: a longbow is two-handed. That is the whole cost — AC 15
         * against the Martial fighter's 17 — and it is the right cost for a
         * character whose plan is to not be reached.
         */
        id: 'archer', name: 'Archer',
        blurb: 'Dexterity, longbow, studded leather. Hits hardest from across the board.',
        statPriority: ['dex', 'con', 'str', 'wis', 'int', 'cha'],
        weaponMasteries: ['longbow', 'longbow-plus1', 'shortsword'],
        equipment: {
          mainHand: 'longbow', armor: 'studded-leather',
          inventory: [
            // Something to hold when a bow is the wrong answer: finesse, so it
            // swings off the same Dexterity.
            { itemId: 'shortsword', qty: 1 },
            { itemId: 'potion-healing', qty: 1 },
            { itemId: 'alchemists-fire', qty: 1 },
          ],
        },
        choices: { 'fighting-style': 'archery', 'fighting-style-2': 'defense' },
      },
      {
        /**
         * Two hands on one big sword. 2d6 against the longsword's 1d8, Great
         * Weapon Fighting rerolling the 1s and 2s, and Graze mastery so a miss
         * still lands the ability modifier — a fighter that trades the shield
         * for the certainty that the turn was not wasted.
         */
        id: 'greatweapon', name: 'Great Weapon',
        blurb: 'Strength, greatsword, scale mail. Two hands, no shield, more damage.',
        weaponMasteries: ['greatsword', 'greatsword-plus1', 'javelin'],
        equipment: {
          mainHand: 'greatsword', armor: 'scale-mail',
          inventory: [
            { itemId: 'javelin', qty: 2 },
            { itemId: 'potion-healing', qty: 1 },
            { itemId: 'alchemists-fire', qty: 1 },
          ],
        },
        choices: { 'fighting-style': 'great-weapon-fighting', 'fighting-style-2': 'defense' },
      },
      {
        /**
         * A blade in each hand. Two-Weapon Fighting adds the ability modifier
         * to the off-hand blow, which is most of what makes the second attack
         * worth the bonus action at all, and Nick (the dagger's mastery) is the
         * property that makes the off-hand swing free.
         */
        id: 'twoblade', name: 'Two Blades',
        blurb: 'Dexterity, a shortsword in each hand, studded leather. More swings, less armour.',
        statPriority: ['dex', 'con', 'str', 'wis', 'int', 'cha'],
        weaponMasteries: ['shortsword', 'shortsword-plus1', 'dagger'],
        equipment: {
          mainHand: 'shortsword', offHand: 'shortsword', armor: 'studded-leather',
          inventory: [
            { itemId: 'dagger', qty: 2 },
            { itemId: 'potion-healing', qty: 1 },
            { itemId: 'alchemists-fire', qty: 1 },
          ],
        },
        choices: { 'fighting-style': 'two-weapon-fighting', 'fighting-style-2': 'defense' },
      },
    ],
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
  /**
   * The Warlock. Pact Magic is the whole of it.
   *
   * Two slots, always at the caster's highest tier, back on every short rest —
   * against a wizard's many that only come back at dawn. The arena runs two
   * fights a day with a short rest between, which is exactly the rhythm this
   * class is built for: a wizard walks into the afternoon depleted and a
   * warlock walks in full.
   *
   * The consequence is that a warlock casts CANTRIPS most turns, which is why
   * Eldritch Blast has to be good, and why Agonizing Blast is the invocation
   * every warlock takes. It is written in here at 2 rather than offered as a
   * choice: this game has no invocation-picking screen, and a warlock without
   * it is a warlock that does not work.
   *
   * The gapped slot table (`[0, 0, 2]` and so on) is exactly the shape that
   * `legalActions` could not cast from until the slot-payment fix -- a spell
   * whose own tier is empty now finds the lowest slot that can pay for it.
   */
  warlock: {
    id: 'warlock', name: 'Warlock', hitDie: 8,
    savingThrows: ['wis', 'cha'],
    armorProfs: ['light'],
    weaponProfs: { simple: true, martial: false },
    skillProfs: ['arcana', 'deception'],
    statPriority: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
    spellcasting: {
      ability: 'cha',
      // Pact Magic: the count never grows past two inside this game's levels,
      // and the TIER is what climbs. The zeros are the point — a level-7
      // warlock holds two 4th-level slots and nothing at all below them.
      slotsByLevel: [[1], [2], [0, 2], [0, 2], [0, 0, 2], [0, 0, 2], [0, 0, 0, 2], [0, 0, 0, 2]],
      // SRD row: 2 2 2 3 3 3 3 3. The 8th entry read 4 in the first draft.
      cantripsKnownByLevel: [2, 2, 2, 3, 3, 3, 3, 3],
      // A warlock knows a short list and has them all ready; there is no
      // preparing and unpreparing. Capped low to match.
      preparedByLevel: [2, 3, 4, 5, 6, 7, 8, 9],
      // Strongest first within each level — see spellsByLevel's note.
      //
      // Shorter than the other casters' lists, and deliberately not padded. The
      // first draft reached for Vicious Mockery, Sleep, Fireball and Confusion
      // because they are good and this class looked thin without them; the SRD
      // list check rejected every one. A warlock is not a wizard with fewer
      // slots — it has no Fireball and no healing at all, and the class works
      // because Eldritch Blast is a cantrip it can throw every single turn.
      spellsByLevel: {
        // Hex first: it is the warlock's damage plan, and the SRD itself
        // recommends it as one of the two spells a warlock starts with.
        1: ['eldritch-blast', 'hex', 'poison-spray', 'true-strike', 'minor-illusion',
            'bane', 'protection-from-evil-and-good'],
        3: ['hold-person', 'mirror-image', 'invisibility', 'suggestion', 'misty-step'],
        5: ['fear', 'counterspell', 'dispel-magic'],   // 3rd-level slots
        7: ['banishment', 'blight', 'dimension-door'],
      },
    },
    /**
     * Eldritch Invocations, as choices.
     *
     * The SRD's own table grants 1 invocation at level 1, 3 by level 2, 5 by
     * level 5 and 6 by level 7. The first version of this class granted exactly
     * ONE, hard-coded — about a sixth of the feature, and the invocations are
     * where most of a warlock's power budget lives. It measured as the
     * lowest-damage non-support class, which read as a design trade and was a
     * missing feature.
     *
     * Four choice points rather than six, because only so many invocations have
     * any expression in a game with no exploration, no vertical space and no
     * pact weapon: Eldritch Spear extends a range nothing on an eight-cell
     * board can exceed, Devil's Sight needs a Darkness that does not exist yet,
     * and Thirsting Blade, Lifedrinker and Devouring Blade all hang off Pact of
     * the Blade. Four real ones beat six where two do nothing.
     *
     * The slates overlap deliberately, so every point offers something worth
     * having rather than a forced pick from what is left. Taking the same
     * invocation twice is possible and harmless — they are all idempotent
     * flags, so the second pick simply buys nothing, which is the same thing
     * the SRD's "you can't pick it twice" rule achieves without a cross-point
     * validation the choice machinery cannot express.
     *
     * Every default is the strongest option, so a player who never opens the
     * screen still gets a working warlock.
     */
    choices: [{
      id: 'invocation-1', label: 'Eldritch Invocation', atLevel: 1, default: 'agonizing-blast',
      options: [
        { id: 'agonizing-blast', name: 'Agonizing Blast', blurb: 'Add your Charisma to every beam of Eldritch Blast.', grants: { featureIds: ['agonizing-blast'] } },
        { id: 'armor-of-shadows', name: 'Armor of Shadows', blurb: 'Mage Armor on yourself, always, for free.', grants: { featureIds: ['armor-of-shadows'] } },
        { id: 'fiendish-vigor', name: 'Fiendish Vigor', blurb: 'Start every fight with False Life already up.', grants: { featureIds: ['fiendish-vigor'] } },
      ],
    }, {
      id: 'invocation-2', label: 'Eldritch Invocation (2nd)', atLevel: 2, default: 'repelling-blast',
      options: [
        { id: 'repelling-blast', name: 'Repelling Blast', blurb: 'Each beam of Eldritch Blast shoves its target 10 ft.', grants: { featureIds: ['repelling-blast'] } },
        { id: 'fiendish-vigor', name: 'Fiendish Vigor', blurb: 'Start every fight with False Life already up.', grants: { featureIds: ['fiendish-vigor'] } },
        { id: 'armor-of-shadows', name: 'Armor of Shadows', blurb: 'Mage Armor on yourself, always, for free.', grants: { featureIds: ['armor-of-shadows'] } },
      ],
    }, {
      id: 'invocation-3', label: 'Eldritch Invocation (3rd)', atLevel: 5, default: 'fiendish-vigor',
      options: [
        { id: 'fiendish-vigor', name: 'Fiendish Vigor', blurb: 'Start every fight with False Life already up.', grants: { featureIds: ['fiendish-vigor'] } },
        { id: 'armor-of-shadows', name: 'Armor of Shadows', blurb: 'Mage Armor on yourself, always, for free.', grants: { featureIds: ['armor-of-shadows'] } },
        { id: 'repelling-blast', name: 'Repelling Blast', blurb: 'Each beam of Eldritch Blast shoves its target 10 ft.', grants: { featureIds: ['repelling-blast'] } },
      ],
    }, {
      id: 'invocation-4', label: 'Eldritch Invocation (4th)', atLevel: 7, default: 'gift-of-the-protectors',
      options: [
        { id: 'gift-of-the-protectors', name: 'Gift of the Protectors', blurb: 'Once a rest, an ally who would drop to 0 is left on 1 instead.', grants: { featureIds: ['gift-of-the-protectors'] } },
        { id: 'armor-of-shadows', name: 'Armor of Shadows', blurb: 'Mage Armor on yourself, always, for free.', grants: { featureIds: ['armor-of-shadows'] } },
        { id: 'repelling-blast', name: 'Repelling Blast', blurb: 'Each beam of Eldritch Blast shoves its target 10 ft.', grants: { featureIds: ['repelling-blast'] } },
      ],
    }],
    featuresByLevel: {
      // Pact of the Tome is an invocation rather than a level feature, granted
      // outright here because this game has no invocation picker deep enough to
      // offer it alongside the four that are choices — and a warlock without a
      // pact boon is missing the most recognisable thing about the class.
      1: ['pact-magic', 'eldritch-invocations', 'pact-of-the-tome'],
      // Magical Cunning, reshaped: the SRD's minute-long rite returns half the
      // pact slots once per long rest, and a minute is ten rounds — longer than
      // most fights here, and the arena already short-rests between the day's
      // two fights, which refills everything. As printed it would do nothing at
      // all. As an action for one slot, in the fight, it is the same resource
      // somewhere it can matter.
      2: ['magical-cunning'],
      3: ['dark-ones-blessing', 'fiend-spells'],   // Fiend patron
      // 4: Ability Score Increase (builder).
      // 5: a second Eldritch Blast beam, which the spell reads off level.
      // 6: Dark One's Own Luck adds a d10 to an ability check or save. This
      //    game rolls neither outside combat saves, where the feature would be
      //    a once-a-rest +d10 nobody chooses to spend — left off rather than
      //    invented into something it is not, the same call the bard's Font of
      //    Inspiration got.
    },
    weaponMasteries: [],
    equipment: {
      mainHand: 'dagger', armor: 'leather',
      inventory: [
        { itemId: 'light-crossbow', qty: 1 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
  /**
   * The sorcerer: a wizard's slot table and a wizard's spell list, spent
   * differently.
   *
   * That is the honest summary of the class in a game this size, and it is why
   * the class has to bring Metamagic to be worth adding at all. Its spell list
   * is a subset of the wizard's here — the two spells that would have
   * distinguished it (Sorcerous Burst, Chromatic Orb) do not exist in this
   * codebase, and Find Familiar, Sleep-adjacent utility and the whole ritual
   * half of the wizard's book are things the sorcerer does NOT get. What it
   * gets instead is sorcery points.
   *
   * Charisma, d6, no armour: the squishiest caster in the game, which the
   * arena's opening rounds will notice.
   *
   * The spell list below was transcribed from the SRD's Sorcerer Spell List and
   * then intersected with what this game implements — 41 of them, which is why
   * this class needed no new spells. Nothing was added because it looked good
   * on a sorcerer; the same check that rejected four spells off the warlock
   * (test/srd-spell-lists.test.ts) holds this list too, and Phantasmal Killer,
   * Bane and Find Familiar are all absent from it for that reason.
   */
  sorcerer: {
    id: 'sorcerer', name: 'Sorcerer', hitDie: 6,
    savingThrows: ['con', 'cha'],
    armorProfs: [],
    weaponProfs: { simple: true, martial: false },
    skillProfs: ['arcana', 'persuasion'],
    statPriority: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
    spellcasting: {
      ability: 'cha',
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2]],
      // SRD: four at level 1, a fifth at 4, a sixth at 10 (past this cap).
      cantripsKnownByLevel: [4, 4, 4, 5, 5, 5, 5, 5],
      preparedByLevel: [2, 4, 6, 7, 9, 10, 11, 12],
      spellsByLevel: {
        1: [
          'fire-bolt', 'ray-of-frost', 'shocking-grasp', 'poison-spray', 'acid-splash',
          'true-strike', 'minor-illusion',
          'magic-missile', 'burning-hands', 'shield', 'mage-armor', 'sleep', 'color-spray',
          'false-life', 'thunderwave', 'ray-of-sickness',
        ],
        3: ['scorching-ray', 'mirror-image', 'misty-step', 'web', 'invisibility', 'blindness',
            'shatter', 'suggestion', 'hold-person', 'flaming-sphere'],
        5: ['fireball', 'counterspell', 'fear', 'lightning-bolt', 'haste', 'dispel-magic',
            'protection-from-energy'],
        7: ['polymorph', 'greater-invisibility', 'banishment', 'confusion', 'blight',
            'ice-storm', 'wall-of-fire', 'dimension-door'],
      },
    },
    featuresByLevel: {
      // Level 1 is Spellcasting and nothing else — the SRD gives a sorcerer no
      // level-1 feature beyond its spells, and Innate Sorcery (also level 1)
      // waits for its own change rather than being guessed at now.
      2: ['font-of-magic', 'metamagic-quickened', 'metamagic-heightened'],
      // Draconic Sorcery, the SRD's only sorcerer subclass. Scales for armour
      // and a hit point a level, which is what makes a d6 caster survivable
      // enough to spend its points instead of hiding.
      //
      // Elemental Affinity (level 6) is deliberately absent: it is resistance
      // plus a Charisma bonus on one damage roll of a matching spell, and the
      // second half needs a hook in the damage pipeline that nothing else in
      // the game wants. It belongs with the rest of the subclass rather than
      // wedged in here.
      3: ['draconic-resilience', 'draconic-spells'],
      // 4: Ability Score Increase (builder).
    },
    weaponMasteries: [],
    equipment: {
      // Spear and daggers, per the SRD's option A. The daggers are what
      // actually get thrown; the spear is the thing in hand when something
      // closes, which for a d6 caster with no armour happens more than it
      // should.
      mainHand: 'dagger', offHand: 'dagger',
      inventory: [
        { itemId: 'spear', qty: 1 },
        { itemId: 'potion-healing', qty: 1 },
      ],
    },
  },
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
    kits: [
      { id: 'hunter', name: 'Hunter', blurb: 'Longbow and studded leather. Kills things before they arrive.',
        choices: { 'fighting-style': 'archery' } },
      {
        /**
         * The close-quarters ranger. Two-Weapon Fighting is on the ranger's
         * style list and the class starts with a bow in its hands, so the option
         * was there and nothing could fire it — the shortswords were sitting in
         * the pack the whole time.
         */
        id: 'skirmisher', name: 'Skirmisher',
        blurb: 'A shortsword in each hand. Fights up close instead of across the board.',
        weaponMasteries: ['shortsword', 'shortsword-plus1', 'longbow'],
        equipment: {
          mainHand: 'shortsword', offHand: 'shortsword', armor: 'studded-leather',
          inventory: [
            { itemId: 'longbow', qty: 1 },
            { itemId: 'potion-healing', qty: 1 },
          ],
        },
        choices: { 'fighting-style': 'two-weapon-fighting' },
      },
    ],
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
    kits: [
      { id: 'templar', name: 'Templar', blurb: 'Longsword, shield and chain mail. The wall the party stands behind.',
        choices: { 'fighting-style': 'defense' } },
      {
        /**
         * Great Weapon Fighting is on the paladin's style list and the class
         * starts sword-and-board, so — as with the fighter and the ranger — the
         * option existed and no paladin could ever use it.
         *
         * A two-handed paladin is also the one that most wants Divine Smite:
         * the smite rides on a hit, so fewer, larger hits are worth more of the
         * slot than more, smaller ones.
         */
        id: 'crusader', name: 'Crusader',
        blurb: 'Greatsword and chain mail. Trades the shield for something to smite with.',
        weaponMasteries: ['greatsword', 'greatsword-plus1', 'javelin'],
        equipment: {
          mainHand: 'greatsword', armor: 'chain-mail',
          inventory: [
            { itemId: 'javelin', qty: 2 },
            { itemId: 'potion-healing', qty: 1 },
          ],
        },
        choices: { 'fighting-style': 'great-weapon-fighting' },
      },
    ],
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
