/**
 * Monster stat blocks (SRD 5.2.1, simplified) and encounter definitions.
 * A monster is data through the same Combatant shape as a character; attack
 * bonuses derive from abilities + proficiency exactly like PCs (the stat
 * blocks below reproduce the SRD's printed bonuses at PB +2).
 */
import type { Combatant, TeamId, Position, AbilityScores, Ability, DamageType, Id, ResourcePool, CreatureType } from '../engine/types.js';
import { proficiencyBonus } from '../engine/types.js';
import { FEATURES } from './features.js';

export interface MonsterData {
  id: Id;
  name: string;
  ac: number;
  /** Challenge Rating. Drives proficiency bonus for to-hit and save DCs.
   *  Omit for CR <= 4 (PB +2, the default). */
  cr?: number;
  hp: number; // average from the stat block
  speed: number;
  abilities: AbilityScores;
  savingThrowProfs?: Ability[];
  featureIds?: Id[];
  weaponIds: Id[];         // first = main hand; rest carried (free-swap to use)
  metalArmor?: boolean;    // Shocking Grasp rider; AC itself is the flat stat
  attacksPerAction?: number;
  resistances?: DamageType[];
  vulnerabilities?: DamageType[];
  immunities?: DamageType[];
  /** Caster monsters reuse the spell system (acolyte, cult fanatic, ...). */
  spellcasting?: { ability: Ability; slots: number[]; spellIds: Id[] };
  /** SRD creature type. Beast is the load-bearing one today -- Animal
   *  Friendship needs to tell a wolf from a goblin. */
  creatureType: CreatureType;
  /** Regeneration (troll): heals at the start of its turn unless it has taken
   *  one of `stoppedBy` damage types since the last one. */
  regeneration?: { amount: number; stoppedBy: DamageType[] };
}

export const MONSTERS: Record<Id, MonsterData> = {
  'goblin-warrior': {
    id: 'goblin-warrior', name: 'Goblin Warrior',
    ac: 15, hp: 10, speed: 30,
    // Fey since the 2024 rules, not humanoid -- goblinoids are folklore
    // tricksters from the Feywild rather than another mortal people.
    creatureType: 'fey',
    abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
    featureIds: ['nimble-escape', 'nimble-hide'],
    weaponIds: ['goblin-scimitar', 'goblin-shortbow'],
  },
  'goblin-boss': {
    id: 'goblin-boss', name: 'Goblin Boss',
    ac: 17, hp: 21, speed: 30,
    creatureType: 'fey',
    abilities: { str: 10, dex: 15, con: 10, int: 10, wis: 8, cha: 10 },
    featureIds: ['nimble-escape', 'nimble-hide'],
    weaponIds: ['goblin-scimitar', 'goblin-shortbow'],
    metalArmor: true, // chain shirt
    attacksPerAction: 2,
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton',
    ac: 14, hp: 13, speed: 30,
    creatureType: 'undead',
    abilities: { str: 10, dex: 16, con: 15, int: 6, wis: 8, cha: 5 },
    weaponIds: ['shortsword', 'shortbow'],
    metalArmor: false,
    vulnerabilities: ['bludgeoning'],
    immunities: ['poison'],
  },
  wolf: {
    id: 'wolf', name: 'Wolf',
    ac: 12, hp: 11, speed: 40,
    creatureType: 'beast',
    abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    featureIds: ['pack-tactics'],
    weaponIds: ['wolf-bite'],
  },
  zombie: {
    id: 'zombie', name: 'Zombie',
    ac: 8, hp: 15, speed: 20,
    creatureType: 'undead',
    abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    featureIds: ['undead-fortitude'],
    weaponIds: ['slam'],
    immunities: ['poison'],
  },
  ogre: {
    id: 'ogre', name: 'Ogre',
    ac: 11, hp: 68, speed: 40,
    creatureType: 'giant',
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    weaponIds: ['greatclub', 'ogre-javelin'],
  },
  bandit: {
    id: 'bandit', name: 'Bandit',
    ac: 12, hp: 11, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    weaponIds: ['scimitar', 'light-crossbow'],
  },
  'bandit-captain': {
    id: 'bandit-captain', name: 'Bandit Captain',
    ac: 15, hp: 52, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    savingThrowProfs: ['str', 'dex', 'wis'],
    weaponIds: ['scimitar', 'dagger'],
    attacksPerAction: 3, // 2 scimitar + 1 dagger, uniform approximation
  },
  'dire-wolf': {
    id: 'dire-wolf', name: 'Dire Wolf',
    ac: 14, hp: 22, speed: 50,
    creatureType: 'beast',
    abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    featureIds: ['pack-tactics'],
    weaponIds: ['dire-wolf-bite'],
  },
  ghoul: {
    id: 'ghoul', name: 'Ghoul',
    ac: 12, hp: 22, speed: 30,
    creatureType: 'undead',
    abilities: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
    weaponIds: ['ghoul-claws', 'ghoul-bite'],
    attacksPerAction: 2, // bite + claws
    immunities: ['poison'],
  },
  'giant-spider': {
    id: 'giant-spider', name: 'Giant Spider',
    ac: 14, hp: 26, speed: 30,
    creatureType: 'beast',
    abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    weaponIds: ['spider-bite'],
  },
  acolyte: {
    id: 'acolyte', name: 'Acolyte',
    ac: 10, hp: 9, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 11 },
    weaponIds: ['mace'],
    spellcasting: { ability: 'wis', slots: [3], spellIds: ['sacred-flame', 'cure-wounds', 'bless', 'healing-word', 'command'] },
  },
  kobold: {
    id: 'kobold', name: 'Kobold Warrior',
    ac: 14, hp: 7, speed: 30,
    creatureType: 'dragon',
    abilities: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    featureIds: ['pack-tactics'],
    weaponIds: ['dagger', 'sling'],
  },
  scout: {
    id: 'scout', name: 'Scout',
    ac: 13, hp: 16, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11 },
    weaponIds: ['longbow', 'shortsword'], // ranged skirmisher: bow preferred
    attacksPerAction: 2,
  },
  orc: {
    id: 'orc', name: 'Orc',
    ac: 13, hp: 15, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    featureIds: ['adrenaline-rush'], // reuses the Orc species feature
    weaponIds: ['greataxe', 'javelin'],
  },
  'brown-bear': {
    id: 'brown-bear', name: 'Brown Bear',
    ac: 11, hp: 22, speed: 40,
    creatureType: 'beast',
    abilities: { str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
    weaponIds: ['bear-claws', 'bear-bite'],
    attacksPerAction: 2, // bite + claws
  },
  'cult-fanatic': {
    id: 'cult-fanatic', name: 'Cult Fanatic',
    ac: 13, hp: 33, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 11, dex: 14, con: 12, int: 10, wis: 13, cha: 14 },
    weaponIds: ['dagger'],
    attacksPerAction: 2,
    spellcasting: { ability: 'wis', slots: [4, 2], spellIds: ['sacred-flame', 'bless', 'hold-person', 'command', 'spiritual-weapon', 'suggestion'] },
  },
  'animated-armor': {
    id: 'animated-armor', name: 'Animated Armor',
    ac: 18, hp: 33, speed: 25,
    creatureType: 'construct',
    abilities: { str: 14, dex: 11, con: 13, int: 1, wis: 3, cha: 1 },
    weaponIds: ['slam'],
    attacksPerAction: 2,
    immunities: ['poison', 'psychic'],
  },

  // --- level 4-5 boss tier (SRD 5.2.1) ------------------------------------
  knight: {
    id: 'knight', name: 'Knight',
    ac: 18, hp: 52, speed: 30, // plate + shield
    creatureType: 'humanoid',
    abilities: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 },
    savingThrowProfs: ['con', 'wis'],
    weaponIds: ['greatsword', 'light-crossbow'],
    metalArmor: true,
    attacksPerAction: 2,
  },
  minotaur: {
    id: 'minotaur', name: 'Minotaur of Baphomet',
    ac: 14, hp: 85, speed: 40,
    creatureType: 'monstrosity',
    abilities: { str: 18, dex: 11, con: 16, int: 6, wis: 16, cha: 9 },
    weaponIds: ['minotaur-greataxe', 'minotaur-gore'],
    // One brutal chop a turn — the Reckless-charger shape, not a flurry.
  },
  ettin: {
    id: 'ettin', name: 'Ettin',
    ac: 12, hp: 85, speed: 40,
    creatureType: 'giant',
    abilities: { str: 21, dex: 8, con: 17, int: 6, wis: 10, cha: 8 },
    weaponIds: ['ettin-battleaxe', 'ettin-morningstar'],
    attacksPerAction: 2, // two heads, two weapons
  },

  // Spellcaster stat blocks that exercise the wider spell list.
  priest: {
    id: 'priest', name: 'Priest',
    ac: 13, hp: 38, speed: 30, // chain shirt
    creatureType: 'humanoid',
    abilities: { str: 10, dex: 10, con: 12, int: 13, wis: 16, cha: 13 },
    savingThrowProfs: ['wis'],
    weaponIds: ['mace'],
    metalArmor: true,
    // Wis +3, PB +2 → spell DC 13 (SRD Priest). A support/control caster.
    spellcasting: {
      ability: 'wis', slots: [4, 3, 2],
      spellIds: ['sacred-flame', 'cure-wounds', 'guiding-bolt', 'healing-word', 'command', 'spiritual-weapon', 'spiritual-guardians', 'bless'],
    },
  },
  'ogre-mage': {
    id: 'ogre-mage', name: 'Oni',
    ac: 17, cr: 7, hp: 119, speed: 30, // natural armor
    creatureType: 'fiend',
    abilities: { str: 19, dex: 14, con: 17, int: 14, wis: 12, cha: 15 },
    savingThrowProfs: ['con', 'int'],
    weaponIds: ['greatclub'],
    // An arcane brute: it blasts and controls, and can wade in with the club.
    spellcasting: {
      ability: 'int', slots: [4, 3, 2],
      spellIds: ['fire-bolt', 'magic-missile', 'web', 'fireball'],
    },
  },

  guard: {
    id: 'guard', name: 'Guard',
    ac: 16, hp: 11, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
    weaponIds: ['spear'],
    metalArmor: true,
  },
  bugbear: {
    id: 'bugbear', name: 'Bugbear Warrior',
    ac: 14, hp: 33, speed: 30,
    // Fey since 2024, with the rest of the goblinoids.
    creatureType: 'fey',
    abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 11, cha: 9 },
    featureIds: ['long-limbed', 'brute'],
    weaponIds: ['morningstar', 'javelin'],
  },
  lizardfolk: {
    id: 'lizardfolk', name: 'Lizardfolk',
    ac: 15, hp: 22, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 15, dex: 10, con: 13, int: 7, wis: 12, cha: 7 },
    weaponIds: ['mace', 'bite'],
  },
  gnoll: {
    id: 'gnoll', name: 'Gnoll Warrior',
    ac: 15, hp: 27, speed: 30,
    // Fiend since 2024: gnolls are demonic in origin, not a mortal people.
    creatureType: 'fiend',
    abilities: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 },
    featureIds: ['rampage'],
    weaponIds: ['spear', 'bite'],
  },
  spy: {
    id: 'spy', name: 'Spy',
    ac: 12, hp: 27, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 10, dex: 15, con: 10, int: 12, wis: 14, cha: 16 },
    featureIds: ['sneak-attack'],
    weaponIds: ['shortsword', 'hand-crossbow'],
    attacksPerAction: 2,
  },

  'giant-badger': {
    id: 'giant-badger', name: 'Giant Badger',
    ac: 13, hp: 15, speed: 30,
    creatureType: 'beast',
    abilities: { str: 13, dex: 10, con: 15, int: 2, wis: 12, cha: 5 },
    featureIds: ['burrow'],
    weaponIds: ['bite', 'badger-claws'],
    attacksPerAction: 2,
  },
  'giant-toad': {
    id: 'giant-toad', name: 'Giant Toad',
    ac: 11, hp: 39, speed: 30,
    creatureType: 'beast',
    abilities: { str: 15, dex: 13, con: 13, int: 2, wis: 10, cha: 3 },
    featureIds: [],
    weaponIds: ['toad-bite'],
  },
  'giant-hyena': {
    id: 'giant-hyena', name: 'Giant Hyena',
    ac: 12, hp: 45, speed: 50,
    creatureType: 'beast',
    abilities: { str: 16, dex: 14, con: 14, int: 2, wis: 12, cha: 7 },
    featureIds: ['rampage'],
    weaponIds: ['hyena-bite'],
  },
  'giant-boar': {
    id: 'giant-boar', name: 'Giant Boar',
    ac: 13, hp: 42, speed: 40,
    creatureType: 'beast',
    abilities: { str: 17, dex: 10, con: 16, int: 2, wis: 7, cha: 5 },
    featureIds: ['charge', 'relentless-endurance'],
    weaponIds: ['boar-tusk'],
  },
  'giant-constrictor-snake': {
    id: 'giant-constrictor-snake', name: 'Giant Constrictor Snake',
    ac: 12, hp: 60, speed: 30,
    creatureType: 'beast',
    abilities: { str: 19, dex: 14, con: 12, int: 1, wis: 10, cha: 3 },
    weaponIds: ['snake-constrict', 'bite'],
  },

  gargoyle: {
    id: 'gargoyle', name: 'Gargoyle',
    ac: 15, hp: 67, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 15, dex: 11, con: 16, int: 6, wis: 11, cha: 7 },
    weaponIds: ['gargoyle-bite', 'gargoyle-claws'],
    attacksPerAction: 2,
    resistances: ['bludgeoning', 'piercing', 'slashing'],
  },
  'fire-elemental': {
    id: 'fire-elemental', name: 'Fire Elemental',
    ac: 13, cr: 5, hp: 93, speed: 50,
    creatureType: 'elemental',
    abilities: { str: 10, dex: 17, con: 16, int: 6, wis: 10, cha: 7 },
    featureIds: ['fire-form'],
    weaponIds: ['fire-touch'],
    attacksPerAction: 2,
    immunities: ['fire', 'poison'],
    resistances: ['bludgeoning', 'piercing', 'slashing'],
  },
  'water-elemental': {
    id: 'water-elemental', name: 'Water Elemental',
    ac: 14, cr: 5, hp: 114, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 18, dex: 14, con: 18, int: 5, wis: 10, cha: 8 },
    featureIds: ['whelm'],
    weaponIds: ['water-slam'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistances: ['bludgeoning', 'piercing', 'slashing', 'acid'],
  },
  'earth-elemental': {
    id: 'earth-elemental', name: 'Earth Elemental',
    ac: 17, cr: 5, hp: 147, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 20, dex: 8, con: 20, int: 5, wis: 10, cha: 5 },
    featureIds: ['earth-glide'],
    weaponIds: ['earth-slam'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistances: ['bludgeoning', 'piercing', 'slashing'],
  },
  'air-elemental': {
    id: 'air-elemental', name: 'Air Elemental',
    ac: 15, cr: 5, hp: 90, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 14, dex: 20, con: 14, int: 6, wis: 10, cha: 6 },
    featureIds: ['whirlwind'],
    weaponIds: ['air-slam'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistances: ['bludgeoning', 'piercing', 'slashing', 'lightning'],
  },

  sprite: {
    id: 'sprite', name: 'Sprite',
    ac: 15, hp: 10, speed: 10,
    creatureType: 'fey',
    abilities: { str: 3, dex: 18, con: 10, int: 14, wis: 13, cha: 11 },
    featureIds: ['fey-invisibility'],
    weaponIds: ['sprite-shortbow'],
  },
  satyr: {
    id: 'satyr', name: 'Satyr',
    ac: 13, hp: 31, speed: 40,
    creatureType: 'fey',
    abilities: { str: 12, dex: 16, con: 11, int: 12, wis: 10, cha: 14 },
    featureIds: ['magic-resistance'],
    weaponIds: ['satyr-shortsword', 'satyr-ram'],
  },
  dryad: {
    id: 'dryad', name: 'Dryad',
    ac: 16, hp: 22, speed: 30,
    creatureType: 'fey',
    abilities: { str: 10, dex: 12, con: 11, int: 14, wis: 15, cha: 18 },
    featureIds: ['fey-charm'],
    weaponIds: ['dryad-club'],
    // A 2nd-level slot so Web (its control spell) is actually castable.
    spellcasting: { ability: 'wis', slots: [3, 1], spellIds: ['cure-wounds', 'web'] },
  },
  'green-hag': {
    id: 'green-hag', name: 'Green Hag',
    ac: 17, hp: 82, speed: 30,
    creatureType: 'fey',
    abilities: { str: 18, dex: 12, con: 16, int: 13, wis: 14, cha: 14 },
    featureIds: ['fey-invisibility'],
    weaponIds: ['hag-claws'],
    attacksPerAction: 2,
  },
  unicorn: {
    id: 'unicorn', name: 'Unicorn',
    ac: 12, cr: 5, hp: 97, speed: 50,
    creatureType: 'celestial',
    abilities: { str: 18, dex: 14, con: 15, int: 11, wis: 17, cha: 16 },
    featureIds: ['unicorn-charge', 'magic-resistance'],
    weaponIds: ['unicorn-horn', 'unicorn-hooves'],
    attacksPerAction: 2,
  },

  cockatrice: {
    id: 'cockatrice', name: 'Cockatrice',
    ac: 11, hp: 22, speed: 20,
    creatureType: 'monstrosity',
    abilities: { str: 6, dex: 12, con: 12, int: 2, wis: 13, cha: 5 },
    weaponIds: ['cockatrice-bite'],
  },
  harpy: {
    id: 'harpy', name: 'Harpy',
    ac: 11, hp: 38, speed: 20,
    creatureType: 'monstrosity',
    abilities: { str: 12, dex: 13, con: 12, int: 7, wis: 10, cha: 13 },
    featureIds: ['luring-song'],
    weaponIds: ['harpy-claws', 'harpy-club'],
    attacksPerAction: 2,
  },
  // ---- CR 5-10 ----------------------------------------------------------
  // The roster had nothing above CR 5, which left the arena's late waves
  // buying headcount instead of quality: at a level-5 even-fight budget the
  // generator could only ever field six bodies drawn from the same handful of
  // 1,800 XP blocks. These are the shelf above that.
  'hill-giant': {
    id: 'hill-giant', name: 'Hill Giant',
    ac: 13, cr: 5, hp: 105, speed: 40,
    creatureType: 'giant',
    abilities: { str: 21, dex: 8, con: 19, int: 5, wis: 9, cha: 6 },
    weaponIds: ['giant-greatclub', 'giant-rock'],
    attacksPerAction: 2,
  },
  'stone-giant': {
    id: 'stone-giant', name: 'Stone Giant',
    ac: 17, cr: 7, hp: 126, speed: 40,
    creatureType: 'giant',
    abilities: { str: 23, dex: 15, con: 20, int: 10, wis: 12, cha: 9 },
    savingThrowProfs: ['dex', 'con', 'wis'],
    weaponIds: ['giant-greatclub', 'greater-giant-rock'],
    attacksPerAction: 2,
  },
  'frost-giant': {
    id: 'frost-giant', name: 'Frost Giant',
    ac: 15, cr: 8, hp: 149, speed: 40,
    creatureType: 'giant',
    abilities: { str: 23, dex: 9, con: 21, int: 9, wis: 10, cha: 12 },
    savingThrowProfs: ['con', 'wis', 'cha'],
    weaponIds: ['frost-giant-greataxe', 'greater-giant-rock'],
    metalArmor: true, // patchwork plate
    attacksPerAction: 2,
    immunities: ['cold'],
  },
  'fire-giant': {
    id: 'fire-giant', name: 'Fire Giant',
    ac: 18, cr: 9, hp: 162, speed: 30,
    creatureType: 'giant',
    abilities: { str: 25, dex: 9, con: 23, int: 10, wis: 14, cha: 13 },
    savingThrowProfs: ['dex', 'con', 'cha'],
    weaponIds: ['fire-giant-greatsword', 'greater-giant-rock'],
    metalArmor: true,
    attacksPerAction: 2,
    immunities: ['fire'],
  },
  // ---- mephits: the elemental floor -------------------------------------
  // Elementals started at 100 XP and had nothing to fill a cheap slot with.
  // A mephit is a damage type with legs, which is exactly what that slot
  // wants.
  'dust-mephit': {
    id: 'dust-mephit', name: 'Dust Mephit',
    ac: 12, hp: 17, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 5, dex: 14, con: 10, int: 9, wis: 11, cha: 10 },
    weaponIds: ['mephit-claws-dust'],
    immunities: ['poison'],
  },
  'mud-mephit': {
    id: 'mud-mephit', name: 'Mud Mephit',
    ac: 11, hp: 27, speed: 20,
    creatureType: 'elemental',
    abilities: { str: 8, dex: 12, con: 12, int: 9, wis: 11, cha: 7 },
    weaponIds: ['mephit-claws-mud'],
    immunities: ['poison'],
  },
  'smoke-mephit': {
    id: 'smoke-mephit', name: 'Smoke Mephit',
    ac: 12, hp: 22, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 6, dex: 14, con: 12, int: 10, wis: 10, cha: 11 },
    weaponIds: ['mephit-claws-dust'],
    immunities: ['fire', 'poison'],
  },
  'ice-mephit': {
    id: 'ice-mephit', name: 'Ice Mephit',
    ac: 11, hp: 21, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 7, dex: 13, con: 10, int: 9, wis: 11, cha: 12 },
    featureIds: ['breath-mephit-cold'],
    weaponIds: ['mephit-claws-cold'],
    immunities: ['cold', 'poison'],
    vulnerabilities: ['fire', 'bludgeoning'],
  },
  'magma-mephit': {
    id: 'magma-mephit', name: 'Magma Mephit',
    ac: 11, hp: 18, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 8, dex: 12, con: 12, int: 7, wis: 10, cha: 10 },
    featureIds: ['breath-mephit-fire'],
    weaponIds: ['mephit-claws-fire'],
    immunities: ['fire', 'poison'],
    vulnerabilities: ['cold'],
  },
  'steam-mephit': {
    id: 'steam-mephit', name: 'Steam Mephit',
    ac: 10, hp: 17, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 5, dex: 11, con: 10, int: 11, wis: 10, cha: 12 },
    featureIds: ['breath-mephit-fire'],
    weaponIds: ['mephit-claws-fire'],
    immunities: ['fire', 'poison'],
  },

  // ---- fiends, mid and top ----------------------------------------------
  // The type had six members, holes at 450 and 1,100, and nothing above
  // 2,300 -- the shallowest well-supported type in the SRD.
  'shadow-demon': {
    id: 'shadow-demon', name: 'Shadow Demon',
    ac: 13, cr: 4, hp: 66, speed: 30,
    creatureType: 'fiend',
    abilities: { str: 1, dex: 17, con: 12, int: 14, wis: 13, cha: 14 },
    savingThrowProfs: ['dex', 'cha'],
    weaponIds: ['shadow-demon-claws'],
    resistances: ['acid', 'fire', 'necrotic', 'thunder', 'bludgeoning', 'piercing', 'slashing'],
    immunities: ['cold', 'lightning', 'poison'],
    vulnerabilities: ['radiant'],
  },
  succubus: {
    id: 'succubus', name: 'Succubus',
    ac: 15, cr: 4, hp: 71, speed: 30,
    creatureType: 'fiend',
    abilities: { str: 8, dex: 17, con: 13, int: 15, wis: 12, cha: 20 },
    featureIds: ['charm'],
    weaponIds: ['succubus-claws'],
    resistances: ['cold', 'fire', 'lightning', 'poison'],
  },
  'bearded-devil': {
    id: 'bearded-devil', name: 'Bearded Devil',
    ac: 13, cr: 3, hp: 58, speed: 30,
    creatureType: 'fiend',
    abilities: { str: 16, dex: 15, con: 15, int: 9, wis: 11, cha: 11 },
    savingThrowProfs: ['str', 'con', 'wis'],
    featureIds: ['magic-resistance'],
    weaponIds: ['bearded-devil-glaive', 'bearded-devil-beard'],
    attacksPerAction: 2,
    resistances: ['cold'],
    immunities: ['fire', 'poison'],
  },
  'night-hag': {
    id: 'night-hag', name: 'Night Hag',
    ac: 17, cr: 5, hp: 112, speed: 30,
    creatureType: 'fiend',
    featureIds: ['magic-resistance'],
    abilities: { str: 18, dex: 15, con: 16, int: 16, wis: 14, cha: 16 },
    weaponIds: ['night-hag-claws'],
    resistances: ['cold', 'fire'],
    immunities: ['poison'],
    spellcasting: {
      ability: 'int', slots: [4, 3],
      spellIds: ['ray-of-sickness', 'magic-missile', 'sleep', 'hold-person', 'invisibility'],
    },
  },
  'chain-devil': {
    id: 'chain-devil', name: 'Chain Devil',
    ac: 15, cr: 8, hp: 85, speed: 30,
    creatureType: 'fiend',
    abilities: { str: 18, dex: 15, con: 18, int: 11, wis: 12, cha: 14 },
    savingThrowProfs: ['con', 'wis', 'cha'],
    featureIds: ['magic-resistance'],
    weaponIds: ['chain-devil-chain'],
    attacksPerAction: 2,
    resistances: ['cold'],
    immunities: ['fire', 'poison'],
  },
  hezrou: {
    id: 'hezrou', name: 'Hezrou',
    ac: 18, cr: 8, hp: 157, speed: 30,
    creatureType: 'fiend',
    abilities: { str: 19, dex: 17, con: 20, int: 5, wis: 12, cha: 13 },
    savingThrowProfs: ['str', 'con', 'wis'],
    featureIds: ['magic-resistance'],
    weaponIds: ['hezrou-bite', 'hezrou-claws'],
    attacksPerAction: 3,
    resistances: ['cold', 'fire', 'lightning'],
    immunities: ['poison'],
  },
  glabrezu: {
    id: 'glabrezu', name: 'Glabrezu',
    ac: 17, cr: 9, hp: 189, speed: 40,
    creatureType: 'fiend',
    abilities: { str: 20, dex: 15, con: 21, int: 19, wis: 17, cha: 16 },
    savingThrowProfs: ['str', 'con', 'wis', 'cha'],
    featureIds: ['magic-resistance'],
    weaponIds: ['glabrezu-pincer', 'glabrezu-fist'],
    attacksPerAction: 4,
    resistances: ['cold', 'fire', 'lightning'],
    immunities: ['poison'],
  },
  'horned-devil': {
    id: 'horned-devil', name: 'Horned Devil',
    ac: 18, cr: 11, hp: 199, speed: 30,
    creatureType: 'fiend',
    abilities: { str: 22, dex: 17, con: 21, int: 12, wis: 16, cha: 17 },
    savingThrowProfs: ['str', 'dex', 'wis', 'cha'],
    featureIds: ['magic-resistance'],
    weaponIds: ['horned-devil-fork', 'horned-devil-tail'],
    attacksPerAction: 3,
    resistances: ['cold'],
    immunities: ['fire', 'poison'],
  },

  // ---- monstrosities, mid and top ---------------------------------------
  // Eight members with nothing at 450 or 1,100 and no top end, against one of
  // the deepest pools in the SRD.
  worg: {
    id: 'worg', name: 'Worg',
    ac: 13, hp: 26, speed: 50,
    // Fey since 2024, tied to the goblinoids it runs with.
    creatureType: 'fey',
    abilities: { str: 16, dex: 13, con: 13, int: 7, wis: 11, cha: 8 },
    featureIds: ['pack-tactics'],
    weaponIds: ['worg-bite'],
  },
  'rust-monster': {
    id: 'rust-monster', name: 'Rust Monster',
    ac: 14, hp: 33, speed: 40,
    creatureType: 'monstrosity',
    abilities: { str: 13, dex: 12, con: 13, int: 2, wis: 13, cha: 6 },
    weaponIds: ['rust-monster-antennae'],
  },
  griffon: {
    id: 'griffon', name: 'Griffon',
    ac: 12, cr: 2, hp: 59, speed: 30,
    creatureType: 'monstrosity',
    abilities: { str: 18, dex: 15, con: 16, int: 2, wis: 13, cha: 8 },
    weaponIds: ['griffon-claws', 'griffon-beak'],
    attacksPerAction: 2,
  },
  ettercap: {
    id: 'ettercap', name: 'Ettercap',
    ac: 13, cr: 2, hp: 44, speed: 30,
    creatureType: 'monstrosity',
    abilities: { str: 14, dex: 15, con: 13, int: 7, wis: 12, cha: 8 },
    weaponIds: ['ettercap-bite', 'ettercap-claws'],
    attacksPerAction: 2,
  },
  // Reuses Petrifying Breath for the gaze: the feature is "save or be locked
  // in place near me", which is the same thing the gaze does, and the engine
  // models petrification as restrained either way.
  basilisk: {
    id: 'basilisk', name: 'Basilisk',
    ac: 15, cr: 3, hp: 52, speed: 20,
    creatureType: 'monstrosity',
    abilities: { str: 16, dex: 8, con: 15, int: 2, wis: 8, cha: 7 },
    featureIds: ['petrifying-breath'],
    weaponIds: ['basilisk-bite'],
  },
  'winter-wolf': {
    id: 'winter-wolf', name: 'Winter Wolf',
    ac: 13, cr: 3, hp: 75, speed: 50,
    creatureType: 'monstrosity',
    abilities: { str: 18, dex: 13, con: 14, int: 7, wis: 12, cha: 8 },
    featureIds: ['pack-tactics', 'breath-cold'],
    weaponIds: ['winter-wolf-bite'],
    immunities: ['cold'],
  },
  roper: {
    id: 'roper', name: 'Roper',
    ac: 20, cr: 5, hp: 93, speed: 10,
    // Aberration since 2024 -- a thing the Far Realm made, not a beast.
    creatureType: 'aberration',
    abilities: { str: 18, dex: 8, con: 17, int: 7, wis: 16, cha: 6 },
    weaponIds: ['roper-tendril', 'roper-bite'],
    attacksPerAction: 3,
  },
  bulette: {
    id: 'bulette', name: 'Bulette',
    ac: 17, cr: 5, hp: 94, speed: 40,
    creatureType: 'monstrosity',
    abilities: { str: 19, dex: 11, con: 21, int: 2, wis: 10, cha: 5 },
    featureIds: ['charge'],
    weaponIds: ['bulette-bite'],
  },
  remorhaz: {
    id: 'remorhaz', name: 'Remorhaz',
    ac: 17, cr: 11, hp: 195, speed: 30,
    creatureType: 'monstrosity',
    abilities: { str: 24, dex: 13, con: 21, int: 4, wis: 10, cha: 5 },
    weaponIds: ['remorhaz-bite'],
    immunities: ['cold', 'fire'],
  },

  // ---- aberrations ------------------------------------------------------
  // The 2024 roper is an aberration, and a type with one member is a type the
  // generator can never field -- it needs two before it will pick it. These
  // are the SRD's other two, which also give the type a top end.
  otyugh: {
    id: 'otyugh', name: 'Otyugh',
    ac: 14, cr: 5, hp: 104, speed: 30,
    creatureType: 'aberration',
    abilities: { str: 16, dex: 11, con: 19, int: 6, wis: 13, cha: 6 },
    savingThrowProfs: ['con'],
    weaponIds: ['otyugh-tentacle', 'otyugh-bite'],
    attacksPerAction: 3,
  },
  aboleth: {
    id: 'aboleth', name: 'Aboleth',
    ac: 17, cr: 10, hp: 150, speed: 10,
    creatureType: 'aberration',
    abilities: { str: 21, dex: 9, con: 15, int: 18, wis: 15, cha: 18 },
    savingThrowProfs: ['con', 'int', 'wis'],
    featureIds: ['magic-resistance'],
    weaponIds: ['aboleth-tentacle', 'aboleth-tail'],
    attacksPerAction: 3,
    spellcasting: {
      ability: 'int', slots: [4, 3],
      spellIds: ['ray-of-sickness', 'hold-person', 'blindness', 'fear'],
    },
  },

  // The one hole left in the beasts.
  tyrannosaurus: {
    id: 'tyrannosaurus', name: 'Tyrannosaurus Rex',
    ac: 13, cr: 8, hp: 136, speed: 50,
    creatureType: 'beast',
    abilities: { str: 25, dex: 10, con: 19, int: 2, wis: 12, cha: 9 },
    weaponIds: ['trex-bite', 'trex-tail'],
    attacksPerAction: 2,
  },

  // ---- type ceilings ----------------------------------------------------
  // Measured problem: at a level-5 even-fight budget, undead/beast/humanoid
  // appeared in 5-7% of generated fights while dragon/giant/monstrosity ran
  // 20-27%. Nothing was wrong with the generator -- those types simply had no
  // member expensive enough to fill a high-budget slot, so the reroll-on-
  // underfill wrapper kept discarding them. Giving each a top end is the fix.

  // Undead stopped at the wight and the mummy (CR 3).
  ghast: {
    id: 'ghast', name: 'Ghast',
    ac: 13, cr: 2, hp: 36, speed: 30,
    creatureType: 'undead',
    abilities: { str: 16, dex: 17, con: 10, int: 11, wis: 10, cha: 8 },
    weaponIds: ['ghast-claws', 'ghoul-bite'],
    attacksPerAction: 2,
    resistances: ['necrotic'],
    immunities: ['poison'],
  },
  banshee: {
    id: 'banshee', name: 'Banshee',
    ac: 12, cr: 4, hp: 58, speed: 30,
    creatureType: 'undead',
    abilities: { str: 1, dex: 14, con: 10, int: 12, wis: 11, cha: 17 },
    savingThrowProfs: ['wis', 'cha'],
    weaponIds: ['banshee-touch'],
    resistances: ['cold', 'necrotic', 'bludgeoning', 'piercing', 'slashing'],
    immunities: ['poison'],
  },
  ghost: {
    id: 'ghost', name: 'Ghost',
    ac: 11, cr: 4, hp: 45, speed: 30,
    creatureType: 'undead',
    abilities: { str: 7, dex: 13, con: 10, int: 10, wis: 12, cha: 17 },
    weaponIds: ['ghost-touch'],
    resistances: ['acid', 'cold', 'fire', 'lightning', 'bludgeoning', 'piercing', 'slashing'],
    immunities: ['necrotic', 'poison'],
  },
  wraith: {
    id: 'wraith', name: 'Wraith',
    ac: 13, cr: 5, hp: 67, speed: 30,
    creatureType: 'undead',
    abilities: { str: 6, dex: 16, con: 16, int: 12, wis: 14, cha: 15 },
    weaponIds: ['wraith-touch'],
    resistances: ['acid', 'cold', 'fire', 'lightning', 'necrotic', 'bludgeoning', 'piercing', 'slashing'],
    immunities: ['poison'],
  },
  'vampire-spawn': {
    id: 'vampire-spawn', name: 'Vampire Spawn',
    ac: 16, cr: 5, hp: 90, speed: 30,
    creatureType: 'undead',
    abilities: { str: 16, dex: 16, con: 16, int: 11, wis: 10, cha: 12 },
    savingThrowProfs: ['dex', 'wis'],
    weaponIds: ['spawn-claws', 'spawn-bite'],
    attacksPerAction: 2,
    resistances: ['necrotic', 'bludgeoning', 'piercing', 'slashing'],
  },

  // Beasts stopped at the giant boar (CR 2). A dinosaur is a legitimate arena
  // opponent in a way a fourth dire wolf is not.
  'giant-scorpion': {
    id: 'giant-scorpion', name: 'Giant Scorpion',
    ac: 15, cr: 3, hp: 52, speed: 40,
    creatureType: 'beast',
    abilities: { str: 15, dex: 13, con: 15, int: 1, wis: 9, cha: 3 },
    weaponIds: ['scorpion-sting', 'scorpion-claw'],
    attacksPerAction: 3,
  },
  elephant: {
    id: 'elephant', name: 'Elephant',
    ac: 12, cr: 4, hp: 76, speed: 40,
    creatureType: 'beast',
    abilities: { str: 22, dex: 9, con: 17, int: 3, wis: 11, cha: 6 },
    featureIds: ['trampling-charge'],
    weaponIds: ['elephant-gore'],
  },
  'giant-crocodile': {
    id: 'giant-crocodile', name: 'Giant Crocodile',
    ac: 14, cr: 5, hp: 85, speed: 30,
    creatureType: 'beast',
    abilities: { str: 21, dex: 9, con: 17, int: 2, wis: 10, cha: 7 },
    weaponIds: ['crocodile-bite'],
    attacksPerAction: 2,
  },
  mammoth: {
    id: 'mammoth', name: 'Mammoth',
    ac: 13, cr: 6, hp: 126, speed: 40,
    creatureType: 'beast',
    abilities: { str: 24, dex: 9, con: 21, int: 3, wis: 11, cha: 6 },
    featureIds: ['trampling-charge'],
    weaponIds: ['mammoth-gore', 'mammoth-stomp'],
  },
  'giant-ape': {
    id: 'giant-ape', name: 'Giant Ape',
    ac: 12, cr: 7, hp: 168, speed: 40,
    creatureType: 'beast',
    abilities: { str: 23, dex: 14, con: 18, int: 7, wis: 12, cha: 7 },
    weaponIds: ['ape-fist'],
    attacksPerAction: 2,
  },

  // Humanoids stopped at the knight (CR 3), which made every high-budget wave
  // a monster wave. A gladiator band or a mage with a bodyguard is a different
  // kind of fight from a pack of oozes.
  berserker: {
    id: 'berserker', name: 'Berserker',
    ac: 13, cr: 2, hp: 67, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 16, dex: 12, con: 17, int: 9, wis: 11, cha: 9 },
    featureIds: ['relentless-endurance'],
    weaponIds: ['greataxe'],
  },
  veteran: {
    id: 'veteran', name: 'Warrior Veteran',
    ac: 17, cr: 3, hp: 65, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10 },
    weaponIds: ['longsword', 'shortsword', 'light-crossbow'],
    metalArmor: true,
    attacksPerAction: 2,
  },
  gladiator: {
    id: 'gladiator', name: 'Gladiator',
    ac: 16, cr: 5, hp: 112, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 18, dex: 15, con: 16, int: 10, wis: 12, cha: 15 },
    savingThrowProfs: ['str', 'dex', 'con'],
    featureIds: ['brute'],
    weaponIds: ['gladiator-spear'],
    metalArmor: true,
    attacksPerAction: 3,
  },
  mage: {
    id: 'mage', name: 'Mage',
    ac: 15, cr: 6, hp: 81, speed: 30, // AC 15 assumes Mage Armor precast
    creatureType: 'humanoid',
    abilities: { str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11 },
    savingThrowProfs: ['int', 'wis'],
    weaponIds: ['dagger'],
    // A control caster: it opens with Web or Fear and blasts from behind it.
    spellcasting: {
      ability: 'int', slots: [4, 3, 3, 3],
      spellIds: ['fire-bolt', 'magic-missile', 'shield', 'misty-step', 'web', 'fireball', 'lightning-bolt', 'fear'],
    },
  },
  assassin: {
    id: 'assassin', name: 'Assassin',
    ac: 16, cr: 8, hp: 97, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10 },
    savingThrowProfs: ['dex', 'int'],
    featureIds: ['sneak-attack', 'assassinate', 'cunning-hide', 'cunning-disengage'],
    weaponIds: ['shortsword', 'light-crossbow'],
    attacksPerAction: 2,
  },

  // Constructs stopped at the flesh golem.
  scarecrow: {
    id: 'scarecrow', name: 'Scarecrow',
    ac: 11, cr: 1, hp: 36, speed: 30,
    creatureType: 'construct',
    abilities: { str: 11, dex: 13, con: 11, int: 10, wis: 10, cha: 13 },
    weaponIds: ['scarecrow-claw'],
    attacksPerAction: 2,
    vulnerabilities: ['fire'],
    immunities: ['poison'],
  },
  'shield-guardian': {
    id: 'shield-guardian', name: 'Shield Guardian',
    ac: 17, cr: 7, hp: 142, speed: 30,
    creatureType: 'construct',
    abilities: { str: 18, dex: 8, con: 18, int: 7, wis: 10, cha: 3 },
    weaponIds: ['guardian-fist'],
    attacksPerAction: 2,
    immunities: ['poison'],
  },
  'stone-golem': {
    id: 'stone-golem', name: 'Stone Golem',
    ac: 18, cr: 10, hp: 220, speed: 30,
    creatureType: 'construct',
    abilities: { str: 22, dex: 9, con: 20, int: 3, wis: 11, cha: 1 },
    featureIds: ['magic-resistance'],
    weaponIds: ['stone-golem-slam'],
    attacksPerAction: 2,
    immunities: ['poison', 'psychic'],
  },

  // Elementals were a gargoyle and four identically-priced 1,800s -- no low
  // end to fill a slot with and no high end to headline one.
  magmin: {
    id: 'magmin', name: 'Magmin',
    ac: 14, hp: 13, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 7, dex: 15, con: 12, int: 8, wis: 11, cha: 10 },
    weaponIds: ['magmin-touch'],
    immunities: ['fire'],
    vulnerabilities: ['cold'],
  },
  azer: {
    id: 'azer', name: 'Azer Sentinel',
    ac: 17, cr: 2, hp: 39, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 17, dex: 12, con: 15, int: 12, wis: 13, cha: 10 },
    savingThrowProfs: ['con'],
    weaponIds: ['azer-hammer'],
    metalArmor: true,
    immunities: ['fire', 'poison'],
  },
  salamander: {
    id: 'salamander', name: 'Salamander',
    ac: 15, cr: 5, hp: 90, speed: 30,
    creatureType: 'elemental',
    abilities: { str: 18, dex: 14, con: 15, int: 11, wis: 10, cha: 12 },
    weaponIds: ['salamander-spear', 'salamander-tail'],
    attacksPerAction: 2,
    resistances: ['bludgeoning', 'piercing', 'slashing'],
    immunities: ['fire'],
    vulnerabilities: ['cold'],
  },
  'invisible-stalker': {
    id: 'invisible-stalker', name: 'Invisible Stalker',
    ac: 14, cr: 6, hp: 97, speed: 50,
    creatureType: 'elemental',
    abilities: { str: 16, dex: 19, con: 14, int: 10, wis: 15, cha: 11 },
    featureIds: ['fey-invisibility'],
    weaponIds: ['stalker-slam'],
    attacksPerAction: 2,
    immunities: ['poison'],
  },

  // ---- fiends -----------------------------------------------------------
  // The roster had no fiends at all, which is a conspicuous hole in a game
  // whose paladin and cleric kits are built to answer them. Magic Resistance
  // on the higher ones is the point of the type: a party that solves every
  // fight with save-or-suck spells has to find another answer.
  imp: {
    id: 'imp', name: 'Imp',
    ac: 13, cr: 1, hp: 21, speed: 20,
    creatureType: 'fiend',
    abilities: { str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14 },
    featureIds: ['magic-resistance'],
    weaponIds: ['imp-sting'],
    resistances: ['cold'],
    immunities: ['fire', 'poison'],
  },
  quasit: {
    id: 'quasit', name: 'Quasit',
    ac: 13, cr: 1, hp: 25, speed: 40,
    creatureType: 'fiend',
    abilities: { str: 5, dex: 17, con: 10, int: 7, wis: 10, cha: 10 },
    featureIds: ['magic-resistance'],
    weaponIds: ['quasit-claw'],
    resistances: ['cold', 'fire', 'lightning'],
    immunities: ['poison'],
  },
  dretch: {
    id: 'dretch', name: 'Dretch',
    ac: 11, hp: 18, speed: 20,
    creatureType: 'fiend',
    abilities: { str: 11, dex: 11, con: 12, int: 5, wis: 8, cha: 3 },
    weaponIds: ['dretch-claws', 'dretch-bite'],
    attacksPerAction: 2,
    resistances: ['cold', 'fire', 'lightning'],
    immunities: ['poison'],
  },
  'hell-hound': {
    id: 'hell-hound', name: 'Hell Hound',
    ac: 15, cr: 3, hp: 58, speed: 50,
    creatureType: 'fiend',
    abilities: { str: 17, dex: 12, con: 14, int: 6, wis: 13, cha: 6 },
    featureIds: ['pack-tactics', 'breath-fire-hound'],
    weaponIds: ['hell-hound-bite'],
    immunities: ['fire'],
  },
  'barbed-devil': {
    id: 'barbed-devil', name: 'Barbed Devil',
    ac: 15, cr: 5, hp: 110, speed: 30,
    creatureType: 'fiend',
    abilities: { str: 16, dex: 17, con: 18, int: 12, wis: 14, cha: 14 },
    savingThrowProfs: ['str', 'con', 'wis', 'cha'],
    featureIds: ['magic-resistance'],
    weaponIds: ['barbed-devil-tail', 'barbed-devil-claw'],
    attacksPerAction: 3,
    resistances: ['cold'],
    immunities: ['fire', 'poison'],
  },
  vrock: {
    id: 'vrock', name: 'Vrock',
    ac: 15, cr: 6, hp: 152, speed: 40,
    creatureType: 'fiend',
    abilities: { str: 17, dex: 15, con: 18, int: 8, wis: 13, cha: 8 },
    savingThrowProfs: ['dex', 'wis', 'cha'],
    featureIds: ['magic-resistance'],
    weaponIds: ['vrock-talons', 'vrock-beak'],
    attacksPerAction: 2,
    resistances: ['cold', 'fire', 'lightning'],
    immunities: ['poison'],
  },

  // ---- oozes ------------------------------------------------------------
  // Slow, blind, nearly mindless, and immune to most of what a party reaches
  // for first. An ooze is a positioning problem: it cannot chase, so the
  // question is what it's sitting on top of.
  'gray-ooze': {
    id: 'gray-ooze', name: 'Gray Ooze',
    ac: 9, hp: 22, speed: 10,
    creatureType: 'ooze',
    abilities: { str: 12, dex: 6, con: 16, int: 1, wis: 6, cha: 2 },
    weaponIds: ['gray-ooze-pseudopod'],
    resistances: ['acid', 'cold', 'fire'],
    immunities: ['poison'],
  },
  'ochre-jelly': {
    id: 'ochre-jelly', name: 'Ochre Jelly',
    ac: 8, cr: 2, hp: 52, speed: 10,
    creatureType: 'ooze',
    abilities: { str: 15, dex: 6, con: 14, int: 2, wis: 6, cha: 1 },
    weaponIds: ['ochre-jelly-pseudopod'],
    resistances: ['acid'],
    immunities: ['lightning', 'slashing', 'poison'],
  },
  'gelatinous-cube': {
    id: 'gelatinous-cube', name: 'Gelatinous Cube',
    ac: 6, cr: 2, hp: 63, speed: 15,
    creatureType: 'ooze',
    abilities: { str: 14, dex: 3, con: 20, int: 1, wis: 6, cha: 1 },
    weaponIds: ['cube-pseudopod'],
    immunities: ['poison'],
  },
  'black-pudding': {
    id: 'black-pudding', name: 'Black Pudding',
    ac: 7, cr: 4, hp: 68, speed: 20,
    creatureType: 'ooze',
    abilities: { str: 16, dex: 5, con: 16, int: 1, wis: 6, cha: 1 },
    weaponIds: ['black-pudding-pseudopod'],
    immunities: ['acid', 'cold', 'lightning', 'slashing', 'poison'],
  },

  // ---- constructs -------------------------------------------------------
  // One animated armor was the whole type.
  'flying-sword': {
    id: 'flying-sword', name: 'Animated Flying Sword',
    ac: 17, hp: 14, speed: 30,
    creatureType: 'construct',
    abilities: { str: 12, dex: 15, con: 11, int: 1, wis: 5, cha: 1 },
    weaponIds: ['flying-sword-blade'],
    metalArmor: true,
    immunities: ['poison', 'psychic'],
  },
  'rug-of-smothering': {
    id: 'rug-of-smothering', name: 'Animated Rug of Smothering',
    ac: 12, cr: 2, hp: 27, speed: 10,
    creatureType: 'construct',
    abilities: { str: 17, dex: 14, con: 10, int: 1, wis: 3, cha: 1 },
    weaponIds: ['rug-smother'],
    immunities: ['poison', 'psychic'],
  },
  'flesh-golem': {
    id: 'flesh-golem', name: 'Flesh Golem',
    ac: 9, cr: 5, hp: 127, speed: 30,
    creatureType: 'construct',
    abilities: { str: 19, dex: 9, con: 18, int: 6, wis: 10, cha: 5 },
    weaponIds: ['golem-slam'],
    attacksPerAction: 2,
    immunities: ['lightning', 'poison'],
  },

  // The troll is the roster's first "bring the right damage type" monster.
  // Chip damage alone loses to 10 HP a turn; acid or fire turns the fight
  // around, which is a decision rather than a bigger number.
  troll: {
    id: 'troll', name: 'Troll',
    ac: 15, cr: 5, hp: 94, speed: 30,
    creatureType: 'giant',
    abilities: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
    weaponIds: ['troll-claw', 'troll-bite'],
    attacksPerAction: 3, // bite and two claws
    regeneration: { amount: 10, stoppedBy: ['acid', 'fire'] },
  },
  chimera: {
    id: 'chimera', name: 'Chimera',
    ac: 14, cr: 6, hp: 114, speed: 30,
    creatureType: 'monstrosity',
    abilities: { str: 19, dex: 11, con: 19, int: 3, wis: 14, cha: 10 },
    featureIds: ['breath-fire-chimera'],
    weaponIds: ['chimera-bite', 'chimera-horns', 'chimera-claws'],
    attacksPerAction: 3,
  },
  wyvern: {
    id: 'wyvern', name: 'Wyvern',
    ac: 14, cr: 6, hp: 127, speed: 30,
    creatureType: 'dragon',
    abilities: { str: 19, dex: 10, con: 16, int: 5, wis: 12, cha: 6 },
    weaponIds: ['wyvern-sting', 'wyvern-bite'],
    attacksPerAction: 2,
  },
  // Five heads, five bites: the hydra is the action-economy monster, a wall of
  // attacks on one body rather than the reverse.
  hydra: {
    id: 'hydra', name: 'Hydra',
    ac: 15, cr: 8, hp: 184, speed: 30,
    creatureType: 'monstrosity',
    abilities: { str: 20, dex: 12, con: 20, int: 2, wis: 10, cha: 7 },
    savingThrowProfs: ['dex', 'con', 'wis'],
    weaponIds: ['hydra-bite'],
    attacksPerAction: 5,
  },
  // Young dragons: the wyrmlings one age category on. Same shape as the
  // wyrmling blocks, with the heavier breath spec and a claw routine.
  'young-white': {
    id: 'young-white', name: 'Young White Dragon',
    ac: 17, cr: 6, hp: 123, speed: 30,
    creatureType: 'dragon',
    abilities: { str: 18, dex: 10, con: 18, int: 6, wis: 11, cha: 12 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-cold-young'],
    weaponIds: ['young-white-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['cold'],
  },
  'young-black': {
    id: 'young-black', name: 'Young Black Dragon',
    ac: 18, cr: 7, hp: 127, speed: 30,
    creatureType: 'dragon',
    abilities: { str: 19, dex: 14, con: 17, int: 12, wis: 11, cha: 15 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-acid-young'],
    weaponIds: ['young-black-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['acid'],
  },
  'young-green': {
    id: 'young-green', name: 'Young Green Dragon',
    ac: 18, cr: 8, hp: 136, speed: 30,
    creatureType: 'dragon',
    abilities: { str: 19, dex: 12, con: 17, int: 16, wis: 13, cha: 15 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-poison-young'],
    weaponIds: ['young-green-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['poison'],
  },
  'young-blue': {
    id: 'young-blue', name: 'Young Blue Dragon',
    ac: 18, cr: 9, hp: 152, speed: 30,
    creatureType: 'dragon',
    abilities: { str: 21, dex: 10, con: 19, int: 14, wis: 13, cha: 17 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-lightning-young'],
    weaponIds: ['young-blue-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['lightning'],
  },
  'young-red': {
    id: 'young-red', name: 'Young Red Dragon',
    ac: 18, cr: 10, hp: 178, speed: 30,
    creatureType: 'dragon',
    abilities: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-fire-young'],
    weaponIds: ['young-red-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['fire'],
  },
  manticore: {
    id: 'manticore', name: 'Manticore',
    ac: 14, hp: 68, speed: 30,
    creatureType: 'monstrosity',
    abilities: { str: 17, dex: 16, con: 17, int: 7, wis: 12, cha: 8 },
    weaponIds: ['manticore-spike', 'manticore-bite', 'manticore-claws'],
    attacksPerAction: 3,
  },
  owlbear: {
    id: 'owlbear', name: 'Owlbear',
    ac: 13, hp: 59, speed: 40,
    creatureType: 'monstrosity',
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    weaponIds: ['owlbear-beak', 'owlbear-claws'],
    attacksPerAction: 2,
  },
  gorgon: {
    id: 'gorgon', name: 'Gorgon',
    ac: 19, cr: 5, hp: 114, speed: 40,
    creatureType: 'construct',
    abilities: { str: 20, dex: 11, con: 18, int: 2, wis: 12, cha: 7 },
    featureIds: ['petrifying-breath', 'trampling-charge'],
    weaponIds: ['gorgon-gore', 'gorgon-hooves'],
    attacksPerAction: 2,
  },

  shadow: {
    id: 'shadow', name: 'Shadow',
    ac: 12, hp: 27, speed: 40,
    creatureType: 'undead',
    abilities: { str: 6, dex: 14, con: 13, int: 6, wis: 10, cha: 8 },
    weaponIds: ['shadow-drain'],
    vulnerabilities: ['radiant'],
    immunities: ['necrotic', 'poison'],
    resistances: ['acid', 'fire', 'lightning', 'thunder', 'bludgeoning', 'piercing', 'slashing'],
  },
  specter: {
    id: 'specter', name: 'Specter',
    ac: 12, hp: 22, speed: 50,
    creatureType: 'undead',
    abilities: { str: 1, dex: 14, con: 11, int: 10, wis: 10, cha: 11 },
    weaponIds: ['specter-drain'],
    immunities: ['necrotic', 'poison'],
    resistances: ['acid', 'fire', 'lightning', 'thunder', 'bludgeoning', 'piercing', 'slashing'],
  },
  'will-o-wisp': {
    id: 'will-o-wisp', name: "Will-o'-Wisp",
    ac: 19, hp: 27, speed: 50,
    creatureType: 'undead',
    abilities: { str: 1, dex: 28, con: 10, int: 13, wis: 14, cha: 11 },
    featureIds: ['consume-life'],
    weaponIds: ['wisp-shock'],
    immunities: ['lightning', 'poison'],
    resistances: ['acid', 'fire', 'necrotic', 'thunder', 'bludgeoning', 'piercing', 'slashing'],
  },
  wight: {
    id: 'wight', name: 'Wight',
    ac: 14, hp: 82, speed: 30,
    creatureType: 'undead',
    abilities: { str: 15, dex: 14, con: 16, int: 10, wis: 13, cha: 15 },
    weaponIds: ['wight-longsword', 'wight-drain'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistances: ['necrotic', 'bludgeoning', 'piercing', 'slashing'],
  },
  mummy: {
    id: 'mummy', name: 'Mummy',
    ac: 11, hp: 58, speed: 20,
    creatureType: 'undead',
    abilities: { str: 16, dex: 8, con: 15, int: 6, wis: 10, cha: 12 },
    featureIds: ['dreadful-glare'],
    weaponIds: ['mummy-fist'],
    attacksPerAction: 2,
    vulnerabilities: ['fire'],
    immunities: ['necrotic', 'poison'],
    resistances: ['bludgeoning', 'piercing', 'slashing'],
  },

  // Chromatic dragon wyrmlings. Bite + a Recharge-5–6 elemental breath (shape,
  // save, and dice per BREATH_WEAPONS); each is immune to its own element. Fly
  // speed isn't modelled, so they keep a ground speed. PB +2 (all wyrmlings are
  // CR 2–4) makes their breath DCs land at the SRD's 11–13.
  'black-wyrmling': {
    id: 'black-wyrmling', name: 'Black Dragon Wyrmling',
    ac: 17, hp: 33, speed: 30, cr: 2,
    creatureType: 'dragon',
    abilities: { str: 15, dex: 14, con: 13, int: 10, wis: 11, cha: 13 },
    featureIds: ['breath-acid'],
    weaponIds: ['wyrmling-black-bite'],
    immunities: ['acid'],
  },
  'blue-wyrmling': {
    id: 'blue-wyrmling', name: 'Blue Dragon Wyrmling',
    ac: 17, hp: 65, speed: 30, cr: 3,
    creatureType: 'dragon',
    abilities: { str: 17, dex: 10, con: 15, int: 12, wis: 11, cha: 15 },
    featureIds: ['breath-lightning'],
    weaponIds: ['wyrmling-blue-bite'],
    immunities: ['lightning'],
  },
  'green-wyrmling': {
    id: 'green-wyrmling', name: 'Green Dragon Wyrmling',
    ac: 17, hp: 38, speed: 30, cr: 2,
    creatureType: 'dragon',
    abilities: { str: 15, dex: 12, con: 13, int: 14, wis: 11, cha: 13 },
    featureIds: ['breath-poison'],
    weaponIds: ['wyrmling-green-bite'],
    immunities: ['poison'],
  },
  'red-wyrmling': {
    id: 'red-wyrmling', name: 'Red Dragon Wyrmling',
    ac: 17, hp: 75, speed: 30, cr: 4,
    creatureType: 'dragon',
    abilities: { str: 19, dex: 10, con: 17, int: 12, wis: 11, cha: 15 },
    featureIds: ['breath-fire'],
    weaponIds: ['wyrmling-red-bite'],
    immunities: ['fire'],
  },
  'white-wyrmling': {
    id: 'white-wyrmling', name: 'White Dragon Wyrmling',
    ac: 16, hp: 32, speed: 30, cr: 2,
    creatureType: 'dragon',
    abilities: { str: 14, dex: 10, con: 14, int: 8, wis: 11, cha: 12 },
    featureIds: ['breath-cold'],
    weaponIds: ['wyrmling-white-bite'],
    immunities: ['cold'],
  },
};

/**
 * The combatant level a monster is built at, from its CR. `proficiencyBonus`
 * shares the CR→PB table's ÷4 breakpoints, so `round(cr)` as a level makes save
 * DCs, spell-attack bonuses, and cantrip/feature scaling all land on the stat
 * block's real numbers. Absent CR → level 1 / PB +2 (correct for every CR ≤ 4).
 */
export function monsterLevel(cr?: number): number {
  return cr !== undefined ? Math.max(1, Math.round(cr)) : 1;
}

export function buildMonster(monsterId: Id, team: TeamId, position: Position, suffix = ''): Combatant {
  const m = MONSTERS[monsterId];
  if (!m) throw new Error(`Unknown monster: ${monsterId}`);
  const level = monsterLevel(m.cr);
  // Feature-use pools, same as the character builder.
  const featureUses: Record<Id, ResourcePool> = {};
  for (const fid of m.featureIds ?? []) {
    const f = FEATURES[fid];
    if (f?.uses) {
      const count =
        f.uses.count === 'proficiency' ? proficiencyBonus(level) :
        f.uses.count === 'fiveTimesLevel' ? 5 * level :
        f.uses.count;
      featureUses[fid] = { current: count, max: count };
    } else if (f?.recharge) {
      featureUses[fid] = { current: 1, max: 1 }; // starts charged; the d6 recharge roll lives in startTurn
    }
  }
  return {
    id: `${team}-${monsterId}${suffix}`,
    name: suffix ? `${m.name} ${suffix}` : m.name,
    team,
    classId: monsterId,
    speciesId: 'monster',
    level, // from CR (default 1 / PB +2)
    abilities: { ...m.abilities },
    maxHp: m.hp,
    hp: m.hp,
    acOverride: m.ac,
    speed: m.speed,
    position,
    initiative: 0,
    savingThrowProfs: [...(m.savingThrowProfs ?? [])],
    spellSlots: (m.spellcasting?.slots ?? []).map((n) => ({ current: n, max: n })),
    spellIds: [...(m.spellcasting?.spellIds ?? [])],
    ...(m.spellcasting ? { spellcastingAbility: m.spellcasting.ability } : {}),
    featureIds: [...(m.featureIds ?? [])],
    featureUses,
    innateSpells: {},   // monsters have no innate spells (all their magic is stat-block slots)
    inventory: m.weaponIds.slice(1).map((w) => ({ itemId: w, qty: 1 })),
    equipped: {
      mainHand: m.weaponIds[0]!,
      // Metal-armored monsters get a representative armor id for the
      // Shocking Grasp rider; their AC stays the stat-block override.
      ...(m.metalArmor ? { armor: 'chain-mail' } : {}),
    },
    weaponMasteries: [],
    attacksPerAction: m.attacksPerAction ?? 1,
    resistances: [...(m.resistances ?? [])],
    vulnerabilities: [...(m.vulnerabilities ?? [])],
    immunities: [...(m.immunities ?? [])],
    conditions: [],
    hasActed: false,
    turn: {
      actionUsed: false, bonusActionUsed: false, reactionUsed: false,
      movementUsed: 0, movementMax: m.speed, disengaged: false,
      attackedThisTurn: false, attacksLeft: 0, interacted: false, sneakAttackUsed: false,
      colossusUsed: false,
    },
    alive: true,
    creatureType: m.creatureType,
    // Copied, not shared: `suppressed` is per-combatant turn state, and three
    // trolls from one stat block must not share one flag.
    ...(m.regeneration
      ? { regeneration: { amount: m.regeneration.amount, stoppedBy: [...m.regeneration.stoppedBy] } }
      : {}),
  };
}

export interface EncounterData {
  id: Id;
  name: string;
  members: Id[]; // monster ids; duplicates allowed
  suggestedLevel: number;
}

export const ENCOUNTERS: Record<Id, EncounterData> = {
  // Early-ladder sizes are tuned down: 5e's group multiplier (x2 for 5+
  // monsters) made these ~2x "deadly" for the level-1 party they front-load.
  goblins: {
    id: 'goblins', name: 'Goblin Warband', suggestedLevel: 1,
    members: ['goblin-boss', 'goblin-warrior', 'goblin-warrior'],
  },
  wolves: {
    id: 'wolves', name: 'Wolf Pack', suggestedLevel: 1,
    members: ['wolf', 'wolf', 'wolf'],
  },
  undead: {
    id: 'undead', name: 'Restless Dead', suggestedLevel: 2,
    members: ['skeleton', 'skeleton', 'zombie', 'zombie', 'zombie'],
  },
  ogre: {
    id: 'ogre', name: 'Ogre and Retinue', suggestedLevel: 3,
    members: ['ogre', 'goblin-warrior', 'goblin-warrior'],
  },
  bandits: {
    id: 'bandits', name: 'Bandit Camp', suggestedLevel: 2,
    members: ['bandit-captain', 'bandit', 'bandit', 'bandit', 'bandit'],
  },
  spiders: {
    id: 'spiders', name: 'Spider Nest', suggestedLevel: 2,
    members: ['giant-spider', 'giant-spider', 'giant-spider', 'giant-spider'],
  },
  crypt: {
    id: 'crypt', name: 'Crypt Crawlers', suggestedLevel: 3,
    members: ['acolyte', 'ghoul', 'ghoul', 'skeleton', 'skeleton'],
  },
  kobolds: {
    id: 'kobolds', name: 'Kobold Warren', suggestedLevel: 1,
    members: ['kobold', 'kobold', 'kobold', 'kobold', 'kobold', 'kobold'],
  },
  raiders: {
    id: 'raiders', name: 'Orc Raiders', suggestedLevel: 2,
    members: ['orc', 'orc', 'scout', 'scout', 'bandit'],
  },
  'raiders-forward': {
    // A forward scouting party — a level-1-appropriate first real fight (225 XP
    // vs the full warband's 425). One orc anchors two lighter humanoids.
    id: 'raiders-forward', name: 'Ashfang Outriders', suggestedLevel: 1,
    members: ['orc', 'scout', 'bandit'],
  },
  wilds: {
    id: 'wilds', name: 'Wild Hunt', suggestedLevel: 2,
    members: ['brown-bear', 'dire-wolf', 'wolf', 'wolf'],
  },
  cult: {
    id: 'cult', name: 'Cult of the Worm', suggestedLevel: 3,
    members: ['cult-fanatic', 'acolyte', 'ghoul', 'ghoul', 'animated-armor'],
  },
  knights: {
    id: 'knights', name: 'Knightly Order', suggestedLevel: 4,
    members: ['knight', 'scout', 'scout', 'bandit'],
  },
  labyrinth: {
    id: 'labyrinth', name: 'Labyrinth Terror', suggestedLevel: 4,
    members: ['minotaur', 'kobold', 'kobold', 'kobold'],
  },
  giants: {
    id: 'giants', name: 'Giant\'s Stronghold', suggestedLevel: 5,
    members: ['ettin', 'ogre', 'orc'],
  },
  temple: {
    id: 'temple', name: 'Corrupt Temple', suggestedLevel: 3,
    members: ['priest', 'acolyte', 'acolyte', 'skeleton', 'skeleton'],
  },
  oni: {
    id: 'oni', name: 'Oni\'s Warband', suggestedLevel: 5,
    members: ['ogre-mage', 'ogre', 'orc'],
  },
  watch: {
    id: 'watch', name: 'Town Watch', suggestedLevel: 1,
    members: ['guard', 'guard', 'guard', 'guard'],
  },
  ambush: {
    id: 'ambush', name: 'Bugbear Ambush', suggestedLevel: 2,
    members: ['bugbear', 'goblin-warrior', 'goblin-warrior'],
  },
  swamp: {
    id: 'swamp', name: 'Lizardfolk Tribe', suggestedLevel: 2,
    members: ['lizardfolk', 'lizardfolk', 'lizardfolk'],
  },
  pack: {
    id: 'pack', name: 'Gnoll Hunting Pack', suggestedLevel: 2,
    members: ['gnoll', 'gnoll', 'gnoll'],
  },
  syndicate: {
    id: 'syndicate', name: 'Shadow Syndicate', suggestedLevel: 3,
    members: ['spy', 'spy', 'bandit', 'bandit'],
  },
  'badger-den': {
    id: 'badger-den', name: 'Badger Den', suggestedLevel: 1,
    members: ['giant-badger', 'giant-badger', 'giant-badger'],
  },
  'toad-swamp': {
    id: 'toad-swamp', name: 'Festering Swamp', suggestedLevel: 2,
    members: ['giant-toad', 'giant-toad'],
  },
  'hyena-pack': {
    id: 'hyena-pack', name: 'Hyena Pack', suggestedLevel: 2,
    members: ['giant-hyena', 'giant-hyena', 'gnoll'],
  },
  'boar-stampede': {
    id: 'boar-stampede', name: 'Boar Stampede', suggestedLevel: 3,
    members: ['giant-boar', 'giant-boar'],
  },
  'snake-pit': {
    id: 'snake-pit', name: 'Viper Pit', suggestedLevel: 3,
    members: ['giant-constrictor-snake', 'giant-constrictor-snake'],
  },
  'gargoyle-perch': {
    id: 'gargoyle-perch', name: 'Gargoyle Perch', suggestedLevel: 3,
    members: ['gargoyle', 'gargoyle'],
  },
  'fire-nexus': {
    id: 'fire-nexus', name: 'Fire Nexus', suggestedLevel: 5,
    members: ['fire-elemental', 'cult-fanatic'],
  },
  'water-vortex': {
    id: 'water-vortex', name: 'Water Vortex', suggestedLevel: 5,
    members: ['water-elemental'],
  },
  'earth-tremor': {
    id: 'earth-tremor', name: 'Earth Tremor', suggestedLevel: 5,
    members: ['earth-elemental'],
  },
  'tempest-eye': {
    id: 'tempest-eye', name: 'Tempest Eye', suggestedLevel: 5,
    members: ['air-elemental'],
  },
  'elemental-cataclysm': {
    id: 'elemental-cataclysm', name: 'Elemental Cataclysm', suggestedLevel: 6,
    members: ['fire-elemental', 'earth-elemental'],
  },
  'sprite-glade': {
    id: 'sprite-glade', name: 'Sprite Glade', suggestedLevel: 1,
    members: ['sprite', 'sprite', 'sprite'],
  },
  'satyr-revelry': {
    id: 'satyr-revelry', name: 'Satyr Revelry', suggestedLevel: 2,
    members: ['satyr', 'satyr'],
  },
  'dryad-grove': {
    id: 'dryad-grove', name: 'Dryad Grove', suggestedLevel: 2,
    members: ['dryad', 'sprite', 'sprite'],
  },
  'hag-coven': {
    id: 'hag-coven', name: 'Hag Coven', suggestedLevel: 4,
    members: ['green-hag', 'bandit', 'bandit'],
  },
  'unicorn-sanctuary': {
    id: 'unicorn-sanctuary', name: 'Unicorn Sanctuary', suggestedLevel: 5,
    members: ['unicorn'],
  },
  'cockatrice-flock': {
    id: 'cockatrice-flock', name: 'Cockatrice Flock', suggestedLevel: 1,
    members: ['cockatrice', 'cockatrice'],
  },
  'harpy-roost': {
    id: 'harpy-roost', name: 'Harpy Roost', suggestedLevel: 2,
    members: ['harpy', 'harpy'],
  },
  'owlbear-den': {
    id: 'owlbear-den', name: 'Owlbear Den', suggestedLevel: 3,
    members: ['owlbear', 'brown-bear'],
  },
  'manticore-cliff': {
    id: 'manticore-cliff', name: 'Manticore Cliff', suggestedLevel: 3,
    members: ['manticore', 'goblin-warrior', 'goblin-warrior'],
  },
  'gorgon-maze': {
    id: 'gorgon-maze', name: 'Gorgon Lair', suggestedLevel: 5,
    members: ['gorgon'],
  },
  'shadow-ambush': {
    id: 'shadow-ambush', name: 'Shadow Ambush', suggestedLevel: 1,
    members: ['shadow', 'shadow'],
  },
  'specter-haunt': {
    id: 'specter-haunt', name: 'Specter Haunt', suggestedLevel: 2,
    members: ['specter', 'specter'],
  },
  'wight-tomb': {
    id: 'wight-tomb', name: 'Wight Tomb', suggestedLevel: 3,
    members: ['wight', 'skeleton', 'skeleton'],
  },
  'mummy-crypt': {
    id: 'mummy-crypt', name: 'Mummy Crypt', suggestedLevel: 3,
    members: ['mummy', 'zombie', 'zombie'],
  },
  'wisp-bog': {
    id: 'wisp-bog', name: 'Wisp Bog', suggestedLevel: 4,
    members: ['will-o-wisp', 'will-o-wisp', 'specter'],
  },
  // Dragon wyrmlings — solo threats, some with kobold servitors. Breath is a
  // recharging AoE, so these hit hard for their tier; levels are set high.
  'black-dragon-den': {
    id: 'black-dragon-den', name: "Black Wyrmling's Bog", suggestedLevel: 2,
    members: ['black-wyrmling', 'kobold', 'kobold'],
  },
  'green-dragon-den': {
    id: 'green-dragon-den', name: "Green Wyrmling's Thicket", suggestedLevel: 2,
    members: ['green-wyrmling', 'kobold', 'kobold'],
  },
  'white-dragon-den': {
    id: 'white-dragon-den', name: "White Wyrmling's Cave", suggestedLevel: 2,
    members: ['white-wyrmling', 'kobold', 'kobold'],
  },
  'blue-dragon-den': {
    id: 'blue-dragon-den', name: "Blue Wyrmling's Mesa", suggestedLevel: 3,
    members: ['blue-wyrmling', 'kobold', 'kobold', 'kobold'],
  },
  'red-dragon-den': {
    id: 'red-dragon-den', name: "Red Wyrmling's Forge", suggestedLevel: 4,
    members: ['red-wyrmling', 'kobold', 'kobold'],
  },
  'chromatic-clutch': {
    id: 'chromatic-clutch', name: 'Chromatic Clutch', suggestedLevel: 4,
    members: ['black-wyrmling', 'green-wyrmling', 'white-wyrmling'],
  },
  // A back-alley crew: a fixer (spy) and two hired knives — the muscle a town
  // informant keeps around. A first-real-fight step up from a bare street mug.
  cutpurses: {
    id: 'cutpurses', name: 'Cutpurse Crew', suggestedLevel: 1,
    members: ['spy', 'bandit', 'bandit'],
  },
  // The marsh keeps its dead. A pair of ghouls clawing up out of the black water
  // at night — a nastier camp-interruption than starving wolves.
  'marsh-dead': {
    id: 'marsh-dead', name: 'The Marsh Dead', suggestedLevel: 2,
    members: ['ghoul', 'ghoul'],
  },
  // The Ashfang's goblin outriders: a boss and his swarming pack. The road-out
  // climax of Act 1 — still the humanoid, hired-blade face of the band.
  'goblin-outriders': {
    id: 'goblin-outriders', name: 'Ashfang Outriders', suggestedLevel: 1,
    members: ['goblin-boss', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior'],
  },
  // The marsh tribe in the green hag's thrall — lizardfolk driven to serve, herding
  // one of her monstrous toads. The Act 2 climax: first proof the raiders command
  // more than hired swords.
  'hag-thralls': {
    id: 'hag-thralls', name: 'The Hag\'s Thralls', suggestedLevel: 2,
    members: ['lizardfolk', 'lizardfolk', 'lizardfolk', 'giant-toad'],
  },
  // The den's gate: a bugbear enforcer and the gnolls the Ashfang let run their
  // perimeter for scraps.
  'den-gate': {
    id: 'den-gate', name: 'Gate Enforcers', suggestedLevel: 3,
    members: ['bugbear', 'gnoll', 'gnoll'],
  },
  // The chief and the power behind him: the Ashfang warlord flanked by the green
  // hag whose marsh he sold his own people to, and one last human blade.
  'ashfang-warlord': {
    id: 'ashfang-warlord', name: 'The Ashfang Warlord', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag', 'bandit'],
  },
  // The same fight after Vex turns: his guard stands down, so the chief and
  // the hag face the party alone — the parley's promised payoff.
  'ashfang-warlord-alone': {
    id: 'ashfang-warlord-alone', name: 'The Ashfang Warlord, Unguarded', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag'],
  },
  // The Ashfang's kenneled hunting-beasts — two giant hyenas off their chains.
  'kennel-hyenas': {
    id: 'kennel-hyenas', name: 'The Kennels', suggestedLevel: 3,
    members: ['giant-hyena', 'giant-hyena'],
  },
  // The muster yard: a captured ogre the Ashfang keep chained as a pit-brute,
  // loosed on you by two orc goaders. A unique roster (the module's only ogre)
  // and the first thing you meet inside the palisade.
  'den-muster': {
    id: 'den-muster', name: 'The Pit-Brute', suggestedLevel: 3,
    members: ['ogre', 'orc', 'orc'],
  },
};

/**
 * SRD XP by CR, used to drive treasure and campaign leveling. Kept as a map
 * (not per-stat-block) so it stays in one readable place; a test asserts every
 * monster has an entry so the two can't drift.
 */
export const MONSTER_XP: Record<Id, number> = {
  'goblin-warrior': 50, 'goblin-boss': 200, skeleton: 50, wolf: 50, zombie: 50, ogre: 450,
  bandit: 25, 'bandit-captain': 450, 'dire-wolf': 200, ghoul: 200, 'giant-spider': 200, acolyte: 50,
  kobold: 25, scout: 100, orc: 100, 'brown-bear': 200, 'cult-fanatic': 450, 'animated-armor': 200,
  knight: 700, minotaur: 700, ettin: 1100,
  priest: 450,
  // CR 7 -- 90 HP, AC 15, Fireball. It was priced at 1,100 (the CR 4 value),
  // so every fight holding one was budgeted at well under half what it plays
  // like, in the arena and on the ladder alike.
  'ogre-mage': 2900,
  guard: 25, bugbear: 200, lizardfolk: 100, gnoll: 100, spy: 200,
  'giant-badger': 50, 'giant-toad': 200, 'giant-hyena': 200, 'giant-boar': 450, 'giant-constrictor-snake': 450,
  gargoyle: 450, 'fire-elemental': 1800, 'water-elemental': 1800, 'earth-elemental': 1800, 'air-elemental': 1800,
  sprite: 50, satyr: 100, dryad: 200, 'green-hag': 700, unicorn: 1800,
  cockatrice: 100, harpy: 200, manticore: 700, owlbear: 700, gorgon: 1800,
  shadow: 100, specter: 200, 'will-o-wisp': 450, wight: 700, mummy: 700,
  'black-wyrmling': 450, 'green-wyrmling': 450, 'white-wyrmling': 450,
  'blue-wyrmling': 700, 'red-wyrmling': 1100,
  // CR 5-10. The band above 1,800 was empty before these.
  // Mephits, fiend mid/top, monstrosity mid/top.
  'dust-mephit': 50, 'mud-mephit': 50, 'smoke-mephit': 50,
  'ice-mephit': 100, 'magma-mephit': 100, 'steam-mephit': 100,
  'shadow-demon': 1100, succubus: 1100, 'bearded-devil': 700, 'night-hag': 1800,
  'chain-devil': 3900, hezrou: 3900, glabrezu: 5000, 'horned-devil': 7200,
  worg: 100, 'rust-monster': 100, griffon: 450, ettercap: 450,
  basilisk: 700, 'winter-wolf': 700, roper: 1800, bulette: 1800, remorhaz: 7200,
  tyrannosaurus: 3900, otyugh: 1800, aboleth: 5900,
  // Type ceilings.
  ghast: 450, banshee: 1100, ghost: 1100, wraith: 1800, 'vampire-spawn': 1800,
  'giant-scorpion': 700, elephant: 1100, 'giant-crocodile': 1800, mammoth: 2300, 'giant-ape': 2900,
  berserker: 450, veteran: 700, gladiator: 1800, mage: 2300, assassin: 3900,
  scarecrow: 200, 'shield-guardian': 2900, 'stone-golem': 5900,
  magmin: 100, azer: 450, salamander: 1800, 'invisible-stalker': 2300,
  imp: 200, quasit: 200, dretch: 50, 'hell-hound': 700, 'barbed-devil': 1800, vrock: 2300,
  'gray-ooze': 100, 'ochre-jelly': 450, 'gelatinous-cube': 450, 'black-pudding': 1100,
  'flying-sword': 50, 'rug-of-smothering': 450, 'flesh-golem': 1800,
  troll: 1800, 'hill-giant': 1800, chimera: 2300, wyvern: 2300, 'young-white': 2300,
  'stone-giant': 2900, 'young-black': 2900,
  'frost-giant': 3900, hydra: 3900, 'young-green': 3900,
  'fire-giant': 5000, 'young-blue': 5000,
  'young-red': 5900,
};

/** Total XP an encounter is worth (sum of member XP). */
export function encounterXP(encounterId: Id): number {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) return 0;
  return enc.members.reduce((sum, mid) => sum + (MONSTER_XP[mid] ?? 0), 0);
}

/** Creature types that carry no coin or valuables — a wolf pack has no purse and
 *  hoards no gems. Everything else (humanoids, giants, dragons, fiends, fey) is
 *  assumed to bear or guard loot. Undead/constructs/monstrosities keep loot too,
 *  since they usually stand over a grave-hoard or a lair. */
const NO_TREASURE_TYPES = new Set<CreatureType>(['beast', 'elemental']);

/** The share of an encounter's XP that comes from loot-bearing creatures — the
 *  basis for coin and valuables. An all-beast fight yields 0 (XP only). */
export function encounterCoinXP(encounterId: Id): number {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) return 0;
  return membersCoinXP(enc.members);
}

/** As `encounterCoinXP`, for a roster with no encounter id — the arena builds
 *  its fights on the fly, and a generated wolf pack has no purse either. */
export function membersCoinXP(members: readonly Id[]): number {
  return members.reduce((sum, mid) => {
    const type = MONSTERS[mid]?.creatureType;
    const bears = !type || !NO_TREASURE_TYPES.has(type);
    return sum + (bears ? (MONSTER_XP[mid] ?? 0) : 0);
  }, 0);
}

/** Place an encounter on a rank, spread across the files. */
export function buildEncounter(encounterId: Id, team: TeamId, rank: number): Combatant[] {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) throw new Error(`Unknown encounter: ${encounterId}`);
  const files = [3, 1, 5, 2, 6, 0, 7, 4];
  return enc.members.map((mid, i) =>
    buildMonster(mid, team, { x: files[i]!, y: rank }, enc.members.length > 1 ? String(i + 1) : ''),
  );
}
