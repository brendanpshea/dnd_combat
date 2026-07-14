/**
 * Class features. Active features have an `apply` hook; passive ones are
 * consulted by the rules (Dueling, Sneak Attack, Disciple of Life) via their
 * presence in combatant.featureIds.
 */
import type { GameState, Id } from '../engine/types.js';
import { rollDice } from '../engine/dice.js';
import type { GameEvent } from '../engine/events.js';

export interface FeatureContext {
  state: GameState;
  actorId: Id;
}

export interface FeatureData {
  id: Id;
  name: string;
  trigger: 'action' | 'bonus' | 'free' | 'passive';
  uses?: { count: number; per: 'encounter' };
  apply?(ctx: FeatureContext): GameEvent[];
}

export const FEATURES: Record<Id, FeatureData> = {
  'second-wind': {
    id: 'second-wind', name: 'Second Wind', trigger: 'bonus',
    uses: { count: 2, per: 'encounter' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      const roll = rollDice(state.rng, `1d10+${c.level}`);
      state.rng = roll.state;
      const amount = Math.min(roll.total, c.maxHp - c.hp);
      c.hp += amount;
      return [{ type: 'healed', targetId: actorId, sourceId: actorId, amount }];
    },
  },
  'action-surge': {
    id: 'action-surge', name: 'Action Surge', trigger: 'free',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.actionUsed = false;
      return [];
    },
  },
  'nimble-escape': {
    id: 'nimble-escape', name: 'Nimble Escape', trigger: 'bonus',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.disengaged = true;
      return [{ type: 'disengaged', combatantId: actorId }];
    },
  },
  'pack-tactics': { id: 'pack-tactics', name: 'Pack Tactics', trigger: 'passive' },
  'undead-fortitude': { id: 'undead-fortitude', name: 'Undead Fortitude', trigger: 'passive' },
  dueling: { id: 'dueling', name: 'Fighting Style: Dueling', trigger: 'passive' },
  'sneak-attack': { id: 'sneak-attack', name: 'Sneak Attack', trigger: 'passive' },
  'disciple-of-life': { id: 'disciple-of-life', name: 'Disciple of Life', trigger: 'passive' },
};
