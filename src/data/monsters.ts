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
}

export const MONSTERS: Record<Id, MonsterData> = {
  'goblin-warrior': {
    id: 'goblin-warrior', name: 'Goblin Warrior',
    ac: 15, hp: 10, speed: 30,
    creatureType: 'humanoid',
    abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
    featureIds: ['nimble-escape', 'nimble-hide'],
    weaponIds: ['goblin-scimitar', 'goblin-shortbow'],
  },
  'goblin-boss': {
    id: 'goblin-boss', name: 'Goblin Boss',
    ac: 17, hp: 21, speed: 30,
    creatureType: 'humanoid',
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
    weaponIds: ['bite'],
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
    id: 'kobold', name: 'Kobold',
    ac: 12, hp: 5, speed: 30,
    creatureType: 'humanoid',
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
    ac: 11, hp: 34, speed: 40,
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
    id: 'minotaur', name: 'Minotaur',
    ac: 14, hp: 76, speed: 40,
    creatureType: 'giant', // no 'monstrosity' type; giant is the closest tag
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
    ac: 13, hp: 27, speed: 30, // chain shirt
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
    id: 'ogre-mage', name: 'Ogre Mage',
    ac: 15, hp: 90, speed: 30, // AC 15 assumes Mage Armor precast (13 + Dex 2)
    creatureType: 'giant',
    abilities: { str: 19, dex: 14, con: 17, int: 14, wis: 12, cha: 15 },
    savingThrowProfs: ['con', 'int'],
    weaponIds: ['greatclub'],
    // An arcane brute: it blasts and controls, and can wade in with the club.
    spellcasting: {
      ability: 'int', slots: [4, 3, 2],
      spellIds: ['fire-bolt', 'magic-missile', 'web', 'fireball'],
    },
  },
};

export function buildMonster(monsterId: Id, team: TeamId, position: Position, suffix = ''): Combatant {
  const m = MONSTERS[monsterId];
  if (!m) throw new Error(`Unknown monster: ${monsterId}`);
  // Feature-use pools, same as the character builder (level 1 → PB +2).
  const featureUses: Record<Id, ResourcePool> = {};
  for (const fid of m.featureIds ?? []) {
    const f = FEATURES[fid];
    if (f?.uses) {
      const count = f.uses.count === 'proficiency' ? proficiencyBonus(1) : f.uses.count;
      featureUses[fid] = { current: count, max: count };
    }
  }
  return {
    id: `${team}-${monsterId}${suffix}`,
    name: suffix ? `${m.name} ${suffix}` : m.name,
    team,
    classId: monsterId,
    speciesId: 'monster',
    level: 1, // PB +2, matching all CR ≤ 2 stat blocks here
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
    },
    alive: true,
    creatureType: m.creatureType,
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
    id: 'oni', name: 'Ogre Mage\'s Warband', suggestedLevel: 5,
    members: ['ogre-mage', 'ogre', 'orc'],
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
  priest: 450, 'ogre-mage': 1100,
};

/** Total XP an encounter is worth (sum of member XP). */
export function encounterXP(encounterId: Id): number {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) return 0;
  return enc.members.reduce((sum, mid) => sum + (MONSTER_XP[mid] ?? 0), 0);
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
