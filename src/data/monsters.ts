/**
 * The bestiary: monster stat blocks (SRD 5.2.1, simplified) and their XP.
 * A monster is data through the same Combatant shape as a character; attack
 * bonuses derive from abilities + proficiency exactly like PCs (the stat
 * blocks below reproduce the SRD's printed bonuses at PB +2).
 *
 * Authored *fights* live next door in encounters.ts. The split is along the
 * line the arena drew: it generates its own rosters from MONSTERS and never
 * looks at ENCOUNTERS, so a file that held both was two things in a trench
 * coat — and the bestiary is the half that keeps growing.
 */
import type { Combatant, TeamId, Position, AbilityScores, Ability, DamageType, Id, ResourcePool, CreatureType, CreatureSize } from '../engine/types.js';
import { proficiencyBonus, abilityMod } from '../engine/types.js';
import { FEATURES } from './features.js';
import { WEAPONS } from './weapons.js';

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
  /** Resisted only against nonmagical damage (SRD physical resistance). */
  resistNonmagical?: DamageType[];
  /** Changes shape (a lycanthrope). Silvered weapons hurt these extra. */
  shapechanger?: boolean;
  /**
   * Keep this monster out of generated fights below the given party level.
   *
   * For creatures whose danger is an *ability*, not a damage number, which is
   * the one thing an XP budget cannot see. The harpy is the case that forced
   * it: Luring Song is one save against a DC of 12, and a hero who fails is
   * removed from the fight for good (charmAway, no repeat save, no shaking it
   * off when damaged — a simplification of the SRD version, which repeats the
   * save every turn). Three harpies against level-1 Wisdom saves delete the
   * party about five times in six, and no play changes that.
   */
  minPartyLevel?: number;
  vulnerabilities?: DamageType[];
  immunities?: DamageType[];
  /** Caster monsters reuse the spell system (acolyte, cult fanatic, ...). */
  spellcasting?: { ability: Ability; slots: number[]; spellIds: Id[] };
  /** SRD creature type. Beast is the load-bearing one today -- Animal
   *  Friendship needs to tell a wolf from a goblin. */
  creatureType: CreatureType;
  /**
   * SRD size. Load-bearing for cover: a barricade is chest-high to a person,
   * so a kobold ducks behind it and an ogre simply stands there being shot at.
   * That makes the same board play differently against a goblin warband and
   * against a pair of giants, which is most of the point of having terrain.
   *
   * There is no grid footprint behind it — everything still occupies one cell.
   * Modelling a Huge creature as 2x2 is a much larger change and this is not
   * a down payment on it.
   */
  size: CreatureSize;
  /** Flies: ignores difficult ground, hazards and barricades. See Combatant.flying. */
  fly?: boolean;
  /** Regeneration (troll): heals at the start of its turn unless it has taken
   *  one of `stoppedBy` damage types since the last one. */
  regeneration?: { amount: number; stoppedBy: DamageType[] };
  /** Damage dealt at the start of this creature's turn to everyone it has
   *  restrained (gelatinous cube: 3d6 acid to whoever it has engulfed). */
  holdDamage?: { dice: string; type: DamageType };
  /** Death Burst: explodes when killed, save for half (magmin, mephits). */
  deathBurst?: { dice: string; type: DamageType; save: { ability: Ability; dc: number }; radius: number };
}

export const MONSTERS: Record<Id, MonsterData> = {
  'goblin-warrior': {
    id: 'goblin-warrior', name: 'Goblin Warrior',
    ac: 15, hp: 10, speed: 30,
    // Fey since the 2024 rules, not humanoid -- goblinoids are folklore
    // tricksters from the Feywild rather than another mortal people.
    creatureType: 'fey',
    size: 'small',
    abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
    featureIds: ['nimble-escape', 'nimble-hide'],
    weaponIds: ['goblin-scimitar', 'goblin-shortbow'],
  },
  /**
   * EVERY CASTER CARRIES AN ATTACK CANTRIP. A monster whose whole kit is
   * leveled slots does nothing once they run dry but walk toward the party, and
   * five casters were in that state — the two variants below plus the dryad,
   * the night hag and the aboleth, none of which had a single cantrip. The
   * cantrip is the workhorse and the slot spell is the signature; that split is
   * what makes a caster read as a caster for the whole fight rather than for
   * two rounds.
   */
  /**
   * Caster variants are variants OF a specific monster, not new creatures: each
   * one inherits its base's creature type, so the generator (which picks 1-2
   * types and fills from them) drops it into its own kin's warbands with no
   * special casing. A goblin hexer turns up among goblins.
   *
   * They exist because the enemy side had almost no magic at the levels where
   * a player is learning the game: of the 45 monsters a level-1 party can meet,
   * exactly two cast anything, and 44 of the game's 66 spells were never once
   * aimed at a player. Every variant below is built around a spell nobody had
   * ever had thrown at them, and each one has a different verb — the existing
   * casters all either buff-and-heal or blast.
   */
  'goblin-hexer': {
    id: 'goblin-hexer', name: 'Goblin Hexer',
    ac: 13, hp: 10, speed: 30,
    creatureType: 'fey',
    size: 'small',
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 10, cha: 14 },
    featureIds: ['nimble-escape'],
    weaponIds: ['dagger'],
    // Bane is the point: a concentration debuff on up to three heroes, which
    // lifts the moment the hexer drops. The lesson is "shoot the little one".
    spellcasting: { ability: 'cha', slots: [2], spellIds: ['vicious-mockery', 'bane'] },
  },
  'goblin-boss': {
    id: 'goblin-boss', name: 'Goblin Boss',
    ac: 17, hp: 21, speed: 30,
    creatureType: 'fey',
    size: 'small',
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
    size: 'medium',
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
    size: 'medium',
    abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    featureIds: ['pack-tactics'],
    weaponIds: ['wolf-bite'],
  },
  'skeleton-bonechanter': {
    id: 'skeleton-bonechanter', name: 'Skeleton Bonechanter',
    ac: 13, hp: 13, speed: 30,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 14, cha: 8 },
    weaponIds: ['shortsword'],
    vulnerabilities: ['bludgeoning'],
    immunities: ['poison'],
    // The only caster in the game that WANTS to be adjacent: Inflict Wounds is
    // a touch attack, so this one closes instead of holding the back rank, and
    // False Life keeps it standing long enough to land a second.
    spellcasting: { ability: 'wis', slots: [2], spellIds: ['poison-spray', 'inflict-wounds', 'false-life'] },
  },
  zombie: {
    id: 'zombie', name: 'Zombie',
    ac: 8, hp: 15, speed: 20,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    featureIds: ['undead-fortitude'],
    weaponIds: ['slam'],
    immunities: ['poison'],
  },
  ogre: {
    id: 'ogre', name: 'Ogre',
    ac: 11, hp: 68, speed: 40,
    creatureType: 'giant',
    size: 'large',
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    weaponIds: ['ogre-greatclub', 'ogre-javelin'],
  },
  bandit: {
    id: 'bandit', name: 'Bandit',
    ac: 12, hp: 11, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    weaponIds: ['scimitar', 'light-crossbow'],
  },
  'bandit-captain': {
    id: 'bandit-captain', name: 'Bandit Captain',
    ac: 15, hp: 52, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    savingThrowProfs: ['str', 'dex', 'wis'],
    weaponIds: ['scimitar', 'dagger'],
    attacksPerAction: 3, // 2 scimitar + 1 dagger, uniform approximation
  },
  'dire-wolf': {
    id: 'dire-wolf', name: 'Dire Wolf',
    ac: 14, hp: 22, speed: 50,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    featureIds: ['pack-tactics'],
    weaponIds: ['dire-wolf-bite'],
  },
  ghoul: {
    id: 'ghoul', name: 'Ghoul',
    ac: 12, hp: 22, speed: 30,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
    weaponIds: ['ghoul-claws', 'ghoul-bite'],
    attacksPerAction: 2, // bite + claws
    immunities: ['poison'],
  },
  'giant-spider': {
    id: 'giant-spider', name: 'Giant Spider',
    ac: 14, hp: 26, speed: 30,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    weaponIds: ['spider-bite'],
  },
  acolyte: {
    id: 'acolyte', name: 'Priest Acolyte',
    ac: 13, hp: 11, speed: 30, // chain shirt
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 14, cha: 11 },
    weaponIds: ['mace'],
    spellcasting: { ability: 'wis', slots: [3], spellIds: ['sacred-flame', 'cure-wounds', 'bless', 'healing-word', 'command'] },
  },
  kobold: {
    id: 'kobold', name: 'Kobold Warrior',
    ac: 14, hp: 7, speed: 30,
    creatureType: 'dragon',
    size: 'small',
    abilities: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    featureIds: ['pack-tactics'],
    weaponIds: ['dagger', 'sling'],
  },
  'kobold-emberling': {
    id: 'kobold-emberling', name: 'Kobold Emberling',
    ac: 13, hp: 7, speed: 30,
    creatureType: 'dragon',
    size: 'small',
    abilities: { str: 7, dex: 15, con: 9, int: 8, wis: 8, cha: 14 },
    featureIds: ['pack-tactics'],
    weaponIds: ['dagger'],
    // A 15-foot cone for a 50 XP monster: it cannot kill anyone on its own, but
    // it makes standing shoulder to shoulder cost something. The cheapest
    // possible teacher of "don't bunch up".
    spellcasting: { ability: 'cha', slots: [2], spellIds: ['fire-bolt', 'burning-hands'] },
  },
  scout: {
    id: 'scout', name: 'Scout',
    ac: 13, hp: 16, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11 },
    weaponIds: ['longbow', 'shortsword'], // ranged skirmisher: bow preferred
    attacksPerAction: 2,
  },
  orc: {
    id: 'orc', name: 'Orc Raider',
    ac: 13, hp: 15, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    featureIds: ['adrenaline-rush'], // reuses the Orc species feature
    weaponIds: ['greataxe', 'javelin'],
  },
  'brown-bear': {
    id: 'brown-bear', name: 'Brown Bear',
    ac: 11, hp: 22, speed: 40,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 17, dex: 12, con: 15, int: 2, wis: 13, cha: 7 },
    weaponIds: ['bear-claws', 'bear-bite'],
    attacksPerAction: 2, // bite + claws
  },
  /**
   * SRD CR 1. Fragile (22 HP) and fast (50 ft), with Pack Tactics — which is
   * the whole creature: one lion is a nuisance and three are a problem, and
   * the generator's headcount roll decides which you get.
   */
  lion: {
    id: 'lion', name: 'Lion',
    ac: 12, hp: 22, speed: 50,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 17, dex: 15, con: 11, int: 3, wis: 12, cha: 8 },
    weaponIds: ['lion-rend'],
    attacksPerAction: 2,
    featureIds: ['pack-tactics'],
  },
  'cult-fanatic': {
    id: 'cult-fanatic', name: 'Cult Fanatic',
    ac: 13, hp: 33, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 11, dex: 14, con: 12, int: 10, wis: 13, cha: 14 },
    weaponIds: ['dagger'],
    attacksPerAction: 2,
    spellcasting: { ability: 'wis', slots: [4, 2], spellIds: ['sacred-flame', 'bless', 'hold-person', 'command', 'spiritual-weapon', 'suggestion'] },
  },
  'animated-armor': {
    id: 'animated-armor', name: 'Animated Armor',
    ac: 18, hp: 33, speed: 25,
    creatureType: 'construct',
    size: 'medium',
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
    size: 'medium',
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
    size: 'large',
    abilities: { str: 18, dex: 11, con: 16, int: 6, wis: 16, cha: 9 },
    weaponIds: ['minotaur-greataxe', 'minotaur-gore'],
    // One brutal chop a turn — the Reckless-charger shape, not a flurry.
  },
  ettin: {
    id: 'ettin', name: 'Ettin',
    ac: 12, hp: 85, speed: 40,
    creatureType: 'giant',
    size: 'large',
    abilities: { str: 21, dex: 8, con: 17, int: 6, wis: 10, cha: 8 },
    weaponIds: ['ettin-battleaxe', 'ettin-morningstar'],
    attacksPerAction: 2, // two heads, two weapons
  },

  // Spellcaster stat blocks that exercise the wider spell list.
  priest: {
    id: 'priest', name: 'Priest',
    ac: 13, hp: 38, speed: 30, // chain shirt
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 16, dex: 10, con: 12, int: 13, wis: 16, cha: 13 },
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
    size: 'large',
    abilities: { str: 19, dex: 11, con: 16, int: 14, wis: 12, cha: 15 },
    savingThrowProfs: ['con', 'int'],
    weaponIds: ['ogre-greatclub'],
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
    size: 'medium',
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
    weaponIds: ['spear'],
    metalArmor: true,
  },
  bugbear: {
    id: 'bugbear', name: 'Bugbear Warrior',
    ac: 14, hp: 33, speed: 30,
    // Fey since 2024, with the rest of the goblinoids.
    creatureType: 'fey',
    size: 'medium',
    abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 11, cha: 9 },
    featureIds: ['long-limbed', 'brute'],
    weaponIds: ['morningstar', 'javelin'],
  },
  lizardfolk: {
    id: 'lizardfolk', name: 'Lizardfolk Skirmisher',
    ac: 15, hp: 22, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 15, dex: 10, con: 13, int: 7, wis: 12, cha: 7 },
    weaponIds: ['mace', 'bite'],
  },
  /**
   * Lycanthropes: SRD 5.2.1 stat blocks, straight.
   *
   * They resist NOTHING, which is worth saying because the 2014 versions were
   * famous for the opposite — "bludgeoning, piercing, and slashing from
   * nonmagical attacks that aren't silvered" — and the 2024 revision dropped
   * that clause along with silver itself. An ordinary sword hurts a werewolf
   * exactly as much as a silvered one does.
   *
   * What silver is for here is `shapechanger`: a silvered weapon deals extra
   * damage to one, which is a bonus rather than a gate. That is the difference
   * between "you cannot hurt this without the right item" and "the right item
   * helps", and only the second is a good thing to hand a level-2 party.
   *
   * Shape-shifting itself is not modelled. The SRD says the statistics are
   * identical in every form but size, so the hybrid is the only form worth
   * fielding and a bonus action that changed nothing but a word would be dead
   * data. `shapechanger` is the flag that matters mechanically.
   */
  wererat: {
    id: 'wererat', name: 'Wererat',
    ac: 13, cr: 2, hp: 60, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 10, dex: 16, con: 12, int: 11, wis: 10, cha: 8 },
    shapechanger: true,
    weaponIds: ['were-bite-rat', 'hand-crossbow'],
    attacksPerAction: 2,
  },
  werewolf: {
    id: 'werewolf', name: 'Werewolf',
    ac: 15, cr: 3, hp: 71, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 11, cha: 10 },
    shapechanger: true,
    // Pack Tactics is on the block, and it is the trait that makes a werewolf
    // read differently from a bag of hit points: it wants a friend adjacent.
    featureIds: ['pack-tactics'],
    weaponIds: ['were-bite-wolf', 'were-claw'],
    attacksPerAction: 2,
  },
  wereboar: {
    id: 'wereboar', name: 'Wereboar',
    ac: 15, cr: 4, hp: 97, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 17, dex: 10, con: 15, int: 10, wis: 11, cha: 8 },
    shapechanger: true,
    weaponIds: ['were-bite-boar', 'javelin'],
    attacksPerAction: 2,
  },
  weretiger: {
    id: 'weretiger', name: 'Weretiger',
    ac: 12, cr: 4, hp: 120, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 17, dex: 15, con: 16, int: 10, wis: 13, cha: 11 },
    shapechanger: true,
    weaponIds: ['were-bite-tiger', 'longbow'],
    attacksPerAction: 2,
  },
  werebear: {
    id: 'werebear', name: 'Werebear',
    ac: 15, cr: 5, hp: 135, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 19, dex: 10, con: 17, int: 11, wis: 12, cha: 12 },
    shapechanger: true,
    weaponIds: ['were-bite-bear', 'were-rend'],
    attacksPerAction: 2,
  },
  gnoll: {
    id: 'gnoll', name: 'Gnoll Warrior',
    ac: 15, hp: 27, speed: 30,
    // Fiend since 2024: gnolls are demonic in origin, not a mortal people.
    creatureType: 'fiend',
    size: 'medium',
    abilities: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 },
    featureIds: ['rampage'],
    weaponIds: ['spear', 'bite'],
  },
  /**
   * Fiends, monstrosities and elementals had no spellcaster at all between
   * them, and the generator picks by creature type — so a party that drew a
   * gnoll warband or an elemental pack met no magic, ever. These three fill
   * those types; the Druid below fills the mid band, where the ladder ran from
   * a 450 XP priest straight to an 1,800 XP hag with nothing between.
   */
  'gnoll-packcaller': {
    id: 'gnoll-packcaller', name: 'Gnoll Packcaller',
    ac: 14, hp: 27, speed: 30,
    creatureType: 'fiend',
    size: 'medium',
    abilities: { str: 12, dex: 13, con: 11, int: 8, wis: 10, cha: 15 },
    featureIds: ['rampage'],
    weaponIds: ['spear'],
    // Faerie Fire is the point: it hands the whole pack advantage, so the
    // packcaller is worth killing before the things it is helping.
    // Not Shocking Grasp, which is a melee touch cantrip on a back-line caster
    // that never closes: zero casts in thirty fights. Starry Wisp instead —
    // 60 ft, and it outlines what it hits, which is the same favour Faerie Fire
    // does the pack. A caster with one rank of slots leans on its cantrip, so
    // this is where a cantrip actually gets played.
    spellcasting: { ability: 'cha', slots: [3], spellIds: ['starry-wisp', 'faerie-fire', 'thunderwave'] },
  },
  spy: {
    id: 'spy', name: 'Spy',
    ac: 12, hp: 27, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 10, dex: 15, con: 10, int: 12, wis: 14, cha: 16 },
    featureIds: ['sneak-attack'],
    weaponIds: ['shortsword', 'hand-crossbow'],
    attacksPerAction: 2,
  },

  'giant-badger': {
    id: 'giant-badger', name: 'Giant Badger',
    ac: 13, hp: 15, speed: 30,
    creatureType: 'beast',
    size: 'medium',
    abilities: { str: 13, dex: 10, con: 17, int: 2, wis: 12, cha: 5 },
    featureIds: ['burrow'],
    weaponIds: ['bite', 'badger-claws'],
    attacksPerAction: 2,
  },
  'giant-toad': {
    id: 'giant-toad', name: 'Giant Toad',
    ac: 11, hp: 39, speed: 30,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 15, dex: 13, con: 13, int: 2, wis: 10, cha: 3 },
    featureIds: [],
    weaponIds: ['toad-bite'],
  },
  'giant-hyena': {
    id: 'giant-hyena', name: 'Giant Hyena',
    ac: 12, hp: 45, speed: 50,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 16, dex: 14, con: 14, int: 2, wis: 12, cha: 7 },
    featureIds: ['rampage'],
    weaponIds: ['hyena-bite'],
  },
  'giant-boar': {
    id: 'giant-boar', name: 'Giant Boar',
    ac: 13, hp: 42, speed: 40,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 17, dex: 10, con: 16, int: 2, wis: 7, cha: 5 },
    featureIds: ['charge', 'relentless-endurance'],
    weaponIds: ['boar-tusk'],
  },
  'giant-constrictor-snake': {
    id: 'giant-constrictor-snake', name: 'Giant Constrictor Snake',
    ac: 12, hp: 60, speed: 30,
    creatureType: 'beast',
    size: 'huge',
    abilities: { str: 19, dex: 14, con: 12, int: 1, wis: 10, cha: 3 },
    weaponIds: ['snake-constrict', 'bite'],
  },

  gargoyle: {
    id: 'gargoyle', fly: true, name: 'Gargoyle',
    ac: 15, hp: 67, speed: 30,
    creatureType: 'elemental',
    size: 'medium',
    abilities: { str: 15, dex: 11, con: 16, int: 6, wis: 11, cha: 7 },
    weaponIds: ['gargoyle-bite', 'gargoyle-claws'],
    attacksPerAction: 2,
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  'fire-elemental': {
    id: 'fire-elemental', name: 'Fire Elemental',
    ac: 13, cr: 5, hp: 93, speed: 50,
    creatureType: 'elemental',
    size: 'large',
    abilities: { str: 10, dex: 17, con: 16, int: 6, wis: 10, cha: 7 },
    featureIds: ['fire-form'],
    weaponIds: ['fire-touch'],
    attacksPerAction: 2,
    immunities: ['fire', 'poison'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  'water-elemental': {
    id: 'water-elemental', name: 'Water Elemental',
    ac: 14, cr: 5, hp: 114, speed: 30,
    creatureType: 'elemental',
    size: 'large',
    abilities: { str: 18, dex: 14, con: 18, int: 5, wis: 10, cha: 8 },
    featureIds: ['whelm'],
    weaponIds: ['water-slam'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistances: ['acid'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  'earth-elemental': {
    id: 'earth-elemental', name: 'Earth Elemental',
    ac: 17, cr: 5, hp: 147, speed: 30,
    creatureType: 'elemental',
    size: 'large',
    abilities: { str: 20, dex: 8, con: 20, int: 5, wis: 10, cha: 5 },
    featureIds: ['earth-glide'],
    weaponIds: ['earth-slam'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  'air-elemental': {
    id: 'air-elemental', fly: true, name: 'Air Elemental',
    ac: 15, cr: 5, hp: 90, speed: 30,
    creatureType: 'elemental',
    size: 'large',
    abilities: { str: 14, dex: 20, con: 14, int: 6, wis: 10, cha: 6 },
    featureIds: ['whirlwind'],
    weaponIds: ['air-slam'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistances: ['lightning'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },

  sprite: {
    id: 'sprite', fly: true, name: 'Sprite',
    ac: 15, hp: 10, speed: 10,
    creatureType: 'fey',
    size: 'tiny',
    abilities: { str: 3, dex: 18, con: 10, int: 14, wis: 13, cha: 11 },
    featureIds: ['fey-invisibility'],
    weaponIds: ['sprite-shortbow'],
  },
  satyr: {
    id: 'satyr', name: 'Satyr',
    ac: 13, hp: 31, speed: 40,
    creatureType: 'fey',
    size: 'medium',
    abilities: { str: 12, dex: 16, con: 11, int: 12, wis: 10, cha: 14 },
    featureIds: ['magic-resistance'],
    weaponIds: ['satyr-shortsword', 'satyr-ram'],
  },
  dryad: {
    id: 'dryad', name: 'Dryad',
    ac: 16, hp: 22, speed: 30,
    creatureType: 'fey',
    size: 'medium',
    abilities: { str: 10, dex: 12, con: 11, int: 14, wis: 15, cha: 18 },
    featureIds: ['fey-charm'],
    weaponIds: ['dryad-club'],
    // A 2nd-level slot so Web (its control spell) is actually castable.
    spellcasting: { ability: 'wis', slots: [3, 1], spellIds: ['starry-wisp', 'cure-wounds', 'web'] },
  },
  'green-hag': {
    id: 'green-hag', name: 'Green Hag',
    ac: 17, hp: 82, speed: 30,
    creatureType: 'fey',
    size: 'medium',
    abilities: { str: 18, dex: 12, con: 16, int: 13, wis: 14, cha: 14 },
    featureIds: ['fey-invisibility'],
    weaponIds: ['hag-claws'],
    attacksPerAction: 2,
  },
  unicorn: {
    id: 'unicorn', name: 'Unicorn',
    ac: 12, cr: 5, hp: 97, speed: 50,
    creatureType: 'celestial',
    size: 'large',
    abilities: { str: 18, dex: 14, con: 15, int: 11, wis: 17, cha: 16 },
    featureIds: ['unicorn-charge', 'magic-resistance'],
    weaponIds: ['unicorn-horn', 'unicorn-hooves'],
    attacksPerAction: 2,
  },

  cockatrice: {
    id: 'cockatrice', name: 'Cockatrice',
    ac: 11, hp: 22, speed: 20,
    creatureType: 'monstrosity',
    size: 'small',
    abilities: { str: 6, dex: 12, con: 12, int: 2, wis: 13, cha: 5 },
    weaponIds: ['cockatrice-bite'],
  },
  harpy: {
    id: 'harpy', fly: true, name: 'Harpy',
    ac: 11, hp: 38, speed: 20,
    creatureType: 'monstrosity',
    size: 'medium',
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
    size: 'huge',
    abilities: { str: 21, dex: 8, con: 19, int: 5, wis: 9, cha: 6 },
    weaponIds: ['giant-greatclub', 'giant-rock'],
    attacksPerAction: 2,
  },
  'stone-giant': {
    id: 'stone-giant', name: 'Stone Giant',
    ac: 17, cr: 7, hp: 126, speed: 40,
    creatureType: 'giant',
    size: 'huge',
    abilities: { str: 23, dex: 15, con: 20, int: 10, wis: 12, cha: 9 },
    savingThrowProfs: ['dex', 'con', 'wis'],
    weaponIds: ['giant-greatclub', 'greater-giant-rock'],
    attacksPerAction: 2,
  },
  'frost-giant': {
    id: 'frost-giant', name: 'Frost Giant',
    ac: 15, cr: 8, hp: 149, speed: 40,
    creatureType: 'giant',
    size: 'huge',
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
    size: 'huge',
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
    id: 'dust-mephit', fly: true, name: 'Dust Mephit',
    deathBurst: { dice: '2d4', type: 'bludgeoning', save: { ability: 'dex', dc: 10 }, radius: 10 },
    ac: 12, hp: 17, speed: 30,
    creatureType: 'elemental',
    size: 'small',
    abilities: { str: 5, dex: 14, con: 10, int: 9, wis: 11, cha: 10 },
    weaponIds: ['mephit-claws-dust'],
    immunities: ['poison'],
  },
  'ice-mephit': {
    id: 'ice-mephit', fly: true, name: 'Ice Mephit',
    deathBurst: { dice: '2d4', type: 'cold', save: { ability: 'dex', dc: 10 }, radius: 10 },
    ac: 11, hp: 21, speed: 30,
    creatureType: 'elemental',
    size: 'small',
    abilities: { str: 7, dex: 13, con: 10, int: 9, wis: 11, cha: 12 },
    featureIds: ['breath-mephit-cold'],
    weaponIds: ['mephit-claws-cold'],
    immunities: ['cold', 'poison'],
    vulnerabilities: ['fire', 'bludgeoning'],
  },
  'magma-mephit': {
    id: 'magma-mephit', fly: true, name: 'Magma Mephit',
    deathBurst: { dice: '2d6', type: 'fire', save: { ability: 'dex', dc: 11 }, radius: 10 },
    ac: 11, hp: 18, speed: 30,
    creatureType: 'elemental',
    size: 'small',
    abilities: { str: 8, dex: 12, con: 12, int: 7, wis: 10, cha: 10 },
    featureIds: ['breath-mephit-fire'],
    weaponIds: ['mephit-claws-fire'],
    immunities: ['fire', 'poison'],
    vulnerabilities: ['cold'],
  },
  'steam-mephit': {
    id: 'steam-mephit', fly: true, name: 'Steam Mephit',
    deathBurst: { dice: '2d6', type: 'fire', save: { ability: 'dex', dc: 10 }, radius: 10 },
    ac: 10, hp: 17, speed: 30,
    creatureType: 'elemental',
    size: 'small',
    abilities: { str: 5, dex: 11, con: 10, int: 11, wis: 10, cha: 12 },
    featureIds: ['breath-mephit-fire'],
    weaponIds: ['mephit-claws-fire'],
    immunities: ['fire', 'poison'],
  },

  // ---- fiends, mid and top ----------------------------------------------
  // The type had six members, holes at 450 and 1,100, and nothing above
  // 2,300 -- the shallowest well-supported type in the SRD.
  succubus: {
    id: 'succubus', name: 'Succubus',
    ac: 15, cr: 4, hp: 71, speed: 30,
    creatureType: 'fiend',
    size: 'medium',
    abilities: { str: 8, dex: 17, con: 13, int: 15, wis: 12, cha: 20 },
    featureIds: ['charm'],
    weaponIds: ['succubus-claws'],
    resistances: ['cold', 'fire', 'lightning', 'poison'],
  },
  'bearded-devil': {
    id: 'bearded-devil', name: 'Bearded Devil',
    ac: 13, cr: 3, hp: 58, speed: 30,
    creatureType: 'fiend',
    size: 'medium',
    abilities: { str: 16, dex: 15, con: 15, int: 9, wis: 11, cha: 14 },
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
    size: 'medium',
    featureIds: ['magic-resistance'],
    abilities: { str: 18, dex: 15, con: 16, int: 16, wis: 14, cha: 16 },
    weaponIds: ['night-hag-claws'],
    resistances: ['cold', 'fire'],
    immunities: ['poison'],
    spellcasting: {
      ability: 'int', slots: [4, 3],
      spellIds: ['poison-spray', 'ray-of-sickness', 'magic-missile', 'sleep', 'hold-person', 'invisibility'],
    },
  },
  'chain-devil': {
    id: 'chain-devil', name: 'Chain Devil',
    ac: 15, cr: 8, hp: 85, speed: 30,
    creatureType: 'fiend',
    size: 'medium',
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
    size: 'large',
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
    size: 'large',
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
    size: 'large',
    abilities: { str: 22, dex: 17, con: 21, int: 12, wis: 16, cha: 18 },
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
    size: 'large',
    abilities: { str: 16, dex: 13, con: 13, int: 7, wis: 11, cha: 8 },
    featureIds: ['pack-tactics'],
    weaponIds: ['worg-bite'],
  },
  'rust-monster': {
    id: 'rust-monster', name: 'Rust Monster',
    ac: 14, hp: 33, speed: 40,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 13, dex: 12, con: 13, int: 2, wis: 13, cha: 6 },
    weaponIds: ['rust-monster-antennae'],
  },
  griffon: {
    id: 'griffon', fly: true, name: 'Griffon',
    ac: 12, cr: 2, hp: 59, speed: 30,
    creatureType: 'monstrosity',
    size: 'large',
    abilities: { str: 18, dex: 15, con: 16, int: 2, wis: 13, cha: 8 },
    weaponIds: ['griffon-claws', 'griffon-beak'],
    attacksPerAction: 2,
  },
  ettercap: {
    id: 'ettercap', name: 'Ettercap',
    ac: 13, cr: 2, hp: 44, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 14, dex: 15, con: 13, int: 7, wis: 12, cha: 8 },
    weaponIds: ['ettercap-bite', 'ettercap-claws'],
    attacksPerAction: 2,
  },
  'ettercap-snarecaller': {
    id: 'ettercap-snarecaller', name: 'Ettercap Snarecaller',
    // CR follows the XP, and the XP follows what it plays like rather than what
    // the base ettercap is worth: three ranks of slots on top of a CR 2 body is
    // a harder fight than a CR 2. (Still PB +2, so no to-hit or DC change.)
    ac: 13, cr: 3, hp: 44, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 12, dex: 15, con: 13, int: 9, wis: 16, cha: 10 },
    weaponIds: ['ettercap-bite'],
    // Entangle restrains, which the AI could not see the point of until the
    // condition was priced — see test/ai-conditions.test.ts. Web alongside it
    // rather than the Bestow Curse this originally carried: the curse was cast
    // zero times in thirty fights because a 3rd-level debuff loses to a
    // 1st-level lockdown in the same kit every time. Two ways to pin someone is
    // also simply what an ettercap is.
    spellcasting: { ability: 'wis', slots: [4, 3, 2], spellIds: ['poison-spray', 'entangle', 'web'] },
  },
  // Reuses Petrifying Breath for the gaze: the feature is "save or be locked
  // in place near me", which is the same thing the gaze does, and the engine
  // models petrification as restrained either way.
  basilisk: {
    id: 'basilisk', name: 'Basilisk',
    ac: 15, cr: 3, hp: 52, speed: 20,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 16, dex: 8, con: 15, int: 2, wis: 8, cha: 7 },
    featureIds: ['petrifying-breath'],
    weaponIds: ['basilisk-bite'],
  },
  'winter-wolf': {
    id: 'winter-wolf', name: 'Winter Wolf',
    ac: 13, cr: 3, hp: 75, speed: 50,
    creatureType: 'monstrosity',
    size: 'large',
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
    size: 'large',
    abilities: { str: 18, dex: 8, con: 17, int: 7, wis: 16, cha: 6 },
    weaponIds: ['roper-tendril', 'roper-bite'],
    attacksPerAction: 3,
  },
  bulette: {
    id: 'bulette', name: 'Bulette',
    ac: 17, cr: 5, hp: 94, speed: 40,
    creatureType: 'monstrosity',
    size: 'large',
    abilities: { str: 19, dex: 11, con: 21, int: 2, wis: 10, cha: 5 },
    featureIds: ['charge'],
    weaponIds: ['bulette-bite'],
  },
  remorhaz: {
    id: 'remorhaz', name: 'Remorhaz',
    ac: 17, cr: 11, hp: 195, speed: 40,
    creatureType: 'monstrosity',
    size: 'huge',
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
    size: 'large',
    abilities: { str: 16, dex: 11, con: 19, int: 6, wis: 13, cha: 6 },
    savingThrowProfs: ['con'],
    weaponIds: ['otyugh-tentacle', 'otyugh-bite'],
    attacksPerAction: 3,
  },
  aboleth: {
    id: 'aboleth', name: 'Aboleth',
    ac: 17, cr: 10, hp: 150, speed: 10,
    creatureType: 'aberration',
    size: 'large',
    abilities: { str: 21, dex: 9, con: 15, int: 18, wis: 15, cha: 18 },
    savingThrowProfs: ['con', 'int', 'wis'],
    featureIds: ['magic-resistance'],
    weaponIds: ['aboleth-tentacle', 'aboleth-tail'],
    attacksPerAction: 3,
    spellcasting: {
      ability: 'int', slots: [4, 3],
      spellIds: ['acid-splash', 'ray-of-sickness', 'hold-person', 'blindness', 'fear'],
    },
  },

  // The one hole left in the beasts.
  tyrannosaurus: {
    id: 'tyrannosaurus', name: 'Tyrannosaurus Rex',
    ac: 13, cr: 8, hp: 136, speed: 50,
    creatureType: 'beast',
    size: 'huge',
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
    size: 'medium',
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
    size: 'medium',
    abilities: { str: 1, dex: 14, con: 10, int: 12, wis: 11, cha: 17 },
    savingThrowProfs: ['wis', 'cha'],
    weaponIds: ['banshee-touch'],
    featureIds: ['wail', 'horrifying-visage'],
    resistances: ['cold', 'necrotic'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
    immunities: ['poison'],
  },
  ghost: {
    id: 'ghost', fly: true, name: 'Ghost',
    ac: 11, cr: 4, hp: 45, speed: 30,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 7, dex: 13, con: 10, int: 10, wis: 12, cha: 17 },
    weaponIds: ['ghost-touch'],
    resistances: ['acid', 'cold', 'fire', 'lightning'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
    immunities: ['necrotic', 'poison'],
  },
  wraith: {
    id: 'wraith', fly: true, name: 'Wraith',
    ac: 13, cr: 5, hp: 67, speed: 30,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 6, dex: 16, con: 16, int: 12, wis: 14, cha: 15 },
    weaponIds: ['wraith-touch'],
    resistances: ['acid', 'cold', 'fire', 'lightning', 'necrotic'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
    immunities: ['poison'],
  },
  'vampire-spawn': {
    id: 'vampire-spawn', name: 'Vampire Spawn',
    ac: 16, cr: 5, hp: 90, speed: 30,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 16, dex: 16, con: 16, int: 11, wis: 10, cha: 12 },
    savingThrowProfs: ['dex', 'wis'],
    weaponIds: ['spawn-claws', 'spawn-bite'],
    attacksPerAction: 2,
    resistances: ['necrotic'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },

  // Beasts stopped at the giant boar (CR 2). A dinosaur is a legitimate arena
  // opponent in a way a fourth dire wolf is not.
  'giant-scorpion': {
    id: 'giant-scorpion', name: 'Giant Scorpion',
    ac: 15, cr: 3, hp: 52, speed: 40,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 16, dex: 13, con: 15, int: 1, wis: 9, cha: 3 },
    weaponIds: ['scorpion-sting', 'scorpion-claw'],
    attacksPerAction: 3,
  },
  elephant: {
    id: 'elephant', name: 'Elephant',
    ac: 12, cr: 4, hp: 76, speed: 40,
    creatureType: 'beast',
    size: 'huge',
    abilities: { str: 22, dex: 9, con: 17, int: 3, wis: 11, cha: 6 },
    featureIds: ['trampling-charge'],
    weaponIds: ['elephant-gore'],
  },
  'giant-crocodile': {
    id: 'giant-crocodile', name: 'Giant Crocodile',
    ac: 14, cr: 5, hp: 85, speed: 30,
    creatureType: 'beast',
    size: 'huge',
    abilities: { str: 21, dex: 9, con: 17, int: 2, wis: 10, cha: 7 },
    weaponIds: ['crocodile-bite'],
    attacksPerAction: 2,
  },
  mammoth: {
    id: 'mammoth', name: 'Mammoth',
    ac: 13, cr: 6, hp: 126, speed: 50,
    creatureType: 'beast',
    size: 'huge',
    abilities: { str: 24, dex: 9, con: 21, int: 3, wis: 11, cha: 6 },
    featureIds: ['trampling-charge'],
    weaponIds: ['mammoth-gore', 'mammoth-stomp'],
  },
  'giant-ape': {
    id: 'giant-ape', name: 'Giant Ape',
    ac: 12, cr: 7, hp: 168, speed: 40,
    creatureType: 'beast',
    size: 'huge',
    abilities: { str: 23, dex: 14, con: 18, int: 5, wis: 12, cha: 7 },
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
    size: 'medium',
    abilities: { str: 16, dex: 12, con: 17, int: 9, wis: 11, cha: 9 },
    featureIds: ['relentless-endurance'],
    weaponIds: ['greataxe'],
  },
  veteran: {
    id: 'veteran', name: 'Warrior Veteran',
    ac: 17, cr: 3, hp: 65, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10 },
    weaponIds: ['longsword', 'shortsword', 'light-crossbow'],
    metalArmor: true,
    attacksPerAction: 2,
  },
  gladiator: {
    id: 'gladiator', name: 'Gladiator',
    ac: 16, cr: 5, hp: 112, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 18, dex: 15, con: 16, int: 10, wis: 12, cha: 15 },
    savingThrowProfs: ['str', 'dex', 'con'],
    featureIds: ['brute'],
    weaponIds: ['gladiator-spear'],
    metalArmor: true,
    attacksPerAction: 3,
  },
  /**
   * The SRD's Druid as an NPC — the one caster whose kit persists between turns.
   * Call Lightning re-strikes each round and Moonbeam burns whatever stands in
   * it, so it is the first enemy that makes standing still actively wrong
   * rather than merely suboptimal.
   *
   * Priced by what it plays like rather than by its CR: 3rd-level slots on a
   * spell that fires again every round is a great deal more than a CR 2 body.
   *
   * `druid` is also a player class id. They live in separate tables (MONSTERS
   * vs CLASSES) and every CLASSES lookup runs over campaign characters rather
   * than combatants, so the two never meet — but it is worth knowing.
   */
  druid: {
    id: 'druid', name: 'Druid',
    ac: 13, cr: 4, hp: 44, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 10, dex: 12, con: 13, int: 12, wis: 16, cha: 11 },
    weaponIds: ['quarterstaff'],
    // Six slots, not nine. At [4,3,2] the druid could cast a leveled spell every
    // round of a fight that lasts six and never once reach for its cantrip,
    // which made Starry Wisp dead data. A caster should run dry and fall back.
    // Poison Spray rather than Starry Wisp: a druid holding Moonbeam and Call
    // Lightning has two spells that re-fire for free every round, so a weak
    // damage cantrip never wins its action. Poison Spray is the hardest-hitting
    // cantrip on the SRD druid list (1d12, Constitution save) and lands often
    // enough to be worth the turn.
    spellcasting: { ability: 'wis', slots: [3, 2, 1], spellIds: ['poison-spray', 'moonbeam', 'call-lightning'] },
  },
  'apprentice-mage': {
    id: 'apprentice-mage', name: 'Apprentice Mage',
    ac: 12, hp: 18, speed: 30,
    creatureType: 'humanoid',
    size: 'medium',
    abilities: { str: 9, dex: 14, con: 12, int: 15, wis: 11, cha: 10 },
    weaponIds: ['dagger'],
    // The Mage's low-level counterpart, and the party's first taste of arcane
    // control: Color Spray blinds a cone outright, with no damage attached, so
    // it has to be answered rather than out-healed.
    spellcasting: { ability: 'int', slots: [2], spellIds: ['ray-of-frost', 'color-spray'] },
  },
  mage: {
    id: 'mage', name: 'Mage',
    ac: 15, cr: 6, hp: 81, speed: 30, // AC 15 assumes Mage Armor precast
    creatureType: 'humanoid',
    size: 'medium',
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
    size: 'medium',
    abilities: { str: 11, dex: 18, con: 14, int: 16, wis: 11, cha: 10 },
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
    size: 'medium',
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
    size: 'large',
    abilities: { str: 18, dex: 8, con: 18, int: 7, wis: 10, cha: 3 },
    weaponIds: ['guardian-fist'],
    attacksPerAction: 2,
    immunities: ['poison'],
  },
  'stone-golem': {
    id: 'stone-golem', name: 'Stone Golem',
    ac: 18, cr: 10, hp: 220, speed: 30,
    creatureType: 'construct',
    size: 'large',
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
    deathBurst: { dice: '2d6', type: 'fire', save: { ability: 'dex', dc: 11 }, radius: 10 },
    ac: 14, hp: 13, speed: 30,
    creatureType: 'elemental',
    size: 'small',
    abilities: { str: 7, dex: 15, con: 12, int: 8, wis: 11, cha: 10 },
    weaponIds: ['magmin-touch'],
    immunities: ['fire'],
    vulnerabilities: ['cold'],
  },
  azer: {
    id: 'azer', name: 'Azer Sentinel',
    ac: 17, cr: 2, hp: 39, speed: 30,
    creatureType: 'elemental',
    size: 'medium',
    abilities: { str: 17, dex: 12, con: 15, int: 12, wis: 13, cha: 10 },
    savingThrowProfs: ['con'],
    weaponIds: ['azer-hammer'],
    metalArmor: true,
    immunities: ['fire', 'poison'],
  },
  'azer-forgecaller': {
    id: 'azer-forgecaller', name: 'Azer Forgecaller',
    ac: 16, cr: 4, hp: 39, speed: 30,
    creatureType: 'elemental',
    size: 'medium',
    abilities: { str: 14, dex: 12, con: 15, int: 14, wis: 13, cha: 12 },
    savingThrowProfs: ['con'],
    weaponIds: ['azer-hammer'],
    metalArmor: true,
    immunities: ['fire', 'poison'],
    // The first enemy that targets a hero for their *gear*: Heat Metal punishes
    // plate and a metal weapon specifically, which asks the fighter and the
    // paladin a question nothing else in the game asks them.
    spellcasting: { ability: 'int', slots: [4, 3], spellIds: ['fire-bolt', 'heat-metal', 'flaming-sphere'] },
  },
  salamander: {
    id: 'salamander', name: 'Salamander',
    ac: 15, cr: 5, hp: 90, speed: 30,
    creatureType: 'elemental',
    size: 'large',
    abilities: { str: 18, dex: 14, con: 15, int: 11, wis: 10, cha: 12 },
    weaponIds: ['salamander-spear', 'salamander-tail'],
    attacksPerAction: 2,
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
    immunities: ['fire'],
    vulnerabilities: ['cold'],
  },
  'invisible-stalker': {
    id: 'invisible-stalker', name: 'Invisible Stalker',
    ac: 14, cr: 6, hp: 97, speed: 50,
    creatureType: 'elemental',
    size: 'large',
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
    id: 'imp', fly: true, name: 'Imp',
    ac: 13, cr: 1, hp: 21, speed: 20,
    creatureType: 'fiend',
    size: 'tiny',
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
    size: 'tiny',
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
    size: 'small',
    abilities: { str: 12, dex: 11, con: 12, int: 5, wis: 8, cha: 3 },
    weaponIds: ['dretch-claws', 'dretch-bite'],
    attacksPerAction: 2,
    resistances: ['cold', 'fire', 'lightning'],
    immunities: ['poison'],
  },
  'hell-hound': {
    id: 'hell-hound', name: 'Hell Hound',
    ac: 15, cr: 3, hp: 58, speed: 50,
    creatureType: 'fiend',
    size: 'medium',
    abilities: { str: 17, dex: 12, con: 14, int: 6, wis: 13, cha: 6 },
    featureIds: ['pack-tactics', 'breath-fire-hound'],
    weaponIds: ['hell-hound-bite'],
    immunities: ['fire'],
  },
  'barbed-devil': {
    id: 'barbed-devil', name: 'Barbed Devil',
    ac: 15, cr: 5, hp: 110, speed: 30,
    creatureType: 'fiend',
    size: 'medium',
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
    size: 'large',
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
    size: 'medium',
    abilities: { str: 12, dex: 6, con: 16, int: 1, wis: 6, cha: 2 },
    weaponIds: ['gray-ooze-pseudopod'],
    resistances: ['acid', 'cold', 'fire'],
    immunities: ['poison'],
  },
  'ochre-jelly': {
    id: 'ochre-jelly', name: 'Ochre Jelly',
    ac: 8, cr: 2, hp: 52, speed: 20,
    creatureType: 'ooze',
    size: 'large',
    abilities: { str: 15, dex: 6, con: 14, int: 2, wis: 6, cha: 1 },
    weaponIds: ['ochre-jelly-pseudopod'],
    resistances: ['acid'],
    immunities: ['lightning', 'slashing', 'poison'],
  },
  'gelatinous-cube': {
    id: 'gelatinous-cube', name: 'Gelatinous Cube',
    ac: 6, cr: 2, hp: 63, speed: 15,
    creatureType: 'ooze',
    size: 'large',
    abilities: { str: 14, dex: 3, con: 20, int: 1, wis: 6, cha: 1 },
    weaponIds: ['cube-pseudopod'],
    featureIds: ['engulf'],
    holdDamage: { dice: '3d6', type: 'acid' },
    immunities: ['poison'],
  },
  'black-pudding': {
    id: 'black-pudding', name: 'Black Pudding',
    ac: 7, cr: 4, hp: 68, speed: 20,
    creatureType: 'ooze',
    size: 'large',
    abilities: { str: 16, dex: 5, con: 16, int: 1, wis: 6, cha: 1 },
    weaponIds: ['black-pudding-pseudopod'],
    immunities: ['acid', 'cold', 'lightning', 'slashing', 'poison'],
  },

  // ---- constructs -------------------------------------------------------
  // One animated armor was the whole type.
  'flying-sword': {
    id: 'flying-sword', fly: true, name: 'Animated Flying Sword',
    ac: 17, hp: 14, speed: 30,
    creatureType: 'construct',
    size: 'small',
    abilities: { str: 12, dex: 15, con: 11, int: 1, wis: 5, cha: 1 },
    weaponIds: ['flying-sword-blade'],
    metalArmor: true,
    immunities: ['poison', 'psychic'],
  },
  'rug-of-smothering': {
    id: 'rug-of-smothering', name: 'Animated Rug of Smothering',
    ac: 12, cr: 2, hp: 27, speed: 10,
    creatureType: 'construct',
    size: 'large',
    abilities: { str: 17, dex: 14, con: 10, int: 1, wis: 3, cha: 1 },
    weaponIds: ['rug-smother'],
    immunities: ['poison', 'psychic'],
  },
  'flesh-golem': {
    id: 'flesh-golem', name: 'Flesh Golem',
    ac: 9, cr: 5, hp: 127, speed: 30,
    creatureType: 'construct',
    size: 'medium',
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
    size: 'large',
    abilities: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
    weaponIds: ['troll-claw', 'troll-bite'],
    attacksPerAction: 3, // bite and two claws
    regeneration: { amount: 10, stoppedBy: ['acid', 'fire'] },
  },
  chimera: {
    id: 'chimera', name: 'Chimera',
    ac: 14, cr: 6, hp: 114, speed: 30,
    creatureType: 'monstrosity',
    size: 'large',
    abilities: { str: 19, dex: 11, con: 19, int: 3, wis: 14, cha: 10 },
    featureIds: ['breath-fire-chimera'],
    weaponIds: ['chimera-bite', 'chimera-horns', 'chimera-claws'],
    attacksPerAction: 3,
  },
  wyvern: {
    id: 'wyvern', fly: true, name: 'Wyvern',
    ac: 14, cr: 6, hp: 127, speed: 30,
    creatureType: 'dragon',
    size: 'large',
    abilities: { str: 19, dex: 10, con: 16, int: 5, wis: 12, cha: 6 },
    weaponIds: ['wyvern-sting', 'wyvern-bite'],
    attacksPerAction: 2,
  },
  // Five heads, five bites: the hydra is the action-economy monster, a wall of
  // attacks on one body rather than the reverse.
  hydra: {
    id: 'hydra', name: 'Hydra',
    ac: 15, cr: 8, hp: 184, speed: 40,
    creatureType: 'monstrosity',
    size: 'huge',
    abilities: { str: 20, dex: 12, con: 20, int: 2, wis: 10, cha: 7 },
    savingThrowProfs: ['dex', 'con', 'wis'],
    weaponIds: ['hydra-bite'],
    attacksPerAction: 5,
  },
  // Young dragons: the wyrmlings one age category on. Same shape as the
  // wyrmling blocks, with the heavier breath spec and a claw routine.
  'young-white': {
    id: 'young-white', name: 'Young White Dragon',
    ac: 17, cr: 6, hp: 123, speed: 40,
    creatureType: 'dragon',
    size: 'large',
    abilities: { str: 18, dex: 10, con: 18, int: 6, wis: 11, cha: 12 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-cold-young'],
    weaponIds: ['young-white-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['cold'],
  },
  'young-black': {
    id: 'young-black', name: 'Young Black Dragon',
    ac: 18, cr: 7, hp: 127, speed: 40,
    creatureType: 'dragon',
    size: 'large',
    abilities: { str: 19, dex: 14, con: 17, int: 12, wis: 11, cha: 15 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-acid-young'],
    weaponIds: ['young-black-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['acid'],
  },
  'young-green': {
    id: 'young-green', name: 'Young Green Dragon',
    ac: 18, cr: 8, hp: 136, speed: 40,
    creatureType: 'dragon',
    size: 'large',
    abilities: { str: 19, dex: 12, con: 17, int: 16, wis: 13, cha: 15 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-poison-young'],
    weaponIds: ['young-green-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['poison'],
  },
  'young-blue': {
    id: 'young-blue', name: 'Young Blue Dragon',
    ac: 18, cr: 9, hp: 152, speed: 40,
    creatureType: 'dragon',
    size: 'large',
    abilities: { str: 21, dex: 10, con: 19, int: 14, wis: 13, cha: 17 },
    savingThrowProfs: ['dex', 'con', 'wis', 'cha'],
    featureIds: ['breath-lightning-young'],
    weaponIds: ['young-blue-bite', 'young-dragon-claws'],
    attacksPerAction: 3,
    immunities: ['lightning'],
  },
  'young-red': {
    id: 'young-red', name: 'Young Red Dragon',
    ac: 18, cr: 10, hp: 178, speed: 40,
    creatureType: 'dragon',
    size: 'large',
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
    size: 'large',
    abilities: { str: 17, dex: 16, con: 17, int: 7, wis: 12, cha: 8 },
    weaponIds: ['manticore-spike', 'manticore-bite', 'manticore-claws'],
    attacksPerAction: 3,
  },
  owlbear: {
    id: 'owlbear', name: 'Owlbear',
    ac: 13, hp: 59, speed: 40,
    creatureType: 'monstrosity',
    size: 'large',
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    weaponIds: ['owlbear-beak', 'owlbear-claws'],
    attacksPerAction: 2,
  },
  gorgon: {
    id: 'gorgon', name: 'Gorgon',
    ac: 19, cr: 5, hp: 114, speed: 40,
    creatureType: 'construct',
    size: 'large',
    abilities: { str: 20, dex: 11, con: 18, int: 2, wis: 12, cha: 7 },
    featureIds: ['petrifying-breath', 'trampling-charge'],
    weaponIds: ['gorgon-gore', 'gorgon-hooves'],
    attacksPerAction: 2,
  },

  shadow: {
    id: 'shadow', name: 'Shadow',
    ac: 12, hp: 27, speed: 40,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 6, dex: 14, con: 13, int: 6, wis: 10, cha: 8 },
    weaponIds: ['shadow-drain'],
    vulnerabilities: ['radiant'],
    immunities: ['necrotic', 'poison'],
    resistances: ['acid', 'fire', 'lightning', 'thunder'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  specter: {
    id: 'specter', fly: true, name: 'Specter',
    ac: 12, hp: 22, speed: 50,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 1, dex: 14, con: 11, int: 10, wis: 10, cha: 11 },
    weaponIds: ['specter-drain'],
    immunities: ['necrotic', 'poison'],
    resistances: ['acid', 'fire', 'lightning', 'thunder'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  'will-o-wisp': {
    id: 'will-o-wisp', fly: true, name: "Will-o'-Wisp",
    ac: 19, hp: 27, speed: 50,
    creatureType: 'undead',
    size: 'tiny',
    abilities: { str: 1, dex: 28, con: 10, int: 13, wis: 14, cha: 11 },
    featureIds: ['consume-life'],
    weaponIds: ['wisp-shock'],
    immunities: ['lightning', 'poison'],
    resistances: ['acid', 'fire', 'necrotic', 'thunder'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  wight: {
    id: 'wight', name: 'Wight',
    ac: 14, hp: 82, speed: 30,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 15, dex: 14, con: 16, int: 10, wis: 13, cha: 15 },
    weaponIds: ['wight-longsword', 'wight-drain'],
    attacksPerAction: 2,
    immunities: ['poison'],
    resistances: ['necrotic'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
  mummy: {
    id: 'mummy', name: 'Mummy',
    ac: 11, hp: 58, speed: 20,
    creatureType: 'undead',
    size: 'medium',
    abilities: { str: 16, dex: 8, con: 15, int: 6, wis: 12, cha: 12 },
    featureIds: ['dreadful-glare'],
    weaponIds: ['mummy-fist'],
    attacksPerAction: 2,
    vulnerabilities: ['fire'],
    immunities: ['necrotic', 'poison'],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },

  // Chromatic dragon wyrmlings. Bite + a Recharge-5–6 elemental breath (shape,
  // save, and dice per BREATH_WEAPONS); each is immune to its own element. Fly
  // speed isn't modelled, so they keep a ground speed. PB +2 (all wyrmlings are
  // CR 2–4) makes their breath DCs land at the SRD's 11–13.
  'black-wyrmling': {
    id: 'black-wyrmling', fly: true, name: 'Black Dragon Wyrmling',
    ac: 17, hp: 33, speed: 30, cr: 2,
    creatureType: 'dragon',
    size: 'medium',
    abilities: { str: 15, dex: 14, con: 13, int: 10, wis: 11, cha: 13 },
    featureIds: ['breath-acid'],
    weaponIds: ['wyrmling-black-bite'],
    immunities: ['acid'],
  },
  'blue-wyrmling': {
    id: 'blue-wyrmling', fly: true, name: 'Blue Dragon Wyrmling',
    ac: 17, hp: 65, speed: 30, cr: 3,
    creatureType: 'dragon',
    size: 'medium',
    abilities: { str: 17, dex: 10, con: 15, int: 12, wis: 11, cha: 15 },
    featureIds: ['breath-lightning'],
    weaponIds: ['wyrmling-blue-bite'],
    immunities: ['lightning'],
  },
  'green-wyrmling': {
    id: 'green-wyrmling', fly: true, name: 'Green Dragon Wyrmling',
    ac: 17, hp: 38, speed: 30, cr: 2,
    creatureType: 'dragon',
    size: 'medium',
    abilities: { str: 15, dex: 12, con: 13, int: 14, wis: 11, cha: 13 },
    featureIds: ['breath-poison'],
    weaponIds: ['wyrmling-green-bite'],
    immunities: ['poison'],
  },
  'red-wyrmling': {
    id: 'red-wyrmling', fly: true, name: 'Red Dragon Wyrmling',
    ac: 17, hp: 75, speed: 30, cr: 4,
    creatureType: 'dragon',
    size: 'medium',
    abilities: { str: 19, dex: 10, con: 17, int: 12, wis: 11, cha: 15 },
    featureIds: ['breath-fire'],
    weaponIds: ['wyrmling-red-bite'],
    immunities: ['fire'],
  },
  'white-wyrmling': {
    id: 'white-wyrmling', fly: true, name: 'White Dragon Wyrmling',
    ac: 16, hp: 32, speed: 30, cr: 2,
    creatureType: 'dragon',
    size: 'medium',
    abilities: { str: 14, dex: 10, con: 14, int: 5, wis: 10, cha: 11 },
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
        // No monster carries Bardic Inspiration; if one ever does, its
        // Charisma decides the pool the same way a bard's does.
        f.uses.count === 'charismaMod' ? Math.max(1, abilityMod(m.abilities.cha)) :
        // Nor does any monster carry Focus Points, but the same rule applies:
        // one per level, so the two builders cannot disagree about a feature
        // that ends up on both.
        f.uses.count === 'level' ? level :
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
    /**
     * Athletics and Acrobatics, DERIVED from the save proficiencies the stat
     * blocks already carry rather than invented per monster.
     *
     * Shove is now an opposed Athletics check (see rules/shove.ts), and monsters
     * have no skill list at all. Without this, switching from a saving throw to
     * a contest would quietly STRIP proficiency from every monster that had
     * Strength or Dexterity save proficiency — making shove better against
     * exactly the creatures built to resist being moved. The stat block already
     * says "this thing is trained at not being budged"; this reads that answer
     * instead of guessing a new one.
     */
    skillProfs: [
      ...(m.savingThrowProfs?.includes('str') ? ['athletics' as const] : []),
      ...(m.savingThrowProfs?.includes('dex') ? ['acrobatics' as const] : []),
    ],
    // Monsters cast from their stat block, which is a class-caster equivalent
    // for attunement purposes -- they never hold player wands, but the field
    // must not be silently false for a dragon.
    ...(m.spellcasting ? { classCaster: true as const } : {}),
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
    ...(m.resistNonmagical ? { resistNonmagical: [...m.resistNonmagical] } : {}),
    ...(m.shapechanger ? { shapechanger: true as const } : {}),
    vulnerabilities: [...(m.vulnerabilities ?? [])],
    immunities: [...(m.immunities ?? [])],
    conditions: [],
    hasActed: false,
    turn: {
      actionUsed: false, bonusActionUsed: false, reactionUsed: false,
      movementUsed: 0, movementMax: m.speed, disengaged: false,
      attackedThisTurn: false, attacksLeft: 0, interacted: false, sneakAttackUsed: false,
      colossusUsed: false, savageUsed: false,
      leveledSpellCast: false,
      quickenedThisTurn: false,
    },
    alive: true,
    creatureType: m.creatureType,
    size: m.size,
    ...(m.fly ? { flying: true as const } : {}),
    // Copied, not shared: `suppressed` is per-combatant turn state, and three
    // trolls from one stat block must not share one flag.
    ...(m.regeneration
      ? { regeneration: { amount: m.regeneration.amount, stoppedBy: [...m.regeneration.stoppedBy] } }
      : {}),
    ...(m.holdDamage ? { holdDamage: { ...m.holdDamage } } : {}),
    ...(m.deathBurst ? { deathBurst: { ...m.deathBurst, save: { ...m.deathBurst.save } } } : {}),
  };
}

export const MONSTER_XP: Record<Id, number> = {
  'goblin-warrior': 50, 'goblin-boss': 200, skeleton: 50, wolf: 50, zombie: 50, ogre: 450,
  bandit: 25, 'bandit-captain': 450, 'dire-wolf': 200, ghoul: 200, 'giant-spider': 200, acolyte: 50,
  kobold: 25, scout: 100, orc: 100,
  // Caster variants: priced above their base for the magic they add.
  'goblin-hexer': 100, 'kobold-emberling': 50, 'skeleton-bonechanter': 200, 'apprentice-mage': 200,
  'gnoll-packcaller': 450, 'ettercap-snarecaller': 700, 'azer-forgecaller': 1100, druid: 1100, 'brown-bear': 200, 'cult-fanatic': 450, 'animated-armor': 200,
  knight: 700, minotaur: 700, ettin: 1100,
  priest: 450,
  // CR 7 -- 90 HP, AC 15, Fireball. It was priced at 1,100 (the CR 4 value),
  // so every fight holding one was budgeted at well under half what it plays
  // like, in the arena and on the ladder alike.
  'ogre-mage': 2900,
  // Lycanthropes, by CR: 2, 3, 4, 4, 5.
  wererat: 450, werewolf: 700, wereboar: 1100, weretiger: 1100, werebear: 1800,
  guard: 25, bugbear: 200, lizardfolk: 100, gnoll: 100, spy: 200,
  'giant-badger': 50, 'giant-toad': 200, 'giant-hyena': 200, 'giant-boar': 450, 'giant-constrictor-snake': 450,
  lion: 200,
  gargoyle: 450, 'fire-elemental': 1800, 'water-elemental': 1800, 'earth-elemental': 1800, 'air-elemental': 1800,
  sprite: 50, satyr: 100, dryad: 200, 'green-hag': 700, unicorn: 1800,
  cockatrice: 100, harpy: 200, manticore: 700, owlbear: 700, gorgon: 1800,
  shadow: 100, specter: 200, 'will-o-wisp': 450, wight: 700, mummy: 700,
  'black-wyrmling': 450, 'green-wyrmling': 450, 'white-wyrmling': 450,
  'blue-wyrmling': 700, 'red-wyrmling': 1100,
  // CR 5-10. The band above 1,800 was empty before these.
  // Mephits, fiend mid/top, monstrosity mid/top.
  // Not a tidy 50/100 split by element, however much it looks like one: the
  // SRD puts Dust, Ice and Magma at CR 1/2 and Steam alone at CR 1/4. Dust and
  // Steam were the wrong way round. Mud and Smoke are not in SRD 5.2.1 at all,
  // and keep their 2014 CR 1/4.
  'dust-mephit': 100, 'ice-mephit': 100, 'magma-mephit': 100,
  'steam-mephit': 50,
  succubus: 1100, 'bearded-devil': 700, 'night-hag': 1800,
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

/**
 * Can this creature hurt you without walking to you first?
 *
 * Weapons with a range, plus stat-block spellcasting — deliberately NOT
 * breath weapons and gazes, which are 15-30 ft cones and cannot reach a party
 * holding the far rank. The question this answers is exactly "can it punish
 * standing still", so short-range area attacks are correctly excluded.
 *
 * Two thirds of the bestiary answers no (69 of 105 at arena CR), and that is
 * why positioning was close to free: against a wave that must come to you,
 * holding the back rank is not a tactic, it is the whole game. Measured, at
 * level 1 across 40 seeds: against melee-only foes a party that never took a
 * single step won as often as one played properly, while against bandits with
 * crossbows the same refusal to move cost 20 points of win rate.
 */
export function canThreatenAtRange(monsterId: Id): boolean {
  const m = MONSTERS[monsterId];
  if (!m) return false;
  if (m.spellcasting) return true;
  return (m.weaponIds ?? []).some((w) => WEAPONS[w]?.range !== undefined);
}
