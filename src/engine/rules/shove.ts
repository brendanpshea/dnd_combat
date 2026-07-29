/**
 * Shove — the Unarmed Strike option every creature has, and nothing could do.
 *
 * The SRD gives an Unarmed Strike three modes: Damage, Grapple and Shove. This
 * game had the first, and forced movement existed only as a rider on other
 * things — Thunderwave's blast, the warlock's Repelling Blast, the Push weapon
 * mastery. `pushCreature` has been in the engine the whole time; nobody could
 * simply choose to do it.
 *
 *   "Shove. The target must succeed on a Strength or Dexterity saving throw (it
 *    chooses which), or you either push it 5 feet away or cause it to have the
 *    Prone condition. The DC for the saving throw equals 8 plus your Strength
 *    modifier and Proficiency Bonus. This shove is possible only if the target
 *    is no more than one size larger than you."
 *
 * WHY IT IS WORTH HAVING
 *
 * It is the cheapest way a martial character interacts with the board rather
 * than with a hit-point total, and this game's board is full of things worth
 * pushing somebody into: a hazard tile burns, a Wall of Fire burns, a web
 * catches, and stepping out of reach afterwards provokes. Prone is the other
 * half — advantage for every melee ally, disadvantage at range, and the target
 * spends half its movement standing up.
 *
 * "IT CHOOSES WHICH" MEANS THE BETTER ONE
 *
 * The target picks the save, so a rational target picks whichever ability it is
 * better at. That is one line here and it matters: rolling Strength against a
 * nimble creature, or Dexterity against a strong one, would make shove roughly
 * twice as good as it should be.
 */
import type { GameState, Id, Combatant, CreatureSize } from '../types.js';
import { abilityMod, proficiencyBonus, isDown, isIncapacitated } from '../types.js';
import { adjacent } from '../grid.js';
import { savingThrow } from './saves.js';
import { pushCreature } from './movement.js';
import type { GameEvent } from '../events.js';

export type ShoveMode = 'push' | 'prone';

/** Size order, for "no more than one size larger than you". */
const SIZES: CreatureSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
const rank = (c: Combatant): number => Math.max(0, SIZES.indexOf(c.size ?? 'medium'));

/** DC 8 + the shover's Strength modifier and proficiency bonus. */
export function shoveDc(shover: Combatant): number {
  return 8 + abilityMod(shover.abilities.str) + proficiencyBonus(shover.level);
}

/**
 * Can `shover` shove `target` at all?
 *
 * Deliberately does NOT check the action economy — `isLegalAction` owns that,
 * the same way it owns it for an attack. This is the rule's own conditions:
 * reach, and the size clause.
 */
export function canShove(shover: Combatant, target: Combatant): boolean {
  if (!shover.alive || isDown(shover) || isIncapacitated(shover)) return false;
  if (!target.alive || isDown(target)) return false;
  if (shover.id === target.id) return false;
  if (!adjacent(shover.position, target.position)) return false;
  // "no more than one size larger than you"
  return rank(target) - rank(shover) <= 1;
}

/**
 * Resolve a shove. The target saves with whichever of Strength or Dexterity it
 * is better at, because the SRD lets it choose and a creature choosing badly is
 * not a rule, it is a gift.
 */
export function resolveShove(
  state: GameState, shoverId: Id, targetId: Id, mode: ShoveMode,
): GameEvent[] {
  const shover = state.combatants[shoverId]!;
  const target = state.combatants[targetId]!;
  const ability = abilityMod(target.abilities.dex) > abilityMod(target.abilities.str) ? 'dex' : 'str';
  const dc = shoveDc(shover);
  const save = savingThrow(state, targetId, ability, dc);
  const events: GameEvent[] = [save.event];
  if (save.success) {
    events.push({ type: 'shoved', shoverId, targetId, mode, success: false });
    return events;
  }
  events.push({ type: 'shoved', shoverId, targetId, mode, success: true });
  if (mode === 'prone') {
    if (!target.conditions.some((k) => k.id === 'prone')) {
      target.conditions.push({ id: 'prone', sourceId: shoverId });
      events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'prone', sourceId: shoverId });
    }
    return events;
  }
  // Five feet, directly away. `pushCreature` already knows how to stop at a
  // wall or an occupied square and to burn anything shoved into a hazard —
  // which is most of the reason to shove in the first place.
  const dir = {
    x: Math.sign(target.position.x - shover.position.x),
    y: Math.sign(target.position.y - shover.position.y),
  };
  events.push(...pushCreature(state, targetId, dir, 1));
  return events;
}
