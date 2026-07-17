/**
 * Saving throws, including the Bless d4. Mutates draft state (rng).
 */
import type { GameState, Id, Ability } from '../types.js';
import { abilityMod, proficiencyBonus } from '../types.js';
import { rollD20, rollDice } from '../dice.js';
import { FEATURES } from '../../data/features.js';
import type { GameEvent } from '../events.js';

export function savingThrow(
  state: GameState,
  combatantId: Id,
  ability: Ability,
  dc: number,
): { success: boolean; event: GameEvent } {
  const c = state.combatants[combatantId]!;
  // Gnomish Cunning and the like: advantage on saves of a listed ability. No
  // disadvantage-on-saves source exists yet, so 'flat' is the only other case
  // — the mode is exactly "does a feature grant this?".
  const hasAdvantage = c.featureIds.some((f) => FEATURES[f]?.saveAdvantage?.includes(ability));
  const d20 = rollD20(state.rng, hasAdvantage ? 'advantage' : 'flat');
  state.rng = d20.state;
  let total =
    d20.natural +
    abilityMod(c.abilities[ability]) +
    (c.savingThrowProfs.includes(ability) ? proficiencyBonus(c.level) : 0);
  if (c.conditions.some((k) => k.id === 'blessed')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total += d4.total;
  }
  const success = total >= dc;
  return {
    success,
    event: {
      type: 'savingThrow', combatantId, ability, dc,
      natural: d20.natural, total, success,
    },
  };
}
