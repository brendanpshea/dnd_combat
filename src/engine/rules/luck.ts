/**
 * Halfling Luck: when a d20 test rolls a natural 1, reroll it once and use
 * the new result regardless (RAW — even a second 1 stands).
 *
 * One shared helper rather than five copies of the same three lines: every
 * `rollD20` call site (weapon attacks, spell attacks, thrown items, saving
 * throws, the Hide check) already produces a `D20Roll`, so this just wraps
 * the result. Lives here, not in `dice.ts`, because it needs to know about a
 * specific combatant's features — `dice.ts` is deliberately state-shape-
 * agnostic, pure dice math with no `Combatant`/`GameState` awareness.
 *
 * Unlimited, not a per-encounter resource: this is the halfling *species*
 * trait (2014 and 2024 alike), distinct from the separate "Lucky" feat that
 * caps at 3 uses — the simpler, more generous reading, and it needs no
 * `featureUses` bookkeeping at all.
 */
import type { GameState, Id } from '../types.js';
import { rollD20, type D20Roll, type RollMode } from '../dice.js';

export function applyLucky(state: GameState, combatantId: Id, roll: D20Roll, mode: RollMode): D20Roll {
  const c = state.combatants[combatantId];
  if (roll.natural !== 1 || !c?.featureIds.includes('lucky')) return roll;
  return rollD20(roll.state, mode);
}
