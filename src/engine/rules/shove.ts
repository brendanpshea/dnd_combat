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
 *    Prone condition. ... This shove is possible only if the target is no more
 *    than one size larger than you."
 *
 * A SAVE, AS THE 2024 RULE HAS IT
 *
 * The target makes a Strength or Dexterity save (its better one) against
 * 8 + the shover's Strength modifier + Proficiency Bonus, the same DC as a
 * grapple — and either is one attack of the Attack action, not an action of
 * its own (SRD 5.2.1, Unarmed Strike, line 14124). A fighter with Extra Attack
 * can shove a foe prone and then swing at it.
 *
 * It was the older opposed check, Athletics against Athletics or Acrobatics,
 * chosen so those two skills would matter in a fight. They still do: breaking
 * a grapple, a web or Entangle's vines is an Athletics or Acrobatics check
 * (the `escape` action).
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
 * The target picks, so a rational target picks whichever save it is better at
 * — Strength if strong, Dexterity if nimble. Rolling against a defender's
 * WORSE save would make a shove roughly twice as good as it should be.
 */
import type { GameState, Id, Combatant, CreatureSize } from '../types.js';
import { isDown, isIncapacitated, abilityMod, proficiencyBonus, immuneToCondition } from '../types.js';
import { withinReach, reachFeet } from './reach.js';
import { WEAPONS } from '../../data/weapons.js';
import { savingThrow } from './saves.js';
import { pushCreature } from './movement.js';
import type { GameEvent } from '../events.js';
import { applyCondition, grapple, heldWith, endGrapple as removeGrip } from './conditions.js';

/**
 * The Unarmed Strike's non-damage options. `grapple` is the third the SRD
 * gives, and it is resolved exactly as a shove is — the same contest, for the
 * same reason (see the note above) — and then holds on: `rules/conditions.ts`
 * owns what a grapple does and how it ends.
 */
export type ShoveMode = 'push' | 'prone' | 'grapple';

/**
 * "…and if you have a hand free to grab it." Nothing in the off hand, and not
 * two-handing the main weapon. One unarmed hold at a time: the other hand is
 * the one swinging the weapon.
 */
export function hasFreeHand(c: Combatant): boolean {
  if (c.equipped.offHand) return false;
  const main = c.equipped.mainHand;
  return !(main && WEAPONS[main]?.properties.includes('two-handed'));
}

/** The escape DC of `c`'s grapple: 8 + Strength + proficiency (Dexterity for a monk's Martial Arts). */
export function grappleDc(c: Combatant): number {
  const str = abilityMod(c.abilities.str);
  const dex = c.featureIds.includes('martial-arts') ? abilityMod(c.abilities.dex) : str;
  return 8 + Math.max(str, dex) + proficiencyBonus(c.level);
}

/** Size order, for "no more than one size larger than you". */
const SIZES: CreatureSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
const rank = (c: Combatant): number => Math.max(0, SIZES.indexOf(c.size ?? 'medium'));

/**
 * The save DC of a shove: 8 + Strength modifier + Proficiency Bonus, the
 * grapple's DC (Dexterity for a monk's, by Martial Arts). The old name is
 * kept because the AI's scorer and the tests ask for it.
 */
export function shoveDc(shover: Combatant): number {
  return grappleDc(shover);
}

/** The save a defender makes against a shove or grapple: its better of the two. */
export function shoveSave(c: Combatant): 'str' | 'dex' {
  const bonus = (a: 'str' | 'dex') =>
    abilityMod(c.abilities[a]) + (c.savingThrowProfs.includes(a) ? proficiencyBonus(c.level) : 0);
  return bonus('dex') > bonus('str') ? 'dex' : 'str';
}


/**
 * Can `shover` shove `target` at all?
 *
 * Deliberately does NOT check the action economy — `isLegalAction` owns that,
 * the same way it owns it for an attack. This is the rule's own conditions:
 * reach, and the size clause.
 */
export function canShove(shover: Combatant, target: Combatant, mode: ShoveMode = 'push'): boolean {
  if (!shover.alive || isDown(shover) || isIncapacitated(shover)) return false;
  if (!target.alive || isDown(target)) return false;
  if (shover.id === target.id) return false;
  // Reach, not adjacency: a giant shoves from ten feet, which is the same arm
  // it hits with. See rules/reach.ts.
  if (!withinReach(shover, target)) return false;
  // "no more than one size larger than you"
  if (rank(target) - rank(shover) > 1) return false;
  // Not offered where it cannot land: a ghost cannot be grabbed, an ooze
  // cannot be knocked down.
  if (mode === 'grapple' && immuneToCondition(target, 'grappled')) return false;
  if (mode === 'prone' && immuneToCondition(target, 'prone')) return false;
  if (mode === 'grapple') {
    if (!hasFreeHand(shover)) return false;
    if (target.conditions.some((k) => k.id === 'grappled' && k.sourceId === shover.id)) return false;
  }
  return true;
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
  const ability = shoveSave(target);
  const save = savingThrow(state, targetId, ability, shoveDc(shover), { magical: false });
  const events: GameEvent[] = [save.event];
  events.push({ type: 'shoved', shoverId, targetId, mode, success: !save.success });
  if (save.success) return events;
  if (mode === 'grapple') {
    // One unarmed hold: taking a new one lets go of the old.
    const already = heldWith(state, shoverId, 'unarmed');
    if (already) events.push(...removeGrip(already, shoverId));
    events.push(...grapple(state, shoverId, targetId, {
      dc: grappleDc(shover), via: 'unarmed', range: reachFeet(shover),
    }));
    return events;
  }
  if (mode === 'prone') {
    if (!target.conditions.some((k) => k.id === 'prone')) {
      events.push(...applyCondition(state, targetId, { id: 'prone', sourceId: shoverId }, { magical: false }));
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
