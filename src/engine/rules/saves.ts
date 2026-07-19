/**
 * Saving throws, including the Bless d4. Mutates draft state (rng).
 */
import type { GameState, Id, Ability } from '../types.js';
import { abilityMod, proficiencyBonus } from '../types.js';
import { rollD20, rollDice } from '../dice.js';
import { FEATURES } from '../../data/features.js';
import { applyLucky } from './luck.js';
import type { GameEvent } from '../events.js';

export function savingThrow(
  state: GameState,
  combatantId: Id,
  ability: Ability,
  dc: number,
  opts: { magical?: boolean } = {},
): { success: boolean; event: GameEvent } {
  const c = state.combatants[combatantId]!;
  // Gnomish Cunning and the like: advantage on saves of a listed ability. No
  // disadvantage-on-saves source exists yet, so 'flat' is the only other case
  // — the mode is exactly "does a feature grant this?".
  // Magic Resistance (Satyr/Unicorn): advantage on saves against spells.
  const hasAdvantage =
    c.featureIds.some((f) => FEATURES[f]?.saveAdvantage?.includes(ability)) ||
    (opts.magical === true && c.featureIds.includes('magic-resistance'));
  const mode = hasAdvantage ? 'advantage' : 'flat';
  const d20 = applyLucky(state, combatantId, rollD20(state.rng, mode), mode);
  state.rng = d20.state;
  let total =
    d20.natural +
    abilityMod(c.abilities[ability]) +
    (c.savingThrowProfs.includes(ability) ? proficiencyBonus(c.level) : 0) +
    (c.featureIds.includes('cloak-protection') ? 1 : 0); // Cloak of Protection
  if (c.conditions.some((k) => k.id === 'blessed')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total += d4.total;
  }
  if (c.conditions.some((k) => k.id === 'baned')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total -= d4.total;
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
