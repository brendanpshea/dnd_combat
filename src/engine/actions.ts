/**
 * The Action vocabulary, legal-action enumeration, and the pure step()
 * function. This is the entire surface a driver (CLI, AI) uses.
 */
import type { GameState, Id, Position } from './types.js';
import { posEq } from './types.js';
import { WEAPONS } from '../data/weapons.js';
import { distanceFeet, adjacent, hasLineOfSight } from './grid.js';
import { currentCombatant, endTurn } from './turn.js';
import { resolveAttack } from './rules/attack.js';
import { moveDestinations, executeMove } from './rules/movement.js';
import type { GameEvent } from './events.js';

export type Target = { combatantId: Id } | { position: Position };

export type Action =
  | { kind: 'move'; to: Position }
  | { kind: 'attack'; weaponId: Id; targetId: Id }
  | { kind: 'castSpell'; spellId: Id; slotLevel: number; targets: Target[] }   // Phase 3
  | { kind: 'useFeature'; featureId: Id; targets?: Target[] }                  // Phase 3
  | { kind: 'dash' }
  | { kind: 'disengage' }
  | { kind: 'dodge' }
  | { kind: 'shakeAwake'; targetId: Id }
  | { kind: 'endTurn' };

function isIncapacitated(state: GameState, id: Id): boolean {
  return state.combatants[id]!.conditions.some(
    (c) => c.id === 'incapacitated' || c.id === 'unconscious',
  );
}

export function legalActions(state: GameState, actorId: Id): Action[] {
  const actor = state.combatants[actorId];
  if (!actor || !actor.alive || state.winner) return [];
  if (currentCombatant(state).id !== actorId) return [];

  const actions: Action[] = [];
  const incap = isIncapacitated(state, actorId);

  for (const to of moveDestinations(state, actor)) {
    actions.push({ kind: 'move', to });
  }

  if (!incap && !actor.turn.actionUsed) {
    for (const wid of actor.weaponIds) {
      const w = WEAPONS[wid]!;
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || t.team === actor.team) continue;
        const dist = distanceFeet(actor.position, t.position);
        const inMelee = w.melee && adjacent(actor.position, t.position);
        const inRange =
          w.range !== undefined &&
          dist <= w.range.long &&
          hasLineOfSight(state.grid, actor.position, t.position);
        if (inMelee || inRange) {
          actions.push({ kind: 'attack', weaponId: wid, targetId: t.id });
        }
      }
    }

    actions.push({ kind: 'dash' }, { kind: 'disengage' }, { kind: 'dodge' });

    for (const t of Object.values(state.combatants)) {
      if (
        t.alive && t.team === actor.team && t.id !== actorId &&
        adjacent(actor.position, t.position) &&
        t.conditions.some((c) => c.id === 'unconscious')
      ) {
        actions.push({ kind: 'shakeAwake', targetId: t.id });
      }
    }
  }

  actions.push({ kind: 'endTurn' });
  return actions;
}

function actionsEqual(a: Action, b: Action): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'move' && b.kind === 'move') return posEq(a.to, b.to);
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The pure core: validate against legalActions, clone, execute, return the
 * new state plus everything that happened. Never mutates its input.
 */
export function step(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const actorId = currentCombatant(state).id;
  const legal = legalActions(state, actorId).some((a) => actionsEqual(a, action));
  if (!legal) {
    throw new Error(`Illegal action for ${actorId}: ${JSON.stringify(action)}`);
  }

  const draft: GameState = structuredClone(state);
  const actor = draft.combatants[actorId]!;
  const events: GameEvent[] = [];

  switch (action.kind) {
    case 'move':
      events.push(...executeMove(draft, actorId, action.to));
      break;
    case 'attack':
      actor.turn.actionUsed = true;
      events.push(...resolveAttack(draft, actorId, action.targetId, action.weaponId));
      break;
    case 'dash':
      actor.turn.actionUsed = true;
      actor.turn.movementMax += actor.speed;
      events.push({ type: 'dashed', combatantId: actorId });
      break;
    case 'disengage':
      actor.turn.actionUsed = true;
      actor.turn.disengaged = true;
      events.push({ type: 'disengaged', combatantId: actorId });
      break;
    case 'dodge':
      actor.turn.actionUsed = true;
      actor.conditions.push({ id: 'dodging' });
      events.push({ type: 'dodging', combatantId: actorId });
      break;
    case 'shakeAwake': {
      actor.turn.actionUsed = true;
      const t = draft.combatants[action.targetId]!;
      t.conditions = t.conditions.filter((c) => c.id !== 'unconscious');
      events.push({ type: 'conditionRemoved', combatantId: t.id, condition: 'unconscious' });
      break;
    }
    case 'endTurn':
      events.push(...endTurn(draft, runEndOfTurnSaves));
      break;
    case 'castSpell':
    case 'useFeature':
      throw new Error(`${action.kind} arrives in Phase 3`);
  }

  // If the current actor died to an opportunity attack, hand the turn on.
  if (!draft.winner && !draft.combatants[currentCombatant(draft).id]!.alive) {
    events.push(...endTurn(draft, runEndOfTurnSaves));
  }

  return { state: draft, events };
}

/** End-of-turn repeat saves (Sleep's save-ends). Fleshed out in Phase 3. */
function runEndOfTurnSaves(_state: GameState, _id: Id): GameEvent[] {
  return [];
}
