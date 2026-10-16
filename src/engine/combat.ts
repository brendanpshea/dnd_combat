/**
 * Combat setup and the thin stateful facade over the pure core.
 */
import type { GameState, Combatant, Id, TeamId, CombatRules, FightModifier, SetPiece } from './types.js';
import { applyFightModifiers } from './rules/boons.js';
import { armPhases, installSetPieces } from './rules/setpiece.js';
import { cellAt } from './types.js';
import { blocksMovement, makeGrid } from './grid.js';
import { MAPS, parseMap } from '../data/maps.js';
import type { MapData } from '../data/maps.js';
import { seedRng } from './rng.js';
import { rollInitiative, currentCombatant } from './turn.js';
import { legalActions, step, type Action } from './actions.js';
import type { GameEvent } from './events.js';

export interface CombatSetup {
  seed: number;
  width?: number;
  height?: number;
  /** Battle map from src/data/maps.ts; omitted = open grid of width×height. */
  mapId?: string;
  /** A map passed by value rather than by id — the arena generates its boards,
   *  so they never live in MAPS. Takes precedence over `mapId`. */
  map?: MapData;
  combatants: Combatant[]; // positions must be set and unique
  /**
   * A surprised team rolls Initiative with Disadvantage.
   *
   * That is the 2024 rule, whole: "If a combatant is surprised by combat
   * starting, that combatant has Disadvantage on their Initiative roll."
   *
   * It used to be the 2014 one — every member `incapacitated` until the top of
   * round 2, so the ambushed side lost a complete turn. Measured in the arena,
   * where a party can gamble on creeping in, that was worth far too much: the
   * group Stealth check succeeds 84% of the time and bought a free round
   * against the whole enemy line, which is most of a fight.
   */
  surprisedTeam?: TeamId;
  /** Optional rules for this fight (death saves). See `CombatRules`. */
  rules?: CombatRules;
  /**
   * The story's boons and banes, for the whole fight: to a side, to creatures
   * of a type, or to one creature (`FightModifier`; rules/modifiers.ts).
   * Logged once as the fight starts.
   */
  modifiers?: FightModifier[];
  /**
   * A story's villains, set up for this fight: a named creature fights in its
   * lair (its stat block's lair actions and Legendary Resistance), and/or with
   * lair actions and phases of the story's own (`SetPiece`; rules/setpiece.ts).
   */
  setPieces?: SetPiece[];
}

export function startCombat(setup: CombatSetup): { state: GameState; events: GameEvent[] } {
  let grid;
  if (setup.map !== undefined) {
    grid = parseMap(setup.map);
  } else if (setup.mapId !== undefined) {
    const map = MAPS[setup.mapId];
    if (!map) throw new Error(`Unknown map: ${setup.mapId}`);
    grid = parseMap(map);
  } else {
    grid = makeGrid(setup.width ?? 8, setup.height ?? 8);
  }
  const combatants: Record<Id, Combatant> = {};
  for (const c of setup.combatants) {
    combatants[c.id] = c;
    const cell = cellAt(grid, c.position);
    if (!cell) throw new Error(`${c.id} placed out of bounds`);
    if (blocksMovement(cell.terrain)) throw new Error(`${c.id} placed inside ${cell.terrain === 'wall' ? 'a wall' : 'a barricade'}`);
    if (cell.occupantId) throw new Error(`${c.id} placed on occupied cell`);
    cell.occupantId = c.id;
  }
  const state: GameState = {
    rng: seedRng(setup.seed),
    round: 0,
    grid,
    combatants,
    initiativeOrder: [],
    turnIndex: 0,
    winner: null,
    ...(setup.rules ? { rules: { ...setup.rules } } : {}),
    // A copy: the setup is the host's, and a story may reuse it.
    ...(setup.modifiers?.length ? { modifiers: JSON.parse(JSON.stringify(setup.modifiers)) as FightModifier[] } : {}),
  };
  // Boons and banes before initiative, so a starting condition holds from the
  // first turn and the log opens with what the story brought.
  const opening = applyFightModifiers(state);
  if (setup.setPieces?.length) installSetPieces(state, setup.setPieces);
  armPhases(state);
  const events = [...opening, ...rollInitiative(state, setup.surprisedTeam)];
  return { state, events };
}

export class Combat {
  state: GameState;
  readonly log: GameEvent[] = [];

  constructor(setup: CombatSetup) {
    const { state, events } = startCombat(setup);
    this.state = state;
    this.log.push(...events);
  }

  get activeId(): Id {
    return currentCombatant(this.state).id;
  }

  legalActions(actorId: Id = this.activeId): Action[] {
    return legalActions(this.state, actorId);
  }

  apply(action: Action): GameEvent[] {
    const r = step(this.state, action);
    this.state = r.state;
    this.log.push(...r.events);
    return r.events;
  }

  isOver(): boolean {
    return this.state.winner !== null;
  }

  winner(): TeamId | null {
    return this.state.winner;
  }
}
