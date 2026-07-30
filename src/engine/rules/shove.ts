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
 * ADAPTED: A CONTEST, NOT A SAVE
 *
 * The 2024 wording above is a saving throw against a flat DC. This game resolves
 * it as the older opposed check instead — the shover's Athletics against the
 * target's better of Athletics and Acrobatics — and that is a deliberate
 * departure, made for a reason that has nothing to do with shoving.
 *
 * Athletics and Acrobatics were worth NOTHING in combat. They are the two most
 * physical skills in the game, and every skill check happened in the shop or in
 * an adventure scene, because a `Combatant` did not carry its skill
 * proficiencies at all. A fight could not ask what you were good at. Making the
 * one board-shaped martial move a contest is what gives those two skills — and
 * therefore skill proficiency generally, including the Skilled feat — something
 * to do once swords are out.
 *
 * The cost is variance: two d20s rather than one against a fixed number, so a
 * shove is less predictable than RAW. The gain is that training matters on both
 * sides of it, which is the more interesting rule on a grid.
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
 * The target picks, so a rational target picks whichever it is better at —
 * Athletics if strong, Acrobatics if nimble. That is one line (`bestSkill`) and
 * it matters: rolling the shover against a defender's WORSE option would make
 * shove roughly twice as good as it should be. Ties go to the defender, which is
 * the contest rule and the right default for a thing the attacker is trying to
 * make happen.
 */
import type { GameState, Id, Combatant, CreatureSize } from '../types.js';
import { isDown, isIncapacitated } from '../types.js';
import { withinReach } from './reach.js';
import { contest, skillMod } from './skills.js';
import { pushCreature } from './movement.js';
import type { GameEvent } from '../events.js';

export type ShoveMode = 'push' | 'prone';

/** Size order, for "no more than one size larger than you". */
const SIZES: CreatureSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
const rank = (c: Combatant): number => Math.max(0, SIZES.indexOf(c.size ?? 'medium'));

/**
 * The number a defender has to beat, on average — the shover's Athletics
 * modifier plus eleven (the mean of a d20, rounded the way a DC is).
 *
 * Kept as a function with the old name because the AI's scorer and several tests
 * ask "how good is this creature at shoving?" and want one number, not a
 * distribution. It is no longer the DC of a saving throw; it is the centre of
 * the contest.
 */
export function shoveDc(shover: Combatant): number {
  return 11 + skillMod(shover, 'athletics');
}

/** What a defender resists a shove with: whichever of these it is better at. */
export const SHOVE_DEFENCES = ['athletics', 'acrobatics'] as const;

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
  // Reach, not adjacency: a giant shoves from ten feet, which is the same arm
  // it hits with. See rules/reach.ts.
  if (!withinReach(shover, target)) return false;
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
  const c = contest(state, shoverId, 'athletics', targetId, SHOVE_DEFENCES);
  const luck = [c.attacker.luck, c.defender.luck].filter((x): x is string => x !== undefined);
  const detail = {
    attackerTotal: c.attacker.total,
    defenderTotal: c.defender.total,
    defenderSkill: c.defender.skill,
    ...(luck.length > 0 ? { luck } : {}),
  };
  const events: GameEvent[] = [];
  if (!c.won) {
    events.push({ type: 'shoved', shoverId, targetId, mode, success: false, contest: detail });
    return events;
  }
  events.push({ type: 'shoved', shoverId, targetId, mode, success: true, contest: detail });
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
