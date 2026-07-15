/**
 * Monster stat blocks (SRD 5.2.1, simplified) and encounter definitions.
 * A monster is data through the same Combatant shape as a character; attack
 * bonuses derive from abilities + proficiency exactly like PCs (the stat
 * blocks below reproduce the SRD's printed bonuses at PB +2).
 */
import type { Combatant, TeamId, Position, AbilityScores, Ability, DamageType, Id } from '../engine/types.js';

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
}

export const MONSTERS: Record<Id, MonsterData> = {
  'goblin-warrior': {
    id: 'goblin-warrior', name: 'Goblin Warrior',
    ac: 15, hp: 10, speed: 30,
    abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
    featureIds: ['nimble-escape', 'nimble-hide'],
    weaponIds: ['goblin-scimitar', 'goblin-shortbow'],
  },
  'goblin-boss': {
    id: 'goblin-boss', name: 'Goblin Boss',
    ac: 17, hp: 21, speed: 30,
    abilities: { str: 10, dex: 15, con: 10, int: 10, wis: 8, cha: 10 },
    featureIds: ['nimble-escape', 'nimble-hide'],
    weaponIds: ['goblin-scimitar', 'goblin-shortbow'],
    metalArmor: true, // chain shirt
    attacksPerAction: 2,
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton',
    ac: 14, hp: 13, speed: 30,
    abilities: { str: 10, dex: 16, con: 15, int: 6, wis: 8, cha: 5 },
    weaponIds: ['shortsword', 'shortbow'],
    metalArmor: false,
    vulnerabilities: ['bludgeoning'],
    immunities: ['poison'],
  },
  wolf: {
    id: 'wolf', name: 'Wolf',
    ac: 12, hp: 11, speed: 40,
    abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    featureIds: ['pack-tactics'],
    weaponIds: ['bite'],
  },
  zombie: {
    id: 'zombie', name: 'Zombie',
    ac: 8, hp: 15, speed: 20,
    abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    featureIds: ['undead-fortitude'],
    weaponIds: ['slam'],
    immunities: ['poison'],
  },
  ogre: {
    id: 'ogre', name: 'Ogre',
    ac: 11, hp: 68, speed: 40,
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    weaponIds: ['greatclub', 'ogre-javelin'],
  },
  bandit: {
    id: 'bandit', name: 'Bandit',
    ac: 12, hp: 11, speed: 30,
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    weaponIds: ['scimitar', 'light-crossbow'],
  },
  'bandit-captain': {
    id: 'bandit-captain', name: 'Bandit Captain',
    ac: 15, hp: 52, speed: 30,
    abilities: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    savingThrowProfs: ['str', 'dex', 'wis'],
    weaponIds: ['scimitar', 'dagger'],
    attacksPerAction: 3, // 2 scimitar + 1 dagger, uniform approximation
  },
  'dire-wolf': {
    id: 'dire-wolf', name: 'Dire Wolf',
    ac: 14, hp: 22, speed: 50,
    abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    featureIds: ['pack-tactics'],
    weaponIds: ['dire-wolf-bite'],
  },
  ghoul: {
    id: 'ghoul', name: 'Ghoul',
    ac: 12, hp: 22, speed: 30,
    abilities: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
    weaponIds: ['ghoul-claws', 'ghoul-bite'],
    attacksPerAction: 2, // bite + claws
    immunities: ['poison'],
  },
  'giant-spider': {
    id: 'giant-spider', name: 'Giant Spider',
    ac: 14, hp: 26, speed: 30,
    abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    weaponIds: ['spider-bite'],
  },
  acolyte: {
    id: 'acolyte', name: 'Acolyte',
    ac: 10, hp: 9, speed: 30,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 11 },
    weaponIds: ['mace'],
    spellcasting: { ability: 'wis', slots: [3], spellIds: ['sacred-flame', 'cure-wounds', 'bless'] },
  },
};

export function buildMonster(monsterId: Id, team: TeamId, position: Position, suffix = ''): Combatant {
  const m = MONSTERS[monsterId];
  if (!m) throw new Error(`Unknown monster: ${monsterId}`);
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
    featureUses: {},
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
  };
}

export interface EncounterData {
  id: Id;
  name: string;
  members: Id[]; // monster ids; duplicates allowed
  suggestedLevel: number;
}

export const ENCOUNTERS: Record<Id, EncounterData> = {
  goblins: {
    id: 'goblins', name: 'Goblin Warband', suggestedLevel: 1,
    members: ['goblin-boss', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior'],
  },
  wolves: {
    id: 'wolves', name: 'Wolf Pack', suggestedLevel: 1,
    members: ['wolf', 'wolf', 'wolf', 'wolf', 'wolf'],
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
};

/** Place an encounter on a rank, spread across the files. */
export function buildEncounter(encounterId: Id, team: TeamId, rank: number): Combatant[] {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) throw new Error(`Unknown encounter: ${encounterId}`);
  const files = [3, 1, 5, 2, 6, 0, 7, 4];
  return enc.members.map((mid, i) =>
    buildMonster(mid, team, { x: files[i]!, y: rank }, enc.members.length > 1 ? String(i + 1) : ''),
  );
}
