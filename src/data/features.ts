/**
 * Class features. Active features have an `apply` hook; passive ones are
 * consulted by the rules (Dueling, Sneak Attack, Disciple of Life) via their
 * presence in combatant.featureIds.
 */
import type { GameState, Id } from '../engine/types.js';
import { rollDice } from '../engine/dice.js';
import { distanceFeet } from '../engine/grid.js';
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
  'improved-critical': { id: 'improved-critical', name: 'Improved Critical (Champion)', trigger: 'passive' },
  assassinate: { id: 'assassinate', name: 'Assassinate', trigger: 'passive' },
  'sculpt-spells': { id: 'sculpt-spells', name: 'Sculpt Spells (Evoker)', trigger: 'passive' },
  'cunning-dash': {
    id: 'cunning-dash', name: 'Cunning Action: Dash', trigger: 'bonus',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.movementMax += c.speed;
      return [{ type: 'dashed', combatantId: actorId }];
    },
  },
  'cunning-disengage': {
    id: 'cunning-disengage', name: 'Cunning Action: Disengage', trigger: 'bonus',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.disengaged = true;
      return [{ type: 'disengaged', combatantId: actorId }];
    },
  },
  'preserve-life': {
    id: 'preserve-life', name: 'Channel Divinity: Preserve Life', trigger: 'action',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const events: GameEvent[] = [];
      let pool = 5 * me.level;
      // Most-wounded allies within 30 ft first; never above half max HP.
      const targets = Object.values(state.combatants)
        .filter((c) => c.alive && c.team === me.team &&
          distanceFeet(me.position, c.position) <= 30 &&
          c.hp < Math.floor(c.maxHp / 2))
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      for (const t of targets) {
        if (pool <= 0) break;
        const amount = Math.min(pool, Math.floor(t.maxHp / 2) - t.hp);
        if (amount <= 0) continue;
        t.hp += amount;
        pool -= amount;
        events.push({ type: 'healed', targetId: t.id, sourceId: actorId, amount });
      }
      return events;
    },
  },
  'undead-fortitude': { id: 'undead-fortitude', name: 'Undead Fortitude', trigger: 'passive' },
  dueling: { id: 'dueling', name: 'Fighting Style: Dueling', trigger: 'passive' },
  'sneak-attack': { id: 'sneak-attack', name: 'Sneak Attack', trigger: 'passive' },
  'disciple-of-life': { id: 'disciple-of-life', name: 'Disciple of Life', trigger: 'passive' },
};
