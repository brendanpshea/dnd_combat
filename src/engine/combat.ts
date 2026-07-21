/**
 * Combat setup and the thin stateful facade over the pure core.
 */
import type { GameState, Combatant, Id, TeamId } from './types.js';
import { cellAt } from './types.js';
import { makeGrid } from './grid.js';
import { MAPS, parseMap } from '../data/maps.js';
import { seedRng } from './rng.js';
import { rollInitiative, currentCombatant } from './turn.js';
import { legalActions, step, Action } from './actions.js';
import type { GameEvent } from './events.js';

export interface CombatSetup {
  seed: number;
  width?: number;
  height?: number;
  /** Battle map from src/data/maps.ts; omitted = open grid of width×height. */
  mapId?: string;
  combatants: Combatant[]; // positions must be set and unique
  /** A surprised team loses its first round: every member starts `incapacitated`
   *  until the top of round 2 (can't act or take reactions). Models an ambush —
   *  the party surprising raiders, or being caught out. */
  surprisedTeam?: TeamId;
}

export function startCombat(setup: CombatSetup): { state: GameState; events: GameEvent[] } {
  let grid;
  if (setup.mapId !== undefined) {
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
    if (cell.terrain === 'wall') throw new Error(`${c.id} placed inside a wall`);
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
  };
  // Surprise: the surprised team is incapacitated through round 1, cleared at
  // the start of each member's round-2 turn by the expiresAtRound machinery.
  if (setup.surprisedTeam) {
    for (const c of Object.values(combatants)) {
      if (c.team === setup.surprisedTeam) {
        c.conditions.push({ id: 'incapacitated', expiresAtRound: 1 });
      }
    }
  }

  const events = rollInitiative(state);
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
