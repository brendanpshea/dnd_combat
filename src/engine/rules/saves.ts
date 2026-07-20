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

  // 2024: the Paralyzed and Unconscious conditions auto-fail Strength and
  // Dexterity saving throws outright — no roll.
  if ((ability === 'str' || ability === 'dex') &&
      c.conditions.some((k) => k.id === 'paralyzed' || k.id === 'unconscious')) {
    return {
      success: false,
      event: { type: 'savingThrow', combatantId, ability, dc, natural: 1, total: 1, success: false },
    };
  }

  // Gnomish Cunning and the like: advantage on saves of a listed ability.
  // Magic Resistance (Satyr/Unicorn): advantage on saves against spells.
  const hasAdvantage =
    c.featureIds.some((f) => FEATURES[f]?.saveAdvantage?.includes(ability)) ||
    (opts.magical === true && c.featureIds.includes('magic-resistance'));
  // 2024: Restrained imposes disadvantage on Dexterity saving throws.
  const hasDisadvantage = ability === 'dex' && c.conditions.some((k) => k.id === 'restrained');
  const mode = hasAdvantage === hasDisadvantage ? 'flat' : hasAdvantage ? 'advantage' : 'disadvantage';
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
