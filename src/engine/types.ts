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
  | 'dodging'      // attacks against this creature have disadvantage
  | 'blessed'      // +1d4 to attack rolls and saving throws
  | 'inspired'     // Human Heroic Inspiration: advantage on the next attack roll
  | 'noReactions'; // Shocking Grasp rider

export interface ActiveCondition {
  id: ConditionId;
  sourceId?: Id;
  /** Sustained by the source's concentration; removed when it breaks. */
  concentration?: boolean;
  /** Round number after which the condition expires; undefined = until removed. */
  expiresAtRound?: number;
  /** For save-ends conditions (Sleep): repeat this save at end of turn. */
  repeatSave?: { ability: Ability; dc: number };
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
}

export interface Combatant {
  id: Id;
  name: string;
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
  };
  alive: boolean;
}

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

export function cellAt(grid: GridState, p: Position): Cell | undefined {
  if (p.x < 0 || p.y < 0 || p.x >= grid.width || p.y >= grid.height) return undefined;
  return grid.cells[p.y * grid.width + p.x];
}

export function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
