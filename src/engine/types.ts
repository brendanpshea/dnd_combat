/**
 * Core engine types. GameState is a plain serializable object — no classes —
 * so step() can copy cheaply via structural sharing and replays can be saved
 * as JSON.
 */
import type { RngState } from './rng.js';

export type Id = string;
export type TeamId = 'team1' | 'team2';

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type AbilityScores = Record<Ability, number>;

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

export type DamageType =
  | 'slashing' | 'piercing' | 'bludgeoning'
  | 'fire' | 'cold' | 'lightning' | 'thunder' | 'acid' | 'poison'
  | 'radiant' | 'necrotic' | 'force' | 'psychic';

export interface Position {
  x: number; // file, 0-based (a=0)
  y: number; // rank, 0-based
}

export type TerrainId = 'open' | 'difficult' | 'wall' | 'hazard';

export interface Cell {
  terrain: TerrainId;
  occupantId?: Id;
  /**
   * A gnome's Minor Illusion: a shimmering, walkable false wall. Deliberately
   * not a `TerrainId` — an illusion sits *on top of* whatever the cell really
   * is (open ground, difficult terrain) rather than replacing it, so nothing
   * needs to remember what to revert to when it pops. It blocks line of sight
   * like a wall but not movement; any creature that walks through it (either
   * side — an illusion doesn't pick favourites) reveals it, and it expires on
   * its own after a few rounds regardless.
   */
  illusion?: { sourceId: Id; expiresAtRound: number };
}

export interface GridState {
  width: number;
  height: number;
  /** Row-major, index = y * width + x. */
  cells: Cell[];
}

export type ConditionId =
  | 'prone' | 'incapacitated' | 'blinded' | 'poisoned' | 'frightened'
  | 'unconscious'
  | 'paralyzed'    // Hold Person: no move/act, attacks vs have adv, melee hits crit
  | 'guided'       // Guiding Bolt: next attack roll against this target has advantage
  | 'vexed'        // attacker has advantage on next attack vs this source's target
  | 'sapped'       // disadvantage on next attack roll
  | 'slowed'       // Slow mastery: speed cut by 10 ft until this creature's next turn
  | 'restrained'   // Web: speed 0, disadvantage to attack, advantage to be hit
  | 'commanded'    // Command: prone and loses its next action
  | 'shielded'     // Shield reaction: +5 AC (and Magic Missile immunity) until next turn
  | 'dodging'      // attacks against this creature have disadvantage
  | 'blessed'      // +1d4 to attack rolls and saving throws
  | 'inspired'     // Human Heroic Inspiration: advantage on the next attack roll
  | 'hidden'       // unseen: cannot be directly targeted; next attack has advantage
  | 'noReactions'  // Shocking Grasp rider
  | 'outlined'     // outlined: attacks against this creature have advantage, and it can't hide
  | 'marked'       // Hunter's Mark: +1d6 force per hit, from the marking ranger only
  | 'sacredWeapon'; // Devotion's Channel Divinity: +Cha to the paladin's own attack rolls

export interface ActiveCondition {
  id: ConditionId;
  sourceId?: Id;
  /** Sustained by the source's concentration; removed when it breaks. */
  concentration?: boolean;
  /** Round number after which the condition expires; undefined = until removed. */
  expiresAtRound?: number;
  /** For save-ends conditions (Sleep): repeat this save at end of turn. */
  repeatSave?: { ability: Ability; dc: number };
  /** The Dexterity (Stealth) result that observers must beat to reveal Hide. */
  hideCheck?: number;
}

export interface ResourcePool {
  current: number;
  max: number;
}

export interface ItemStack {
  itemId: Id;
  qty: number;
}

export interface Equipped {
  mainHand?: Id;          // weapon id
  offHand?: Id;           // weapon id or 'shield'
  armor?: Id;             // armor id; undefined = unarmored
  trinket?: Id;           // wondrous item (one accessory slot); undefined = none
}

export interface Combatant {
  id: Id;
  name: string;
  /** Optional UI art identity. Defaults to classId when absent. */
  portraitId?: Id;
  team: TeamId;
  classId: Id;
  speciesId: Id;
  level: number;
  abilities: AbilityScores;
  maxHp: number;
  hp: number;
  /** Temporary HP is depleted before HP and never stacks. */
  tempHp?: number;
  /** Monsters: flat stat-block AC. PCs derive AC from equipment (acOf). */
  acOverride?: number;
  speed: number; // feet
  position: Position;
  initiative: number;
  savingThrowProfs: Ability[];
  spellcastingAbility?: Ability;
  spellSlots: ResourcePool[];       // index 0 = level-1 slots
  spellIds: Id[];                   // known/prepared spells incl. cantrips
  featureIds: Id[];                 // class/species features
  featureUses: Record<Id, ResourcePool>;
  /**
   * Innate spells — a species' own magic, cast with no spell slot and a limited
   * number of times per encounter (a wood elf's Faerie Fire). Keyed by spell id;
   * the pool is the mirror of featureUses. This is what lets a *fighter* cast a
   * levelled spell at all: it has no slots, so slot-gated casting could only
   * ever have been a caster's perk.
   */
  innateSpells: Record<Id, ResourcePool>;
  /** Carried but not in hand (spare weapons, consumables). */
  inventory: ItemStack[];
  equipped: Equipped;
  weaponMasteries: Id[];            // weapon ids whose mastery property applies
  /** Attacks per Attack action (Multiattack / Extra Attack). Default 1. */
  attacksPerAction: number;
  resistances: DamageType[];
  vulnerabilities: DamageType[];
  immunities: DamageType[];
  conditions: ActiveCondition[];
  concentratingOn?: { spellId: Id; targetIds: Id[] };
  /** A summoned familiar follows its caster without occupying a grid cell. */
  familiar?: {
    kind: 'owl';
    /** The round in which it last granted the caster attack advantage. */
    helpedRound?: number;
  };
  /** Mage Armor lasts until the campaign's next long rest while unarmored. */
  mageArmor?: boolean;
  /** Has taken a turn this combat (Assassinate window). */
  hasActed: boolean;
  /** Per-turn economy, reset at turn start. */
  turn: {
    actionUsed: boolean;
    bonusActionUsed: boolean;
    reactionUsed: boolean;
    movementUsed: number;   // feet
    movementMax: number;    // feet; speed, doubled by Dash
    disengaged: boolean;    // no opportunity attacks provoked this turn
    attackedThisTurn: boolean; // gates the off-hand bonus attack
    attacksLeft: number;    // extra attacks remaining within the Attack action
    interacted: boolean;    // free object interaction (weapon swap) spent
    sneakAttackUsed: boolean;
    colossusUsed: boolean;  // Colossus Slayer: once per turn
  };
  alive: boolean;
  /**
   * At 0 HP this creature drops unconscious instead of dying — player
   * characters do, monsters don't. Set by the builder rather than inferred
   * from the class, because the engine must not know what a "character" is.
   *
   * A downed creature is `alive` with `hp === 0`. That pair is the whole state:
   * it can't act, can't be woken by damage (the Sleep wake rule already only
   * fires above 0 HP), and any healing brings it back. Nothing else is needed —
   * no death saves, no second unconscious condition.
   */
  unconsciousAtZero?: boolean;
  /** Round the combatant last spent Uncanny Dodge (once per round). */
  uncannyDodgeRound?: number;
  /** Spiritual Weapon: a floating weapon that grants a bonus-action force
   *  attack each turn until it expires (cleared in startTurn). */
  spiritualWeapon?: { expiresAtRound: number };
  /** Spiritual Guardians: a radiant aura around the caster that hurts enemies
   *  who start their turn near it (held by concentration). */
  spiritualGuardians?: { dc: number; mod: number };
  /**
   * SRD creature type (humanoid, beast, undead...). Optional and mostly
   * decorative today — nothing gates on it except Animal Friendship, which
   * needs to tell a wolf from a goblin. Player characters are all `humanoid`;
   * monsters are tagged per stat block. A natural follow-on (not done here,
   * to keep this change scoped) is gating Hold Person to humanoids for the
   * same faithfulness reason.
   */
  creatureType?: CreatureType;
}

export type CreatureType =
  | 'humanoid' | 'beast' | 'undead' | 'giant' | 'construct' | 'fiend' | 'dragon' | 'elemental';

export interface GameState {
  rng: RngState;
  round: number;
  grid: GridState;
  combatants: Record<Id, Combatant>;
  /** Combatant ids in initiative order. */
  initiativeOrder: Id[];
  /** Index into initiativeOrder of whose turn it is. */
  turnIndex: number;
  winner: TeamId | null;
}

/**
 * Down, not dead: a hero at 0 HP is unconscious, still on the board, and comes
 * back the moment anything heals it.
 *
 * It is also *out of reach of the fight*. Nothing can hurt it further — damage
 * finds it already at 0 — so hostile targeting must exclude it, and not merely
 * as an optimisation: without that rule an AI scoring "can I kill this?" reads
 * a 0 HP body as a guaranteed kill and every enemy spends the rest of the
 * battle hitting it. That is not a hypothetical; it deadlocked every mirror
 * match the moment downing went in.
 */
export function isDown(c: Combatant): boolean {
  return c.alive && c.hp === 0;
}

export function cellAt(grid: GridState, p: Position): Cell | undefined {
  if (p.x < 0 || p.y < 0 || p.x >= grid.width || p.y >= grid.height) return undefined;
  return grid.cells[p.y * grid.width + p.x];
}

export function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
