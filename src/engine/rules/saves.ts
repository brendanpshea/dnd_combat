/**
 * Saving throws, including the Bless d4. Mutates draft state (rng).
 */
import type { GameState, Id, Ability, Combatant } from '../types.js';
import { abilityMod, proficiencyBonus, isDown } from '../types.js';
import { distanceFeet } from '../grid.js';
import { rollD20, rollDice } from '../dice.js';
import { FEATURES } from '../../data/features.js';
import { applyLucky } from './luck.js';
import type { GameEvent } from '../events.js';

/**
 * Countercharm (Bard 7), simplified: the bard and allies within 30 ft roll
 * Wisdom and Charisma saves with advantage.
 *
 * The SRD version is a reaction that makes one creature reroll a save it just
 * failed against being charmed or frightened. Nothing here knows what a save is
 * *against* — savingThrow is handed an ability and a DC and no more — so the
 * closest honest model is standing advantage on the two abilities those effects
 * actually use. It fires more often than the real thing and costs no reaction,
 * which is a fair trade for a rule the engine can express.
 *
 * Radius, like the paladin's aura, so it moves with the bard.
 */
function countercharmed(state: GameState, c: Combatant, ability: Ability): boolean {
  if (ability !== 'wis' && ability !== 'cha') return false;
  for (const other of Object.values(state.combatants)) {
    if (other.team !== c.team || !other.alive || isDown(other)) continue;
    if (!other.featureIds.includes('countercharm')) continue;
    if (other.conditions.some((k) => k.id === 'incapacitated')) continue;
    if (distanceFeet(other.position, c.position) <= 30) return true;
  }
  return false;
}

/**
 * Aura of Devotion (Oath of Devotion, Paladin 7): nobody inside the paladin's
 * Aura of Protection can be charmed.
 *
 * Checked where the charm is applied rather than modelled as a resistance,
 * because immunity means the condition never lands at all — and because, like
 * the aura it rides on, it is a position: step outside the ten feet and the
 * protection stops.
 */
/**
 * Mindless Rage: a raging barbarian cannot be charmed or frightened.
 *
 * A hard block at the five places those conditions are pushed, rather than
 * advantage on the save — the SRD says immune, and there is no central
 * condition applier to hang it on. Five call sites is small enough that one
 * exported predicate is honest; a sixth should call this too, which is why it
 * is named for the rule rather than for the barbarian.
 */
export function immuneToCharmAndFear(c: Combatant): boolean {
  return c.featureIds.includes('mindless-rage') &&
    c.conditions.some((k) => k.id === 'raging');
}

export function charmWarded(state: GameState, c: Combatant): boolean {
  for (const other of Object.values(state.combatants)) {
    if (other.team !== c.team || !other.alive || isDown(other)) continue;
    if (!other.featureIds.includes('aura-of-devotion')) continue;
    if (other.conditions.some((k) => k.id === 'incapacitated')) continue;
    if (distanceFeet(other.position, c.position) <= 10) return true;
  }
  return false;
}

/**
 * A save-for-half damage total, after the target's own defences against exactly
 * that shape of attack.
 *
 * Evasion (Rogue 7) is the whole reason this exists: on a Dexterity save for
 * half, a rogue takes NOTHING on a success and half on a failure. That cannot
 * live in applyDamage, which has no idea whether a hit came from a save at all,
 * and it was previously written out longhand at eleven separate call sites —
 * so a feature like this had nowhere to hook and would have been silently
 * missing from eight spells and three monster abilities.
 */
export function saveForHalf(
  target: Combatant, ability: Ability, total: number, success: boolean,
): number {
  if (ability === 'dex' && target.featureIds.includes('evasion')) {
    return success ? 0 : Math.floor(total / 2);
  }
  return success ? Math.floor(total / 2) : total;
}

/**
 * Aura of Protection (Paladin 6): the paladin and every ally within 10 ft add
 * the paladin's Charisma modifier (minimum +1) to every saving throw.
 *
 * Read here rather than kept as a condition because it is a *position*, not a
 * state: it has to follow the paladin around the board and switch on and off as
 * allies step in and out of it, and no condition can do that. Inactive while
 * the paladin is down — the SRD says incapacitated, and a paladin at 0 HP is
 * that and more.
 *
 * Overlapping auras do not stack; the best one applies, which is also what the
 * SRD says.
 */
function auraOfProtection(state: GameState, c: Combatant): number {
  let best = 0;
  for (const other of Object.values(state.combatants)) {
    if (other.team !== c.team || !other.alive || isDown(other)) continue;
    if (!other.featureIds.includes('aura-of-protection')) continue;
    if (other.conditions.some((k) => k.id === 'incapacitated')) continue;
    if (distanceFeet(other.position, c.position) > 10) continue;
    best = Math.max(best, Math.max(1, abilityMod(other.abilities.cha)));
  }
  return best;
}

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
    // Rage: advantage on Strength saves. A condition rather than a feature, so
    // it cannot ride on `saveAdvantage` — that list is unconditional.
    (ability === 'str' && c.conditions.some((k) => k.id === 'raging')) ||
    // Magic Resistance is a monster trait; the Mantle of Spell Resistance is
    // the party's version of the same thing, so it reads the same flag.
    (opts.magical === true &&
      (c.featureIds.includes('magic-resistance') || c.featureIds.includes('mantle-spell-resistance'))) ||
    countercharmed(state, c, ability);
  // 2024: Restrained imposes disadvantage on Dexterity saving throws.
  // Bestow Curse: disadvantage on every saving throw the cursed creature makes.
  const hasDisadvantage =
    (ability === 'dex' && c.conditions.some((k) => k.id === 'restrained')) ||
    c.conditions.some((k) => k.id === 'cursed');
  const mode = hasAdvantage === hasDisadvantage ? 'flat' : hasAdvantage ? 'advantage' : 'disadvantage';
  const d20 = applyLucky(state, combatantId, rollD20(state.rng, mode), mode);
  state.rng = d20.state;
  let total =
    d20.natural +
    abilityMod(c.abilities[ability]) +
    (c.savingThrowProfs.includes(ability) ? proficiencyBonus(c.level) : 0) +
    (c.featureIds.includes('cloak-protection') ? 1 : 0) + // Cloak of Protection
    (c.conditions.some((k) => k.id === 'bonded') ? 1 : 0) + // Warding Bond
    auraOfProtection(state, c);
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
  // Bardic Inspiration, spent on whichever roll reaches for it first.
  if (c.conditions.some((k) => k.id === 'inspiring')) {
    const d6 = rollDice(state.rng, '1d6');
    state.rng = d6.state;
    total += d6.total;
    c.conditions = c.conditions.filter((k) => k.id !== 'inspiring');
  }
  /**
   * Ring of Evasion: a reaction that turns a failed Dexterity save into a
   * success, three times before a rest.
   *
   * Fired automatically, the way the Shield spell fires in the attack path. A
   * prompt on every failed Dex save would be four taps a round for a decision
   * nobody declines — and the charge count is small enough that spending it is
   * always right when it comes up.
   */
  let success = total >= dc;
  if (!success && ability === 'dex' && !c.turn.reactionUsed) {
    const pool = c.featureUses['ring-evasion'];
    if (pool && pool.current > 0) {
      pool.current -= 1;
      c.turn.reactionUsed = true;
      success = true;
    }
  }
  return {
    success,
    event: {
      type: 'savingThrow', combatantId, ability, dc,
      natural: d20.natural, total, success,
    },
  };
}
