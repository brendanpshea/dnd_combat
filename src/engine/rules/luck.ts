/**
 * Rerolls that come from who you are: Halfling Luck, and the Fated origin feat.
 *
 * One shared helper rather than a copy at each `rollD20` call site (weapon
 * attacks, spell attacks, thrown items, wands, saving throws, the Hide check,
 * and now skill contests), so each of them just wraps its result. Lives here,
 * not in `dice.ts`, because it needs to know about a specific combatant's
 * features — `dice.ts` is deliberately state-shape-agnostic, pure dice math
 * with no `Combatant`/`GameState` awareness.
 *
 * TWO DIFFERENT THINGS, ON PURPOSE
 *
 * HALFLING LUCK is the *species* trait (2014 and 2024 alike): a natural 1
 * rerolls, unconditionally and unlimited, and RAW even a second 1 stands. It
 * needs no `featureUses` bookkeeping at all.
 *
 * FATED is the origin feat, and it is a RESOURCE: three uses per long rest,
 * spent automatically on the first three rolls where a reroll has real upside.
 *
 * WHY IT SPENDS ITSELF
 *
 * The feat's wording is "you can", i.e. a decision, and a decision the AI makes
 * needs a price it can weigh. This repository has been bitten repeatedly by
 * pricing an effect as a flat constant — it then gets chosen always or never.
 * Rather than invent a price for a small feat, the policy is fixed and shared by
 * the player and the AI alike: spend on the first three natural rolls of 10 or
 * less.
 *
 * Ten is the bottom half of the die, which is exactly the region where a reroll
 * is expected to gain rather than lose. The cost of not tuning it is that the
 * feat cannot tell a death save from a Guidance check and will spend on
 * whichever comes first — a deliberate, documented trade rather than an
 * oversight.
 *
 * THIS FUNCTION HAS A SIDE EFFECT
 *
 * Spending a Fated use decrements the pool on the combatant, which is why it
 * reports back through `D20Roll.luck`: a caller with an event to hang it on can
 * then tell the player their feat just did something.
 */
import type { GameState, Id } from '../types.js';
import { rollD20, type D20Roll, type RollMode } from '../dice.js';

/** A natural roll at or below this is worth spending a Fated use on. */
export const FATED_THRESHOLD = 10;
export const FATED_USES = 3;

export function applyLuck(state: GameState, combatantId: Id, roll: D20Roll, mode: RollMode): D20Roll {
  const c = state.combatants[combatantId];
  if (!c) return roll;

  // Halfling Luck first: it is free, so there is never a reason to spend a
  // Fated use on a natural 1 a species trait would have rerolled anyway.
  if (roll.natural === 1 && c.featureIds.includes('lucky')) {
    const again = rollD20(roll.state, mode);
    return { ...again, luck: 'Halfling Luck' };
  }

  if (roll.natural > FATED_THRESHOLD || !c.featureIds.includes('fated')) return roll;
  const pool = c.featureUses?.['fated'];
  if (!pool || pool.current <= 0) return roll;

  const again = rollD20(roll.state, mode);
  pool.current -= 1;
  /**
   * KEEP THE BETTER ROLL. The feat grants Advantage, which post-hoc is exactly
   * "roll a second d20 and use the higher" — it can never make a roll worse.
   *
   * The first version replaced the die unconditionally and so could hand back a
   * 1 in place of a 10. That reads as a feat that hurts you, and it was caught
   * by reading the combat log rather than by a test: the label said "no better"
   * on a roll it had just made worse. Halfling Luck above genuinely does replace
   * unconditionally (RAW, even a second 1 stands), which is what made the wrong
   * shape look plausible here.
   *
   * The use is still spent when the reroll misses, because the decision to spend
   * happens before the second die is known.
   */
  const better = again.natural >= roll.natural;
  return {
    ...(better ? again : { ...roll, state: again.state }),
    luck: better
      ? `Fated (${roll.natural} → ${again.natural})`
      : `Fated (rerolled ${again.natural}, kept ${roll.natural})`,
  };
}

/** The old name, kept so the existing call sites read unchanged. */
export const applyLucky = applyLuck;
